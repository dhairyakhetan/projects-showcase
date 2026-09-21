/**
 * logger — syncs upstream data into KV once a day per project and serves it to
 * the portfolio front-end.
 *
 * Bind a KV namespace as STATS_KV. Optionally set GITHUB_TOKEN to raise the
 * GitHub API rate limit. Deploy with `wrangler deploy` from this directory.
 */

// ---------------------------------------------------------------- config ----

const ALLOWED_ORIGINS = new Set([
  "https://dhairyakhetan.github.io",
  "https://dhairyakhetan-projects.vercel.app",
]);

const SYNC_INTERVAL_SECONDS = 24 * 60 * 60;
const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;
const OG_FETCH_TIMEOUT_MS = 5000;
const MAX_VERSIONS = 3;

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
  },
};

const syncIntervalFor = project => project.syncIntervalSeconds ?? SYNC_INTERVAL_SECONDS;

// --------------------------------------------------------------- kv keys ----

const kv = {
  data: project => `data:${project}`,
  versions: project => `versions:${project}`,
  reqs: project => `reqs:${project}`,
  rate: ip => `rate:${ip}`,
};

/** KV reads that must never throw on malformed JSON. */
async function readJson(env, key, fallback = null) {
  try {
    return (await env.STATS_KV.get(key, "json")) ?? fallback;
  } catch {
    return fallback;
  }
}

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

// ------------------------------------------------------------ rate limit ----

/**
 * Fixed window per IP.
 *
 * The decision only needs the read; the write is deferred through waitUntil and
 * skipped once already over the limit, so sustained abuse costs one write per
 * window rather than one per request.
 */
async function withinRateLimit(env, ctx, ip) {
  const key = kv.rate(ip);
  const now = Date.now();
  const entry = await readJson(env, key);

  const expired = !entry || now - entry.windowStart > RATE_WINDOW_SECONDS * 1000;
  const window = expired ? { windowStart: now, count: 1 } : { ...entry, count: entry.count + 1 };
  const allowed = expired || window.count <= RATE_LIMIT;

  if (allowed) {
    ctx.waitUntil(
      env.STATS_KV.put(key, JSON.stringify(window), {
        expirationTtl: RATE_WINDOW_SECONDS * 2,
      }),
    );
  }

  return allowed;
}

// -------------------------------------------------------------- og images ----

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
 * Attaches an og:image to each repo.
 *
 * This is the only field ever reused from the previous version, and only while
 * `homepage` is unchanged — every other field always comes from fresh data.
 * Without that reuse, a daily sync would re-crawl every project's site.
 */
async function attachOgImages(previous, repos) {
  const seen = new Map((previous?.repos ?? []).map(repo => [repo.id, repo]));
  let crawled = 0;

  const withImages = await Promise.all(
    repos.map(async repo => {
      if (!repo.homepage) return { ...repo, ogImage: null };

      const cached = seen.get(repo.id);
      if (cached && cached.homepage === repo.homepage) {
        return { ...repo, ogImage: cached.ogImage };
      }

      crawled++;
      return { ...repo, ogImage: await resolveOgImage(repo.homepage) };
    }),
  );

  return { repos: withImages, crawled };
}

// ------------------------------------------------------------------ sync ----

async function computeEtag(body) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  return `"${hex}"`;
}

function upstreamHeaders(env, project) {
  const headers = { "User-Agent": "logger-worker" };

  // Token is GitHub-only — never attached to another upstream.
  if (project.upstreamHost === GITHUB_API && env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function fetchUpstream(env, project) {
  const entries = Object.entries(project.paths);

  const responses = await Promise.all(
    entries.map(([, path]) =>
      fetch(project.upstreamHost + path, { headers: upstreamHeaders(env, project) }),
    ),
  );

  const failed = responses.find(response => !response.ok);
  if (failed) {
    // Never cache or serve an upstream error body as if it were real data.
    throw new Error(`upstream ${failed.status} for ${failed.url}`);
  }

  const payloads = await Promise.all(responses.map(response => response.json()));

  // A single-path project serves its payload bare; multi-path projects serve a
  // keyed object, so the front-end doesn't have to know which shape to expect.
  return entries.length === 1
    ? payloads[0]
    : Object.fromEntries(entries.map(([key], index) => [key, payloads[index]]));
}

async function runSync(env, name, project) {
  let payload = await fetchUpstream(env, project);
  let crawled = null;

  if (project.resolveOgImages && Array.isArray(payload)) {
    const versions = (await readJson(env, kv.versions(name), [])) ?? [];
    const previous = Array.isArray(versions[0]?.repos) ? versions[0] : null;

    const result = await attachOgImages(previous, payload);
    payload = result.repos;
    crawled = result.crawled;

    const next = [
      { version: (previous?.version ?? 0) + 1, fetchedAt: Date.now(), repos: payload },
      ...versions,
    ].slice(0, MAX_VERSIONS);

    await env.STATS_KV.put(kv.versions(name), JSON.stringify(next));
  }

  const body = JSON.stringify(payload);

  const record = {
    body,
    etag: await computeEtag(body),
    fetchedAt: Date.now(),
    status: 200,
    changed: crawled,
    payloadIsArray: Array.isArray(payload),
  };

  await env.STATS_KV.put(kv.data(name), JSON.stringify(record));
  return record;
}

async function readCachedRecord(env, name, project) {
  const record = await readJson(env, kv.data(name));
  if (!record) return null;

  // A record written before og:image resolution was enabled has the wrong
  // shape for this project; treat it as absent so the next read re-syncs.
  if (project.resolveOgImages && !record.payloadIsArray) return null;

  return record;
}

async function syncIfStale(env, name, project, cached) {
  const fresh = cached && Date.now() - cached.fetchedAt < syncIntervalFor(project) * 1000;
  if (fresh) return { record: cached, refreshed: false };

  try {
    return { record: await runSync(env, name, project), refreshed: true };
  } catch (error) {
    // Stale data beats no data. Only a cold cache turns an upstream failure
    // into a failed request.
    if (cached) return { record: cached, refreshed: false };
    throw error;
  }
}

/** Requests served off cache since the last real sync — a cheap cache-hit gauge. */
async function trackRequest(env, name, refreshed) {
  if (refreshed) return env.STATS_KV.put(kv.reqs(name), "0");

  const current = (await readJson(env, kv.reqs(name), 0)) ?? 0;
  return env.STATS_KV.put(kv.reqs(name), String(current + 1));
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

function formatInterval(seconds) {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

const STATE_COLORS = {
  OK: "#3fb950",
  STALE: "#d29922",
  ERROR: "#f85149",
  NEVER_FETCHED: "#888",
};

async function projectStatus(env, name) {
  const project = PROJECTS[name];
  const interval = syncIntervalFor(project);

  const [record, reqs] = await Promise.all([
    readJson(env, kv.data(name)),
    readJson(env, kv.reqs(name), 0),
  ]);

  if (!record) {
    return { name, state: "NEVER_FETCHED", reqs: reqs ?? 0, interval };
  }

  const age = Date.now() - record.fetchedAt;
  const errored = record.status >= 400;

  return {
    name,
    interval,
    age,
    reqs: reqs ?? 0,
    fetchedAt: record.fetchedAt,
    status: record.status,
    changed: record.changed,
    state: errored ? "ERROR" : age > interval * 1000 ? "STALE" : "OK",
  };
}

async function renderAdminPanel(env) {
  const names = Object.keys(PROJECTS);

  const [rows, keys] = await Promise.all([
    Promise.all(names.map(name => projectStatus(env, name))),
    env.STATS_KV.list()
      .then(list => list.keys.map(key => key.name))
      .catch(error => [`(couldn't list KV: ${error.message})`]),
  ]);

  const expected = names.flatMap(name => [kv.data(name), kv.reqs(name)]).join(", ");

  const body = rows
    .map(
      row => `
    <tr>
      <td>${row.name}</td>
      <td>${formatInterval(row.interval)}</td>
      <td style="white-space:nowrap;">${row.fetchedAt ? formatTimestamp(row.fetchedAt) : "—"}</td>
      <td>${row.age == null ? "—" : formatAge(row.age)}</td>
      <td>${row.status ?? "—"}</td>
      <td style="color:${STATE_COLORS[row.state]};font-weight:bold;">${row.state}</td>
      <td>${row.reqs}</td>
      <td>${row.changed == null ? "—" : row.changed === 0 ? "none" : row.changed}</td>
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
  ul{ font-size:.82rem; color:#aaa; padding-left:18px; }
</style>
</head>
<body>
  <h2>logger — admin panel</h2>
  <p>generated ${formatTimestamp(Date.now())}</p>
  <table>
    <tr>
      <th>project</th><th>sync interval</th><th>last synced</th><th>age</th>
      <th>upstream status</th><th>state</th><th>requests since fetch</th><th>og crawls</th>
    </tr>
    ${body}
  </table>

  <h3>raw KV keys (ground truth — expected: ${expected})</h3>
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
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });

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
  if (!ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // Independent KV keys — read in parallel rather than serially.
  const [allowed, cached] = await Promise.all([
    withinRateLimit(env, ctx, ip),
    readCachedRecord(env, name, project),
  ]);

  if (!allowed) {
    return new Response("Rate limited", { status: 429, headers: corsHeaders(origin) });
  }

  let result;
  try {
    result = await syncIfStale(env, name, project, cached);
  } catch {
    return new Response("Upstream fetch failed", { status: 502 });
  }

  ctx.waitUntil(trackRequest(env, name, result.refreshed));

  const { record } = result;
  const headers = corsHeaders(origin, {
    "cache-control": `public, max-age=${syncIntervalFor(project)}`,
    ...(record.etag ? { etag: record.etag } : {}),
  });

  if (record.etag && request.headers.get("If-None-Match") === record.etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(record.body, {
    headers: { ...headers, "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------- export ----

export default {
  /** Inert until a cron trigger exists in wrangler.toml. */
  async scheduled(event, env) {
    await Promise.all(
      Object.entries(PROJECTS).map(async ([name, project]) => {
        try {
          await runSync(env, name, project);
        } catch (error) {
          console.error(`scheduled sync failed for ${name}:`, error.message);
        }
      }),
    );
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return handlePreflight(origin);

    if (url.pathname.replace(/\/$/, "") === "/admin-panel") {
      return renderAdminPanel(env);
    }

    const name = url.searchParams.get("project");
    if (!name) return html(PLACEHOLDER_PAGE);

    return handleProject(request, env, ctx, origin, name);
  },
};
