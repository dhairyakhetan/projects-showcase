/**
 * logger — serves portfolio data from KV, and keeps KV current with as few
 * upstream calls as possible.
 *
 * Design, in order of importance:
 *
 * 1. THE REQUEST PATH NEVER WRITES TO KV. Serving a visitor costs one KV read
 *    and nothing else. The previous version wrote twice per request (a rate
 *    counter and a request counter), which on the free tier's 1,000 writes/day
 *    meant roughly 500 visitors before the worker started failing.
 *
 * 2. UPSTREAM CALLS ARE CONDITIONAL. Every sync sends If-None-Match with the
 *    ETag GitHub gave us last time. A 304 costs no rate-limit quota at GitHub,
 *    transfers no body, and skips the KV write entirely — so checking often is
 *    nearly free, and we only do real work when something actually changed.
 *
 * 3. UPDATES ARRIVE BY PUSH, NOT POLL. A GitHub webhook (POST /hooks/github)
 *    syncs within seconds of a push. Cron is the safety net, and the request
 *    path has a slow lazy fallback if neither is configured.
 *
 * Bindings: STATS_KV (required), GITHUB_TOKEN (optional, raises GitHub's rate
 * limit), GITHUB_WEBHOOK_SECRET (optional, enables the webhook).
 */

// ---------------------------------------------------------------- config ----

const ALLOWED_ORIGINS = new Set(
  ["https://dhairyakhetan.vercel.app"].map(origin => origin.replace(/\/+$/, "")),
);

const isAllowedOrigin = origin => ALLOWED_ORIGINS.has(String(origin).replace(/\/+$/, ""));

/** Safety net only — the webhook and cron are what keep data current. */
const LAZY_SYNC_AFTER_MS = 6 * 60 * 60 * 1000;

/** Per-isolate throttle so a burst of traffic can't fan out into upstream calls. */
const LAZY_SYNC_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Generous on purpose. The site fetches this server-side, so requests arrive
 * from a handful of Vercel egress IPs rather than from end users — a tight
 * per-IP limit would throttle the whole site, not one abuser. This exists to
 * stop a flood, and a request now costs one KV read.
 */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 1000;

const OG_FETCH_TIMEOUT_MS = 5000;
/** Re-crawl a site that resolved an image this rarely; retry a miss sooner. */
const OG_HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OG_MISS_TTL_MS = 24 * 60 * 60 * 1000;
/** Bounds how many project sites one sync may crawl. */
const OG_MAX_PER_SYNC = 8;

const GITHUB_API = "https://api.github.com";

const PROJECTS = {
  trophies: {
    upstreamHost: "https://www.messivsronaldo.app",
    paths: {
      ronaldo: "/page-data/match-histories/ronaldo-match-history/page-data.json",
      messi: "/page-data/match-histories/messi-match-history/page-data.json",
    },
  },

  showcase: {
    upstreamHost: GITHUB_API,
    paths: {
      repos: "/users/dhairyakhetan/repos?per_page=100&sort=updated",
    },
    resolveOgImages: true,
    /** Repo events on this repo trigger a resync of this project. */
    webhookOwner: "dhairyakhetan",
  },
};

const dataKey = name => `data:${name}`;

// ------------------------------------------------------------------ http ----

function corsHeaders(origin, extra = {}) {
  return {
    "access-control-allow-origin": origin,
    "access-control-expose-headers": "ETag",
    vary: "Origin",
    ...extra,
  };
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
}

async function readRecord(env, name) {
  try {
    return await env.STATS_KV.get(dataKey(name), "json");
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ rate limit ----

/**
 * Per-isolate, in memory. Deliberately not KV: a KV-backed counter costs a
 * write on every request, which is the exact cost this worker is built to
 * avoid, and the real protection here is the Origin allowlist plus the fact
 * that the request path only reads.
 *
 * An isolate is per-colo and short-lived, so this is approximate — it stops a
 * flood from one client hitting one colo, not a distributed one. That is the
 * right trade for a read-only endpoint.
 */
const hits = new Map();

function withinRateLimit(ip) {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });

    // Opportunistic sweep; the Map would otherwise grow for the isolate's life.
    if (hits.size > 5000) {
      for (const [key, value] of hits) {
        if (now - value.start > RATE_WINDOW_MS) hits.delete(key);
      }
    }

    return true;
  }

  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// ------------------------------------------------------------- og images ----

const OG_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
];

async function resolveOgImage(homepage) {
  try {
    const response = await fetch(homepage, {
      headers: { "User-Agent": "logger-worker" },
      signal: AbortSignal.timeout(OG_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const body = await response.text();
    const match = OG_PATTERNS.map(pattern => body.match(pattern)).find(Boolean);
    if (!match) return null;

    return new URL(match[1], homepage).toString();
  } catch {
    return null;
  }
}

/**
 * Attaches og:image to each repo, crawling as little as possible.
 *
 * A site is re-crawled only when its homepage changed, when the last attempt
 * found nothing (retried after a day), or when a successful result has gone
 * stale (a week — a redesign can change og:image without the URL moving).
 * Everything else is reused. Crawls are capped per sync so a cold cache with
 * twenty live projects doesn't turn one sync into twenty outbound requests.
 */
async function attachOgImages(previousOg, repos) {
  const now = Date.now();
  const og = {};
  const due = [];

  for (const repo of repos) {
    const prev = previousOg?.[repo.id];

    if (!repo.homepage) {
      og[repo.id] = { homepage: null, image: null, checkedAt: now };
      continue;
    }

    const unchanged = prev && prev.homepage === repo.homepage;
    const ttl = prev?.image ? OG_HIT_TTL_MS : OG_MISS_TTL_MS;
    const fresh = unchanged && now - (prev.checkedAt ?? 0) < ttl;

    if (fresh) {
      og[repo.id] = prev;
    } else {
      og[repo.id] = unchanged ? prev : { homepage: repo.homepage, image: null, checkedAt: 0 };
      due.push(repo);
    }
  }

  // Oldest checks first, so a capped sync still makes progress every time.
  due.sort((a, b) => (og[a.id]?.checkedAt ?? 0) - (og[b.id]?.checkedAt ?? 0));
  const batch = due.slice(0, OG_MAX_PER_SYNC);

  await Promise.all(
    batch.map(async repo => {
      og[repo.id] = {
        homepage: repo.homepage,
        image: await resolveOgImage(repo.homepage),
        checkedAt: now,
      };
    }),
  );

  return {
    og,
    crawled: batch.length,
    repos: repos.map(repo => ({ ...repo, ogImage: og[repo.id]?.image ?? null })),
  };
}

// ------------------------------------------------------------------ sync ----

async function computeEtag(body) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return `"${hex}"`;
}

function upstreamHeaders(env, project, etag) {
  const headers = { "User-Agent": "logger-worker" };

  // Token is GitHub-only — never attached to another upstream.
  if (project.upstreamHost === GITHUB_API && env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  // A 304 from this costs no GitHub rate-limit quota and transfers no body.
  if (etag) headers["If-None-Match"] = etag;

  return headers;
}

/**
 * Conditionally fetches every path of a project.
 *
 * Returns `{ unchanged: true }` when every path answered 304, which is the
 * common case and the whole point: no body parsed, no KV written, no quota
 * spent. A multi-path project where only some paths changed re-requests the
 * unchanged ones unconditionally, since the merged payload needs them all.
 */
async function fetchUpstream(env, project, previousEtags = {}) {
  const entries = Object.entries(project.paths);

  const responses = await Promise.all(
    entries.map(([key, path]) =>
      fetch(project.upstreamHost + path, {
        headers: upstreamHeaders(env, project, previousEtags[key]),
      }),
    ),
  );

  const failed = responses.find(response => !response.ok && response.status !== 304);
  if (failed) {
    // Never cache or serve an upstream error body as if it were real data.
    throw new Error(`upstream ${failed.status} for ${failed.url}`);
  }

  if (responses.every(response => response.status === 304)) {
    return { unchanged: true };
  }

  const etags = {};
  const payloads = await Promise.all(
    entries.map(async ([key, path], index) => {
      let response = responses[index];

      if (response.status === 304) {
        response = await fetch(project.upstreamHost + path, {
          headers: upstreamHeaders(env, project, null),
        });
        if (!response.ok) throw new Error(`upstream ${response.status} refetching ${key}`);
      }

      etags[key] = response.headers.get("etag");
      return response.json();
    }),
  );

  // A single-path project serves its payload bare; multi-path serves a keyed
  // object, so the front-end doesn't have to know which shape to expect.
  const payload =
    entries.length === 1
      ? payloads[0]
      : Object.fromEntries(entries.map(([key], index) => [key, payloads[index]]));

  return { unchanged: false, payload, etags };
}

/**
 * Brings a project up to date. Writes to KV only when the served body actually
 * changes, so a sync that finds nothing new is read-only.
 */
async function sync(env, name, project, cached) {
  const result = await fetchUpstream(env, project, cached?.upstreamEtags ?? {});

  if (result.unchanged && cached) {
    return { record: cached, changed: false, crawled: 0 };
  }

  let payload = result.payload;
  let og = cached?.og ?? null;
  let crawled = 0;

  if (project.resolveOgImages && Array.isArray(payload)) {
    const resolved = await attachOgImages(og, payload);
    payload = resolved.repos;
    og = resolved.og;
    crawled = resolved.crawled;
  }

  const body = JSON.stringify(payload);
  const etag = await computeEtag(body);

  // An upstream ETag can change while the data we serve does not (ordering,
  // fields we drop). Comparing our own body hash keeps the client's cached
  // copy valid across those, and skips a pointless KV write.
  if (cached && cached.etag === etag && crawled === 0) {
    return { record: cached, changed: false, crawled: 0 };
  }

  const record = {
    body,
    etag,
    upstreamEtags: result.etags ?? cached?.upstreamEtags ?? {},
    og,
    fetchedAt: Date.now(),
    changedAt: cached?.etag === etag ? (cached.changedAt ?? Date.now()) : Date.now(),
    status: 200,
    crawled,
  };

  await env.STATS_KV.put(dataKey(name), JSON.stringify(record));
  return { record, changed: true, crawled };
}

/** Per-isolate memory of the last lazy check, so traffic can't fan out. */
const lastLazyCheck = new Map();

function shouldLazySync(name, cached) {
  if (!cached) return true;
  if (Date.now() - (cached.fetchedAt ?? 0) < LAZY_SYNC_AFTER_MS) return false;

  const last = lastLazyCheck.get(name) ?? 0;
  if (Date.now() - last < LAZY_SYNC_THROTTLE_MS) return false;

  lastLazyCheck.set(name, Date.now());
  return true;
}

// --------------------------------------------------------------- webhook ----

/** Constant-time compare — a length-or-content early exit leaks the signature. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(secret, body, header) {
  if (!header?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(signature))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");

  return timingSafeEqual(expected, header);
}

/**
 * GitHub webhook receiver. This is what makes changes show up in seconds
 * instead of on the next poll, and it costs zero upstream calls until GitHub
 * tells us there is something to fetch.
 *
 * Point a repository (or org) webhook at POST /hooks/github with content type
 * application/json and a secret matching GITHUB_WEBHOOK_SECRET.
 */
async function handleWebhook(request, env, ctx) {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!env.GITHUB_WEBHOOK_SECRET) return new Response("Webhook not configured", { status: 503 });

  const body = await request.text();
  const signed = await verifySignature(
    env.GITHUB_WEBHOOK_SECRET,
    body,
    request.headers.get("X-Hub-Signature-256"),
  );

  if (!signed) return new Response("Bad signature", { status: 401 });

  const event = request.headers.get("X-GitHub-Event");
  if (event === "ping") return new Response("pong");

  let owner = null;
  try {
    owner = JSON.parse(body)?.repository?.owner?.login ?? null;
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const targets = Object.entries(PROJECTS).filter(
    ([, project]) => project.webhookOwner && project.webhookOwner === owner,
  );

  if (targets.length === 0) return new Response("Ignored", { status: 202 });

  // Respond immediately; GitHub times out webhook deliveries at 10s.
  ctx.waitUntil(
    Promise.all(
      targets.map(async ([name, project]) => {
        try {
          await sync(env, name, project, await readRecord(env, name));
        } catch (error) {
          console.error(`webhook sync failed for ${name}:`, error.message);
        }
      }),
    ),
  );

  return new Response("Syncing", { status: 202 });
}

// ----------------------------------------------------------------- admin ----

function formatTimestamp(ms) {
  const formatted = new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return `${formatted} UTC`;
}

function formatAge(ms) {
  const units = [
    [86400000, "d"],
    [3600000, "h"],
    [60000, "m"],
    [1000, "s"],
  ];

  const [size, suffix] = units.find(([unit]) => ms >= unit) ?? units.at(-1);
  return `${Math.floor(ms / size)}${suffix} ago`;
}

const STATE_COLORS = { OK: "#3fb950", STALE: "#d29922", NEVER_FETCHED: "#888" };

async function renderAdminPanel(env) {
  const names = Object.keys(PROJECTS);

  const [rows, keys] = await Promise.all([
    Promise.all(
      names.map(async name => {
        const record = await readRecord(env, name);
        if (!record) return { name, state: "NEVER_FETCHED" };

        const age = Date.now() - record.fetchedAt;
        return {
          name,
          age,
          fetchedAt: record.fetchedAt,
          changedAt: record.changedAt,
          bytes: record.body?.length ?? 0,
          ogKnown: record.og ? Object.keys(record.og).length : 0,
          state: age > LAZY_SYNC_AFTER_MS ? "STALE" : "OK",
        };
      }),
    ),
    env.STATS_KV.list()
      .then(list => list.keys.map(key => key.name))
      .catch(error => [`(couldn't list KV: ${error.message})`]),
  ]);

  const body = rows
    .map(
      row => `
    <tr>
      <td>${row.name}</td>
      <td style="white-space:nowrap;">${row.fetchedAt ? formatTimestamp(row.fetchedAt) : "—"}</td>
      <td>${row.age == null ? "—" : formatAge(row.age)}</td>
      <td style="white-space:nowrap;">${row.changedAt ? formatAge(Date.now() - row.changedAt) : "—"}</td>
      <td>${row.bytes ? `${(row.bytes / 1024).toFixed(1)} KB` : "—"}</td>
      <td>${row.ogKnown || "—"}</td>
      <td style="color:${STATE_COLORS[row.state]};font-weight:bold;">${row.state}</td>
    </tr>`,
    )
    .join("");

  return html(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>logger admin</title>
<style>
  body{ font-family:monospace; background:#111; color:#ddd; padding:24px; }
  table{ border-collapse:collapse; width:100%; max-width:900px; }
  th,td{ border:1px solid #444; padding:7px 10px; text-align:left; font-size:.85rem; }
  th{ background:#1a1a1a; }
  tr:nth-child(even) td{ background:#161616; }
  h3{ margin-top:32px; }
  ul,p.note{ font-size:.82rem; color:#aaa; }
  ul{ padding-left:18px; }
</style>
</head>
<body>
  <h2>logger — admin panel</h2>
  <p>generated ${formatTimestamp(Date.now())}</p>
  <table>
    <tr>
      <th>project</th><th>last synced</th><th>age</th><th>last change</th>
      <th>payload</th><th>og cached</th><th>state</th>
    </tr>
    ${body}
  </table>

  <p class="note">
    The request path never writes to KV. Syncs happen on webhook delivery and
    on cron; "last synced" only advances when the served payload changed.
    Webhook: ${env.GITHUB_WEBHOOK_SECRET ? "configured" : "NOT configured"}.
  </p>

  <h3>raw KV keys</h3>
  <ul>
    ${keys.length ? keys.map(key => `<li>${key}</li>`).join("") : "<li>(no keys in this namespace)</li>"}
  </ul>
</body>
</html>`);
}

const PLACEHOLDER_PAGE = `<!DOCTYPE html>
<html>
<head><title>watsup?</title><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0c;">
  <h1 style="color:#f0ede6;font-family:sans-serif;font-size:4vw;text-align:center;">NOTHING TO LOOK AT HERE</h1>
</body>
</html>`;

// ---------------------------------------------------------------- routes ----

function handlePreflight(origin) {
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, {
      "access-control-allow-methods": "GET",
      "access-control-allow-headers": "If-None-Match",
      "access-control-max-age": "86400",
    }),
  });
}

async function handleProject(request, env, ctx, origin, name) {
  const project = PROJECTS[name];
  if (!project) return new Response("Not found", { status: 404 });
  if (!isAllowedOrigin(origin)) return new Response("Forbidden", { status: 403 });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!withinRateLimit(ip)) {
    return new Response("Rate limited", { status: 429, headers: corsHeaders(origin) });
  }

  let record = await readRecord(env, name);

  if (shouldLazySync(name, record)) {
    try {
      record = (await sync(env, name, project, record)).record;
    } catch (error) {
      // Stale data beats no data; only a cold cache turns this into a failure.
      if (!record) return new Response("Upstream fetch failed", { status: 502 });
      console.error(`lazy sync failed for ${name}:`, error.message);
    }
  }

  if (!record) return new Response("No data", { status: 503 });

  const headers = corsHeaders(origin, {
    // Short, so a webhook-driven update reaches visitors quickly; the ETag
    // makes the revalidation itself almost free.
    "cache-control": "public, max-age=60, stale-while-revalidate=86400",
    etag: record.etag,
  });

  if (request.headers.get("If-None-Match") === record.etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(record.body, {
    headers: { ...headers, "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------- export ----

export default {
  /** Safety net behind the webhook. Conditional, so a no-op run is ~free. */
  async scheduled(event, env) {
    await Promise.all(
      Object.entries(PROJECTS).map(async ([name, project]) => {
        try {
          await sync(env, name, project, await readRecord(env, name));
        } catch (error) {
          console.error(`scheduled sync failed for ${name}:`, error.message);
        }
      }),
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return handlePreflight(origin);
    if (path === "/hooks/github") return handleWebhook(request, env, ctx);
    if (path === "/admin-panel") return renderAdminPanel(env);

    const name = url.searchParams.get("project");
    if (!name) return html(PLACEHOLDER_PAGE);

    return handleProject(request, env, ctx, origin, name);
  },
};
