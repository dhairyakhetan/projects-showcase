// Cloudflare Worker — syncs upstream data once/day per project into KV,
// serves it to the portfolio front-end. Redeploy after edits; bind KV as STATS_KV.
//
// Deployed at: https://logger.dhairyaplayz97.workers.dev
// This file is a committed reference copy of the deployed source. Editing it
// here does NOT deploy anything — push to Cloudflare separately.
//
// NOTE: PROJECTS.showcase still fetches /users/dipdagod/repos while the GitHub
// account is now `dhairyakhetan`. It keeps working only because GitHub 301s
// renamed accounts on the API. Worth fixing on the next worker deploy.

const ALLOWED_ORIGINS = new Set([
  "https://dhairyakhetan.github.io",
  "https://dhairyakhetan-projects.vercel.app",
]);
const SYNC_INTERVAL_SECONDS = 24 * 60 * 60;

const RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 60;

const PROJECTS = {
  trophies: {
    upstreamHost: "https://www.messivsronaldo.app",
    paths: {
      ronaldo: "/page-data/match-histories/ronaldo-match-history/page-data.json",
      messi: "/page-data/match-histories/messi-match-history/page-data.json",
    },
  },

  showcase: {
    upstreamHost: "https://api.github.com",
    paths: {
      repos: "/users/dipdagod/repos?per_page=100&sort=updated",
    },
    resolveOgImages: true,
  },
};

function syncIntervalFor(project) {
  return project.syncIntervalSeconds ?? SYNC_INTERVAL_SECONDS;
}

async function computeEtag(body) {
  const bytes = new TextEncoder().encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-1", bytes);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

// Decision only needs the read; the write is deferred via waitUntil and
// skipped once already over limit, so abuse costs one write per window.
async function checkRateLimit(env, ctx, ip) {
  const key = `rate:${ip}`;
  const now = Date.now();
  const entry = await env.STATS_KV.get(key, "json");

  if (!entry || (now - entry.windowStart) > RATE_WINDOW_SECONDS * 1000) {
    ctx.waitUntil(
      env.STATS_KV.put(key, JSON.stringify({ windowStart: now, count: 1 }), {
        expirationTtl: RATE_WINDOW_SECONDS * 2,
      })
    );
    return true;
  }

  const count = entry.count + 1;
  const withinLimit = count <= RATE_LIMIT;

  if (withinLimit) {
    ctx.waitUntil(
      env.STATS_KV.put(key, JSON.stringify({ windowStart: entry.windowStart, count }), {
        expirationTtl: RATE_WINDOW_SECONDS * 2,
      })
    );
  }

  return withinLimit;
}

// History kept under one KV key so a sync is always one read + one write,
// regardless of repo count.
const MAX_VERSIONS = 3;

async function resolveOgImage(homepage) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(homepage, {
      headers: { "User-Agent": "logger-worker" },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();

    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (!match) return null;

    let ogImage = match[1];
    if (ogImage.startsWith("/")) {
      ogImage = new URL(ogImage, homepage).toString();
    }
    return ogImage;
  } catch {
    return null;
  }
}

// og:image is the only field ever reused from cache, and only when
// repo.homepage is unchanged — every other field always comes from fresh data.
async function mergeWithPreviousVersion(previous, freshRepos) {
  const prevMap = new Map((previous?.repos || []).map(r => [r.id, r]));
  let crawledCount = 0;

  const repos = await Promise.all(freshRepos.map(async (repo) => {
    const prev = prevMap.get(repo.id);
    const homepageUnchanged = prev && prev.homepage === repo.homepage;

    let ogImage = null;
    if (repo.homepage) {
      if (homepageUnchanged) {
        ogImage = prev.ogImage;
      } else {
        ogImage = await resolveOgImage(repo.homepage);
        crawledCount++;
      }
    }

    return { ...repo, ogImage };
  }));

  return { repos, changedCount: crawledCount };
}

function requestHeaders(env, project) {
  const headers = { "User-Agent": "logger-worker" };

  // Token is GitHub-only — never attached to other upstreams.
  if (project.upstreamHost === "https://api.github.com" && env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${env.GITHUB_TOKEN}`;
  }

  return headers;
}

async function runSync(env, projectKey, project) {
  const kvKey = `data:${projectKey}`;

  const entries = Object.entries(project.paths);
  const responses = await Promise.all(
    entries.map(([, path]) =>
      fetch(project.upstreamHost + path, { headers: requestHeaders(env, project) })
    )
  );

  // Never cache/serve an upstream error body as if it were real data.
  const failed = responses.find(r => !r.ok);
  if (failed) {
    throw new Error(`Upstream returned ${failed.status} for ${failed.url}`);
  }

  const packaged = {};
  for (let i = 0; i < entries.length; i++) {
    const [subKey] = entries[i];
    packaged[subKey] = await responses[i].json();
  }

  let payload = entries.length === 1
    ? packaged[entries[0][0]]
    : packaged;

  let changedCount = null;
  if (project.resolveOgImages && Array.isArray(payload)) {
    const versionsKey = `versions:${projectKey}`;

    let versions = [];
    try {
      const parsed = await env.STATS_KV.get(versionsKey, "json");
      if (Array.isArray(parsed)) versions = parsed;
    } catch {
      versions = [];
    }

    const previous = versions[0] && Array.isArray(versions[0].repos) ? versions[0] : null;

    const result = await mergeWithPreviousVersion(previous, payload);
    payload = result.repos;
    changedCount = result.changedCount;

    const newVersion = {
      version: (previous?.version ?? 0) + 1,
      fetchedAt: Date.now(),
      repos: payload,
    };

    versions = [newVersion, ...versions].slice(0, MAX_VERSIONS);
    await env.STATS_KV.put(versionsKey, JSON.stringify(versions));
  }

  const body = JSON.stringify(payload);
  const etag = await computeEtag(body);

  // payloadIsArray lets future reads skip re-parsing body just to check it.
  const record = {
    body,
    fetchedAt: Date.now(),
    status: 200,
    changed: changedCount,
    etag,
    payloadIsArray: Array.isArray(payload),
  };

  await env.STATS_KV.put(kvKey, JSON.stringify(record));
  return record;
}

async function getCachedRecord(env, projectKey, project) {
  const record = await env.STATS_KV.get(`data:${projectKey}`, "json");
  if (!record) return null;
  if (project.resolveOgImages && !record.payloadIsArray) return null;
  return record;
}

async function syncProject(env, projectKey, project, cached) {
  if (cached && (Date.now() - cached.fetchedAt) < syncIntervalFor(project) * 1000) {
    return { record: cached, refreshed: false };
  }

  try {
    const record = await runSync(env, projectKey, project);
    return { record, refreshed: true };
  } catch (err) {
    if (cached) return { record: cached, refreshed: false };
    throw err;
  }
}

async function trackRequest(env, projectKey, refreshed) {
  const reqKey = `reqs:${projectKey}`;

  if (refreshed) {
    await env.STATS_KV.put(reqKey, "0");
    return;
  }

  const current = (await env.STATS_KV.get(reqKey, "json")) ?? 0;
  await env.STATS_KV.put(reqKey, String(current + 1));
}

function formatTimestamp(ms) {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";
}

function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatInterval(seconds) {
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

async function renderAdminPanel(env) {
  const projectKeys = Object.keys(PROJECTS);

  const [rows, allKeys] = await Promise.all([
    Promise.all(projectKeys.map(async (projectKey) => {
      const project = PROJECTS[projectKey];
      const syncIntervalSeconds = syncIntervalFor(project);

      const [record, reqsSinceFetch] = await Promise.all([
        env.STATS_KV.get(`data:${projectKey}`, "json"),
        env.STATS_KV.get(`reqs:${projectKey}`, "json"),
      ]);

      if (!record) {
        return { projectKey, state: "NEVER_FETCHED", reqsSinceFetch: reqsSinceFetch ?? 0, syncIntervalSeconds };
      }

      const ageMs = Date.now() - record.fetchedAt;
      const errored = record.status && record.status >= 400;
      const stale = ageMs > syncIntervalSeconds * 1000;

      return {
        projectKey,
        fetchedAt: record.fetchedAt,
        ageMs,
        status: record.status,
        state: errored ? "ERROR" : stale ? "STALE" : "OK",
        reqsSinceFetch: reqsSinceFetch ?? 0,
        syncIntervalSeconds,
        changed: record.changed,
      };
    })),
    env.STATS_KV.list()
      .then(list => list.keys.map(k => k.name))
      .catch(err => [`(couldn't list KV: ${err.message})`]),
  ]);

  const stateColor = { OK: "#3fb950", STALE: "#d29922", ERROR: "#f85149", NEVER_FETCHED: "#888" };

  const expectedKeys = projectKeys
    .flatMap(k => [`data:${k}`, `reqs:${k}`])
    .join(", ");

  const html = `<!DOCTYPE html>
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
    <tr><th>project</th><th>sync interval</th><th>last synced</th><th>age</th><th>upstream status</th><th>state</th><th>requests since fetch</th><th>og crawls</th></tr>
    ${rows.map(r => `
    <tr>
      <td>${r.projectKey}</td>
      <td>${formatInterval(r.syncIntervalSeconds)}</td>
      <td style="white-space:nowrap;">${r.fetchedAt ? formatTimestamp(r.fetchedAt) : "—"}</td>
      <td>${r.ageMs != null ? formatAge(r.ageMs) : "—"}</td>
      <td>${r.status ?? "—"}</td>
      <td style="color:${stateColor[r.state]};font-weight:bold;">${r.state}</td>
      <td>${r.reqsSinceFetch}</td>
      <td>${r.changed == null ? "—" : (r.changed === 0 ? "none" : r.changed)}</td>
    </tr>`).join("")}
  </table>

  <h3>raw KV keys (ground truth — expected: ${expectedKeys})</h3>
  <ul>
    ${allKeys.length ? allKeys.map(k => `<li>${k}</li>`).join("") : "<li>(no keys found in this namespace at all)</li>"}
  </ul>
</body>
</html>`;

  return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
}

const PLACEHOLDER_PAGE = `<!DOCTYPE html>
<html>
<head><title>watsup?</title><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0c0c;">
  <h1 style="color:#f0ede6;font-family:sans-serif;font-size:4vw;text-align:center;">NOTHING TO LOOK AT HERE</h1>
</body>
</html>`;

// Inert until a cron trigger is added in wrangler.toml.
async function scheduled(event, env, ctx) {
  await Promise.all(
    Object.entries(PROJECTS).map(async ([projectKey, project]) => {
      try {
        await runSync(env, projectKey, project);
      } catch (err) {
        console.error(`scheduled sync failed for ${projectKey}:`, err.message);
      }
    })
  );
}

export default {
  scheduled,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "GET",
          "access-control-allow-headers": "If-None-Match",
          "access-control-max-age": "86400",
          "vary": "Origin",
        },
      });
    }

    if (url.pathname === "/admin-panel" || url.pathname === "/admin-panel/") {
      return renderAdminPanel(env);
    }

    const projectKey = url.searchParams.get("project");

    if (!projectKey) {
      return new Response(PLACEHOLDER_PAGE, { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    const project = PROJECTS[projectKey];
    if (!project) return new Response("Not found", { status: 404 });

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // Independent KV keys — read in parallel instead of serially.
    const [withinLimit, cached] = await Promise.all([
      checkRateLimit(env, ctx, ip),
      getCachedRecord(env, projectKey, project),
    ]);

    if (!withinLimit) {
      return new Response("Rate limited", {
        status: 429,
        headers: { "access-control-allow-origin": origin, "vary": "Origin" },
      });
    }

    let syncResult;
    try {
      syncResult = await syncProject(env, projectKey, project, cached);
    } catch (err) {
      return new Response("Upstream fetch failed", { status: 502 });
    }

    ctx.waitUntil(trackRequest(env, projectKey, syncResult.refreshed));

    const { record } = syncResult;
    const cacheControl = `public, max-age=${syncIntervalFor(project)}`;

    const ifNoneMatch = request.headers.get("If-None-Match");
    if (record.etag && ifNoneMatch === record.etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-expose-headers": "ETag",
          "etag": record.etag,
          "cache-control": cacheControl,
          "vary": "Origin",
        },
      });
    }

    return new Response(record.body, {
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": origin,
        "access-control-expose-headers": "ETag",
        ...(record.etag ? { "etag": record.etag } : {}),
        "cache-control": cacheControl,
        "vary": "Origin",
      },
    });
  },
};
