/**
 * logger — serves the portfolio's repo list from KV, and keeps KV current with
 * as few upstream calls as possible.
 *
 * Design, in order of importance:
 *
 * 1. THE REQUEST PATH NEVER WRITES TO KV. Serving a visitor costs one KV read
 *    and nothing else. An earlier version wrote twice per request (a rate
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
const GITHUB_OWNER = "dhairyakhetan";
const REPOS_PATH = `/users/${GITHUB_OWNER}/repos?per_page=100&sort=updated`;

/**
 * One project, one upstream path. This used to be a map of projects each with
 * several paths, which meant assembling payloads from parts and reconciling
 * per-path ETags. Only one consumer was ever left, so all of that is gone.
 *
 * The `?project=showcase` parameter stays because the site sends it.
 */
const PROJECT = "showcase";
const KV_KEY = `data:${PROJECT}`;

// ------------------------------------------------------------------ http ----

function corsHeaders(origin, extra = {}) {
  return {
    "access-control-allow-origin": origin,
    "access-control-expose-headers": "ETag",
    vary: "Origin",
    ...extra,
  };
}

function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain;charset=UTF-8" },
  });
}

async function readRecord(env) {
  try {
    return await env.STATS_KV.get(KV_KEY, "json");
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
 * Identity for og state. `id` is preferred because it survives a rename, but
 * it is not assumed present: keying on `id` alone turned every repo without
 * one into the same `og[undefined]` entry, so they inherited each other's
 * images — the wrong picture on the wrong card.
 */
const ogKey = repo => String(repo.id ?? repo.name ?? repo.html_url ?? "");

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
    const key = ogKey(repo);
    const prev = previousOg?.[key];

    if (!repo.homepage) {
      og[key] = { homepage: null, image: null, checkedAt: now };
      continue;
    }

    const unchanged = prev && prev.homepage === repo.homepage;
    const ttl = prev?.image ? OG_HIT_TTL_MS : OG_MISS_TTL_MS;
    const fresh = unchanged && now - (prev.checkedAt ?? 0) < ttl;

    if (fresh) {
      og[key] = prev;
    } else {
      og[key] = unchanged ? prev : { homepage: repo.homepage, image: null, checkedAt: 0 };
      due.push(repo);
    }
  }

  // Oldest checks first, so a capped sync still makes progress every time.
  due.sort((a, b) => (og[ogKey(a)]?.checkedAt ?? 0) - (og[ogKey(b)]?.checkedAt ?? 0));
  const batch = due.slice(0, OG_MAX_PER_SYNC);

  await Promise.all(
    batch.map(async repo => {
      og[ogKey(repo)] = {
        homepage: repo.homepage,
        image: await resolveOgImage(repo.homepage),
        checkedAt: now,
      };
    }),
  );

  return {
    og,
    crawled: batch.length,
    repos: repos.map(repo => ({ ...repo, ogImage: og[ogKey(repo)]?.image ?? null })),
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

/** The stored payload, or null when absent or unparseable. */
function parsePayload(record) {
  if (!record?.body) return null;
  try {
    const parsed = JSON.parse(record.body);
    return parsed === undefined ? null : parsed;
  } catch {
    return null;
  }
}

/** Conditionally fetches the repo list. A 304 carries no body. */
async function fetchRepos(env, previousEtag) {
  const headers = { "User-Agent": "logger-worker" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  // A 304 from this costs no GitHub rate-limit quota and transfers no body.
  if (previousEtag) headers["If-None-Match"] = previousEtag;

  const response = await fetch(GITHUB_API + REPOS_PATH, { headers });

  if (response.status === 304) return { notModified: true, etag: previousEtag ?? null };

  // Never cache or serve an upstream error body as if it were real data.
  if (!response.ok) throw new Error(`upstream ${response.status} for ${REPOS_PATH}`);

  return { notModified: false, etag: response.headers.get("etag"), repos: await response.json() };
}

/**
 * Brings the stored repo list up to date, writing to KV only when the served
 * body actually changes.
 *
 * Conditional requests make "nothing changed" the cheap path, but they also
 * mean a 304 hands back no content — so a 304 we cannot reconstruct has to be
 * re-asked rather than assumed. That is what `retried` guards.
 */
async function sync(env, cached, { retried = false } = {}) {
  const cachedPayload = parsePayload(cached);
  const usableCache = cached !== null && cachedPayload !== null;

  const result = await fetchRepos(env, usableCache ? cached.upstreamEtag : null);

  if (result.notModified && !usableCache) {
    // Upstream said "not modified" for something we cannot reconstruct. Writing
    // here would store an empty payload, so re-ask unconditionally instead.
    if (retried) throw new Error("upstream kept answering 304 with nothing cached");
    return sync(env, null, { retried: true });
  }

  const repos = result.notModified ? cachedPayload : result.repos;

  // GitHub answers errors with a JSON object; the repo list must be a list.
  if (!Array.isArray(repos)) throw new Error("upstream payload was not an array");

  // Runs BEFORE the no-change decision, so an expiring og entry is still
  // refreshed on a sync where upstream itself reported nothing new.
  const resolved = await attachOgImages(cached?.og ?? null, repos);

  const body = JSON.stringify(resolved.repos);
  const etag = await computeEtag(body);
  const upstreamEtag = result.etag ?? null;

  const unchanged =
    usableCache &&
    cached.etag === etag &&
    resolved.crawled === 0 &&
    (cached.upstreamEtag ?? null) === upstreamEtag;

  if (unchanged) return { record: cached, changed: false, crawled: 0 };

  const record = {
    body,
    etag,
    upstreamEtag,
    og: resolved.og,
    fetchedAt: Date.now(),
    changedAt: usableCache && cached.etag === etag ? (cached.changedAt ?? Date.now()) : Date.now(),
    crawled: resolved.crawled,
  };

  await env.STATS_KV.put(KV_KEY, JSON.stringify(record));
  return { record, changed: true, crawled: resolved.crawled };
}

/** Per-isolate memory of the last lazy check, so traffic can't fan out. */
let lastLazyCheck = 0;

function shouldLazySync(cached) {
  if (!cached) return true;
  if (Date.now() - (cached.fetchedAt ?? 0) < LAZY_SYNC_AFTER_MS) return false;
  if (Date.now() - lastLazyCheck < LAZY_SYNC_THROTTLE_MS) return false;

  lastLazyCheck = Date.now();
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
  if (request.method !== "POST") return text("Method not allowed", 405);
  if (!env.GITHUB_WEBHOOK_SECRET) return text("Webhook not configured", 503);

  const body = await request.text();
  const signed = await verifySignature(
    env.GITHUB_WEBHOOK_SECRET,
    body,
    request.headers.get("X-Hub-Signature-256"),
  );

  if (!signed) return text("Bad signature", 401);
  if (request.headers.get("X-GitHub-Event") === "ping") return text("pong");

  let owner = null;
  try {
    owner = JSON.parse(body)?.repository?.owner?.login ?? null;
  } catch {
    return text("Bad payload", 400);
  }

  if (owner !== GITHUB_OWNER) return text("Ignored", 202);

  // Respond immediately; GitHub times out webhook deliveries at 10s.
  ctx.waitUntil(
    (async () => {
      try {
        await sync(env, await readRecord(env));
      } catch (error) {
        console.error("webhook sync failed:", error.message);
      }
    })(),
  );

  return text("Syncing", 202);
}

// ----------------------------------------------------------------- admin ----

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

function formatTimestamp(ms) {
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

/**
 * Plain text, not HTML. It renders instantly, reads the same in a terminal as
 * in a browser, and curl/grep work on it — which is how a status page for one
 * service actually gets used.
 */
async function renderAdminPanel(env) {
  const started = Date.now();
  const record = await readRecord(env);
  const lines = [];

  lines.push(`logger — ${formatTimestamp(Date.now())}`, "");

  if (!record) {
    lines.push("showcase   NEVER FETCHED", "", "No data in KV yet. The next request or cron run will sync.");
  } else {
    const payload = parsePayload(record);
    const age = Date.now() - record.fetchedAt;
    const ogEntries = Object.values(record.og ?? {});
    const withImages = ogEntries.filter(entry => entry.image).length;
    const withSites = ogEntries.filter(entry => entry.homepage).length;

    lines.push(
      `state          ${age > LAZY_SYNC_AFTER_MS ? "STALE" : "OK"}`,
      `last synced    ${formatTimestamp(record.fetchedAt)}  (${formatAge(age)})`,
      `last change    ${record.changedAt ? formatAge(Date.now() - record.changedAt) : "—"}`,
      `repos          ${Array.isArray(payload) ? payload.length : "unreadable payload"}`,
      `payload        ${(record.body.length / 1024).toFixed(1)} KB`,
      `og images      ${withImages} resolved of ${withSites} live sites (${ogEntries.length} tracked)`,
      `upstream etag  ${record.upstreamEtag ?? "none — upstream sends no validator"}`,
      `served etag    ${record.etag}`,
    );
  }

  lines.push(
    "",
    `webhook        ${env.GITHUB_WEBHOOK_SECRET ? "configured" : "NOT configured — updates wait for cron"}`,
    `github token   ${env.GITHUB_TOKEN ? "set" : "not set — 60 req/hr unauthenticated"}`,
    `lazy sync      after ${LAZY_SYNC_AFTER_MS / 3600000}h, throttled to once per ${LAZY_SYNC_THROTTLE_MS / 60000}m per isolate`,
    "",
    "The request path never writes to KV. Syncs happen on webhook delivery and",
    "on cron; a sync that finds nothing new writes nothing.",
    "",
    `generated in ${Date.now() - started}ms`,
  );

  return text(lines.join("\n"));
}

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

async function handleProject(request, env, origin, name) {
  if (name !== PROJECT) return text("Not found", 404);
  if (!isAllowedOrigin(origin)) return text("Forbidden", 403);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!withinRateLimit(ip)) {
    return new Response("Rate limited", { status: 429, headers: corsHeaders(origin) });
  }

  let record = await readRecord(env);

  if (shouldLazySync(record)) {
    try {
      record = (await sync(env, record)).record;
    } catch (error) {
      // Stale data beats no data; only a cold cache turns this into a failure.
      if (!record) return text("Upstream fetch failed", 502);
      console.error("lazy sync failed:", error.message);
    }
  }

  if (!record) return text("No data", 503);

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
    try {
      await sync(env, await readRecord(env));
    } catch (error) {
      console.error("scheduled sync failed:", error.message);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return handlePreflight(origin);
    if (path === "/hooks/github") return handleWebhook(request, env, ctx);
    if (path === "/admin-panel") return renderAdminPanel(env);

    const name = url.searchParams.get("project");
    if (!name) return text("logger — nothing to see here.\n\n/admin-panel for status.");

    return handleProject(request, env, origin, name);
  },
};
