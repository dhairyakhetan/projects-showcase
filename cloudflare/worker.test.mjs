/**
 * Worker test suite. Run with:  node cloudflare/worker.test.mjs
 *
 * No dependencies and no network. Each scenario builds its own in-memory KV
 * and stubs global fetch, then asserts on COUNTED operations — KV reads, KV
 * writes, upstream requests — because the worker's whole design is about
 * keeping those numbers low, so the numbers are what has to be checked.
 *
 * Every scenario also re-imports the worker fresh. It keeps per-isolate state
 * (rate-limit buckets, the lazy-sync throttle) that would otherwise leak
 * between tests and make results order-dependent.
 */

const WORKER_PATH = new URL("./worker.js", import.meta.url).pathname;
let TOTAL_FAILURES = 0;

import { pathToFileURL } from "node:url";
import { promises as nodeFs } from "node:fs";

let moduleSeq = 0;
const WORKER_SOURCE = await nodeFs.readFile(WORKER_PATH, "utf8");

/** A fresh module instance, so per-isolate state never leaks between tests. */
async function importFreshWorker() {
  const url =
    "data:text/javascript;base64," +
    Buffer.from(`${WORKER_SOURCE}\n//${moduleSeq++}`).toString("base64");
  return (await import(url)).default;
}

/** Alias, since the suites below call it by this name. */
const freshWorker = importFreshWorker;

// ═══════════════════════════════════════════════════════════════════════════
await (async function suite() {
  console.log("\n━━━ core behaviour and operation counts");
  // Counts every KV op and upstream call. The point of the rewrite is the
  // counts, so the counts are what gets asserted.
  const store = new Map();
  const ops = { reads: 0, writes: 0 };
  const upstream = { github: 0, conditional: 0, notModified: 0, og: 0 };

  const env = {
    GITHUB_WEBHOOK_SECRET: "s3cret",
    STATS_KV: {
      async get(k, t) { ops.reads++; const v = store.get(k); return v === undefined ? null : (t === "json" ? JSON.parse(v) : v); },
      async put(k, v) { ops.writes++; store.set(k, v); },
      async list() { return { keys: [...store.keys()].map(name => ({ name })) }; },
    },
  };
  const ctx = { waitUntil: p => (pending.push(p), p.catch(() => {})) };
  let pending = [];
  const settle = async () => { await Promise.all(pending); pending = []; };
  const ORIGIN = "https://dhairyakhetan.vercel.app";

  let repoEtag = '"v1"';
  let repos = [
    { id: 1, name: "trophies", homepage: "https://example.com/t", language: "HTML", fork: false },
    { id: 2, name: "dotfiles", homepage: null, language: "Shell", fork: false },
  ];

  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith("https://api.github.com")) {
      upstream.github++;
      const inm = init?.headers?.["If-None-Match"];
      if (inm) upstream.conditional++;
      if (inm === repoEtag) { upstream.notModified++; return new Response(null, { status: 304, headers: { etag: repoEtag } }); }
      return new Response(JSON.stringify(repos), { status: 200, headers: { etag: repoEtag } });
    }
    if (u.startsWith("https://www.messivsronaldo.app")) {
      return new Response(JSON.stringify({ result: { data: { ok: true } }, componentChunkName: "x" }),
        { status: 200, headers: { etag: '"t1"' } });
    }
    if (u.startsWith("https://example.com")) {
      upstream.og++;
      return new Response(`<meta property="og:image" content="/card.png">`, { status: 200 });
    }
    return new Response("nope", { status: 500 });
  };

  const worker = await freshWorker();
  let ipSeq = 0;
  const req = (o = {}) => new Request(o.url ?? "https://w.dev/?project=showcase",
    { method: o.method ?? "GET",
      headers: o.headers ?? { Origin: ORIGIN, "CF-Connecting-IP": o.ip ?? `10.0.0.${++ipSeq % 250}` },
      body: o.body });

  let fails = 0;
  const check = (l, ok, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${x ? " — " + x : ""}`); };
  const reset = () => { ops.reads = 0; ops.writes = 0; upstream.github = 0; upstream.conditional = 0; upstream.notModified = 0; upstream.og = 0; };

  // --- cold start -------------------------------------------------------------
  reset();
  const cold = await worker.fetch(req(), env, ctx);
  check("cold fetch 200", cold.status === 200);
  check("cold: 1 github call", upstream.github === 1, `${upstream.github}`);
  check("cold: og crawled once", upstream.og === 1, `${upstream.og}`);
  check("cold: 1 KV write", ops.writes === 1, `${ops.writes}`);
  const etag = cold.headers.get("etag");
  const body = await cold.json();
  check("ogImage resolved absolute", body[0].ogImage === "https://example.com/card.png", body[0].ogImage);

  // --- THE HEADLINE: steady-state request cost --------------------------------
  reset();
  for (let i = 0; i < 50; i++) await worker.fetch(req(), env, ctx);
  check("50 requests → ZERO KV writes", ops.writes === 0, `${ops.writes} writes`);
  check("50 requests → 50 KV reads (1 each)", ops.reads === 50, `${ops.reads} reads`);
  check("50 requests → ZERO upstream calls", upstream.github === 0, `${upstream.github}`);

  // --- client revalidation ----------------------------------------------------
  reset();
  const cond = await worker.fetch(req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.9.9.9", "If-None-Match": etag } }), env, ctx);
  check("client If-None-Match → 304", cond.status === 304);
  check("304 costs no write", ops.writes === 0);

  // --- cron with nothing changed ---------------------------------------------
  // Warm every project first: a project's first-ever sync legitimately writes,
  // and the claim under test is about the steady state.
  await worker.scheduled({}, env);
  reset();
  await worker.scheduled({}, env);
  check("cron: conditional request sent", upstream.conditional >= 1, `${upstream.conditional}`);
  check("cron: upstream answered 304", upstream.notModified >= 1, `${upstream.notModified}`);
  check("cron: unchanged → ZERO KV writes", ops.writes === 0, `${ops.writes}`);
  check("cron: unchanged → no og re-crawl", upstream.og === 0, `${upstream.og}`);

  // --- a real change ----------------------------------------------------------
  repos = [...repos, { id: 3, name: "new-thing", homepage: null, language: "Go", fork: false }];
  repoEtag = '"v2"';
  reset();
  await worker.scheduled({}, env);
  check("changed: 1 KV write", ops.writes === 1, `${ops.writes}`);
  check("changed: no og crawl for repo without homepage", upstream.og === 0, `${upstream.og}`);
  const after = await (await worker.fetch(req(), env, ctx)).json();
  check("new repo served", after.length === 3, `${after.length} repos`);
  check("existing ogImage reused, not re-crawled", after[0].ogImage === "https://example.com/card.png");

  // --- webhook ----------------------------------------------------------------
  async function sign(secret, payload) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return "sha256=" + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  const payload = JSON.stringify({ repository: { owner: { login: "dhairyakhetan" } } });
  const bad = await worker.fetch(new Request("https://w.dev/hooks/github",
    { method: "POST", body: payload, headers: { "X-Hub-Signature-256": "sha256=deadbeef", "X-GitHub-Event": "push" } }), env, ctx);
  check("webhook rejects bad signature", bad.status === 401, `${bad.status}`);

  repos = [...repos, { id: 4, name: "pushed-just-now", homepage: null, language: "Rust", fork: false }];
  repoEtag = '"v3"';
  reset();
  const hook = await worker.fetch(new Request("https://w.dev/hooks/github",
    { method: "POST", body: payload,
      headers: { "X-Hub-Signature-256": await sign("s3cret", payload), "X-GitHub-Event": "push" } }), env, ctx);
  check("webhook accepts valid signature", hook.status === 202, `${hook.status}`);
  await settle();
  const live = await (await worker.fetch(req(), env, ctx)).json();
  check("webhook synced the new repo immediately", live.some(r => r.name === "pushed-just-now"));

  // --- origin + routing -------------------------------------------------------
  check("no origin blocked", (await worker.fetch(req({ headers: {} }), env, ctx)).status === 403);
  check("wrong origin blocked", (await worker.fetch(req({ headers: { Origin: "https://evil.test" } }), env, ctx)).status === 403);
  check("unknown project 404", (await worker.fetch(req({ url: "https://w.dev/?project=nope" }), env, ctx)).status === 404);
  check("admin panel 200", (await worker.fetch(req({ url: "https://w.dev/admin-panel" }), env, ctx)).status === 200);

  // --- rate limit is free -----------------------------------------------------
  reset();
  const codes = [];
  for (let i = 0; i < 125; i++) codes.push((await worker.fetch(req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7" } }), env, ctx)).status);
  check("rate limit trips at 120", codes.filter(c => c === 429).length === 5, `${codes.filter(c => c === 429).length} blocked of 125`);
  check("rate limiting costs no KV writes", ops.writes === 0, `${ops.writes}`);

  // --- upstream failure with warm cache --------------------------------------
  globalThis.fetch = async () => new Response("boom", { status: 503 });
  reset();
  await worker.scheduled({}, env);
  check("dead upstream → no write, cache intact", ops.writes === 0);
  check("still serves cached data", (await worker.fetch(req(), env, ctx)).status === 200);



  console.log(fails ? `  → ${fails} failure(s)` : "  → all passed");
  TOTAL_FAILURES += fails;
})();

// ═══════════════════════════════════════════════════════════════════════════
await (async function suite() {
  console.log("\n━━━ payload edge cases");
  // Edge cases for the payload path. Each scenario rebuilds the world so
  // failures don't cascade.
  const ORIGIN = "https://dhairyakhetan.vercel.app";
  let fails = 0;
  const check = (l, ok, x = "") => { if (!ok) fails++; console.log(`  ${ok ? "pass" : "FAIL"}  ${l}${x ? " — " + x : ""}`); };
  const section = t => console.log(`\n── ${t}`);

  function makeWorld() {
    const store = new Map();
    const ops = { reads: 0, writes: 0, byKey: {} };
    const calls = { gh: 0, ghConditional: 0, ghNotModified: 0, og: 0, trophies: 0, trophiesNotModified: 0 };
    return {
      store, ops, calls,
      env: {
        GITHUB_WEBHOOK_SECRET: "s3cret",
        STATS_KV: {
          async get(k, t) { ops.reads++; const v = store.get(k); return v === undefined ? null : (t === "json" ? JSON.parse(v) : v); },
          async put(k, v) { ops.writes++; ops.byKey[k] = (ops.byKey[k] ?? 0) + 1; store.set(k, v); },
          async list() { return { keys: [...store.keys()].map(name => ({ name })) }; },
        },
      },
    };
  }

  const ctx = { waitUntil: p => p.catch(() => {}) };
  const req = (o = {}) => new Request(o.url ?? "https://w.dev/?project=showcase",
    { method: o.method ?? "GET",
      headers: o.headers ?? { Origin: ORIGIN, "CF-Connecting-IP": o.ip ?? `10.1.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` } });

  // Fresh module instance per scenario: the worker keeps per-isolate state
  // (rate limits, lazy-sync throttle) that would otherwise leak between tests.

  // ── 1. 304 with an empty cache must not store an empty payload ──────────────
  section("upstream 304s but nothing is cached");
  {
    const w = makeWorld();
    let served = 0;
    globalThis.fetch = async (u, init) => {
      if (String(u).includes("api.github.com")) {
        w.calls.gh++;
        // Misbehaving upstream: 304s even with no If-None-Match sent.
        if (!init?.headers?.["If-None-Match"] && served++ === 0) {
          return new Response(null, { status: 304 });
        }
        return new Response(JSON.stringify([{ id: 1, name: "a", homepage: null }]),
          { status: 200, headers: { etag: '"x"' } });
      }
      return new Response(JSON.stringify({ result: { data: { ok: 1 } } }), { status: 200, headers: { etag: '"t"' } });
    };
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    const text = await res.clone().text();
    check("does not serve an empty body", text.length > 0 && text !== "undefined", `body: ${JSON.stringify(text.slice(0, 40))}`);
    check("recovered by refetching unconditionally", res.status === 200, `${res.status}`);
    const stored = JSON.parse(w.store.get("data:showcase") ?? "{}");
    check("stored body is a real payload", typeof stored.body === "string" && stored.body.startsWith("["), `${typeof stored.body}`);
  }

  // ── 2. persistent 304 with no cache must fail loudly, not loop ──────────────
  section("upstream 304s forever with nothing cached");
  {
    const w = makeWorld();
    globalThis.fetch = async () => new Response(null, { status: 304 });
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    check("fails with 502 rather than hanging or empty-writing", res.status === 502, `${res.status}`);
    check("wrote nothing", w.ops.writes === 0, `${w.ops.writes} writes`);
  }

  // ── 3. og TTL fires even when upstream reports no change ────────────────────
  section("og entry expires while upstream is unchanged");
  {
    const w = makeWorld();
    let ghEtag = '"v1"';
    globalThis.fetch = async (u, init) => {
      const s = String(u);
      if (s.includes("api.github.com")) {
        w.calls.gh++;
        const inm = init?.headers?.["If-None-Match"];
        if (inm) w.calls.ghConditional++;
        if (inm === ghEtag) { w.calls.ghNotModified++; return new Response(null, { status: 304 }); }
        return new Response(JSON.stringify([{ id: 1, name: "site", homepage: "https://ex.com" }]),
          { status: 200, headers: { etag: ghEtag } });
      }
      if (s.startsWith("https://ex.com")) {
        w.calls.og++;
        return new Response(`<meta property="og:image" content="/i-${w.calls.og}.png">`, { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("first sync crawls og once", w.calls.og === 1, `${w.calls.og}`);

    // Age the og entry past the 7-day hit TTL.
    const rec = JSON.parse(w.store.get("data:showcase"));
    rec.og["1"].checkedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    w.store.set("data:showcase", JSON.stringify(rec));

    w.calls.og = 0; w.ops.writes = 0;
    await worker.scheduled({}, w.env);
    check("upstream answered 304", w.calls.ghNotModified >= 1, `${w.calls.ghNotModified}`);
    check("og re-crawled despite the 304", w.calls.og === 1, `${w.calls.og} crawls`);
    check("refreshed image written", w.ops.writes === 1, `${w.ops.writes} writes`);

    const after = JSON.parse(JSON.parse(w.store.get("data:showcase")).body);
    check("new image is served", after[0].ogImage === "https://ex.com/i-1.png", after[0].ogImage);

    // And a genuinely fresh og entry must NOT be re-crawled.
    w.calls.og = 0; w.ops.writes = 0;
    await worker.scheduled({}, w.env);
    check("fresh og not re-crawled", w.calls.og === 0, `${w.calls.og}`);
    check("no write when truly unchanged", w.ops.writes === 0, `${w.ops.writes}`);
  }

  // ── 4. multi-path partial change must not refetch the unchanged path ────────
  section("one path changes, the other 304s (trophies)");
  {
    const w = makeWorld();
    const etags = { ronaldo: '"r1"', messi: '"m1"' };
    const bodies = {
      ronaldo: { result: { data: { goals: 1 } }, componentChunkName: "junk", staticQueryHashes: [1, 2] },
      messi: { result: { data: { goals: 2 } }, componentChunkName: "junk", staticQueryHashes: [3, 4] },
    };
    globalThis.fetch = async (u, init) => {
      const s = String(u);
      if (s.includes("messivsronaldo")) {
        const key = s.includes("/ronaldo-match-history") ? "ronaldo" : "messi";
        w.calls.trophies++;
        const inm = init?.headers?.["If-None-Match"];
        if (inm === etags[key]) { w.calls.trophiesNotModified++; return new Response(null, { status: 304 }); }
        return new Response(JSON.stringify(bodies[key]), { status: 200, headers: { etag: etags[key] } });
      }
      return new Response(JSON.stringify([]), { status: 200, headers: { etag: '"gh"' } });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);

    const first = JSON.parse(JSON.parse(w.store.get("data:trophies")).body);
    check("transform stripped Gatsby bookkeeping",
      JSON.stringify(first) === JSON.stringify({ ronaldo: { goals: 1 }, messi: { goals: 2 } }),
      JSON.stringify(first));

    // Only ronaldo changes.
    bodies.ronaldo = { result: { data: { goals: 99 } }, componentChunkName: "junk" };
    etags.ronaldo = '"r2"';
    w.calls.trophies = 0; w.calls.trophiesNotModified = 0;
    await worker.scheduled({}, w.env);

    check("exactly two upstream calls, no refetch", w.calls.trophies === 2, `${w.calls.trophies} calls`);
    check("the unchanged path 304'd", w.calls.trophiesNotModified === 1, `${w.calls.trophiesNotModified}`);

    const merged = JSON.parse(JSON.parse(w.store.get("data:trophies")).body);
    check("changed path updated", merged.ronaldo.goals === 99, JSON.stringify(merged.ronaldo));
    check("304'd path preserved from cache", merged.messi.goals === 2, JSON.stringify(merged.messi));
  }

  // ── 5. non-array payload for a project that requires one ────────────────────
  section("GitHub answers 200 with an error object");
  {
    const w = makeWorld();
    w.store.set("data:showcase", JSON.stringify({
      body: JSON.stringify([{ id: 1, name: "good", homepage: null, ogImage: null }]),
      etag: '"good"', upstreamEtags: { repos: '"old"' }, og: {}, fetchedAt: Date.now(), changedAt: Date.now(),
    }));
    globalThis.fetch = async u => String(u).includes("api.github.com")
      ? new Response(JSON.stringify({ message: "Not Found" }), { status: 200, headers: { etag: '"bad"' } })
      : new Response("{}", { status: 200 });
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("garbage not written over good data", (w.ops.byKey["data:showcase"] ?? 0) === 0,
      `${w.ops.byKey["data:showcase"] ?? 0} writes to showcase`);
    const still = JSON.parse(JSON.parse(w.store.get("data:showcase")).body);
    check("good payload still served", Array.isArray(still) && still[0].name === "good");
  }

  // ── 6. corrupt cached body ──────────────────────────────────────────────────
  section("cached record body is unparseable");
  {
    const w = makeWorld();
    w.store.set("data:showcase", JSON.stringify({
      body: "{not json at all", etag: '"e"', upstreamEtags: { repos: '"old"' }, og: {}, fetchedAt: 0,
    }));
    let sentConditional = false;
    globalThis.fetch = async (u, init) => {
      if (String(u).includes("api.github.com")) {
        if (init?.headers?.["If-None-Match"]) sentConditional = true;
        return new Response(JSON.stringify([{ id: 7, name: "recovered", homepage: null }]),
          { status: 200, headers: { etag: '"new"' } });
      }
      return new Response("{}", { status: 200 });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("did not trust the corrupt cache's etag", sentConditional === false);
    const fixed = JSON.parse(JSON.parse(w.store.get("data:showcase")).body);
    check("rebuilt from upstream", fixed[0].name === "recovered", JSON.stringify(fixed));
  }

  // ── 7. repo deleted / homepage changed ──────────────────────────────────────
  section("repo list churn");
  {
    const w = makeWorld();
    let repos = [
      { id: 1, name: "a", homepage: "https://a.com" },
      { id: 2, name: "b", homepage: "https://b.com" },
    ];
    let etag = '"1"';
    globalThis.fetch = async (u, init) => {
      const s = String(u);
      if (s.includes("api.github.com")) {
        if (init?.headers?.["If-None-Match"] === etag) return new Response(null, { status: 304 });
        return new Response(JSON.stringify(repos), { status: 200, headers: { etag } });
      }
      if (s.startsWith("https://a.com") || s.startsWith("https://b.com")) {
        w.calls.og++;
        return new Response(`<meta property="og:image" content="${s}/og.png">`, { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("crawled both", w.calls.og === 2, `${w.calls.og}`);

    repos = [{ id: 1, name: "a", homepage: "https://a.com" }];  // b deleted
    etag = '"2"';
    w.calls.og = 0;
    await worker.scheduled({}, w.env);
    const og = JSON.parse(w.store.get("data:showcase")).og;
    check("deleted repo dropped from og state", !("2" in og), Object.keys(og).join(","));
    check("surviving repo not re-crawled", w.calls.og === 0, `${w.calls.og}`);

    repos = [{ id: 1, name: "a", homepage: "https://moved.com" }];
    etag = '"3"';
    w.calls.og = 0;
    globalThis.fetch = (orig => async (u, init) => {
      if (String(u).startsWith("https://moved.com")) { w.calls.og++; return new Response(`<meta property="og:image" content="https://moved.com/og.png">`, { status: 200 }); }
      return orig(u, init);
    })(globalThis.fetch);
    await worker.scheduled({}, w.env);
    check("moved homepage re-crawled", w.calls.og === 1, `${w.calls.og}`);
    const moved = JSON.parse(JSON.parse(w.store.get("data:showcase")).body);
    check("stale image replaced", moved[0].ogImage === "https://moved.com/og.png", moved[0].ogImage);
  }

  // ── 8. og crawl budget ──────────────────────────────────────────────────────
  section("cold cache with many live projects");
  {
    const w = makeWorld();
    const many = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `p${i}`, homepage: `https://s${i}.com` }));
    globalThis.fetch = async u => {
      const s = String(u);
      if (s.includes("api.github.com")) return new Response(JSON.stringify(many), { status: 200, headers: { etag: '"m"' } });
      if (s.startsWith("https://s")) { w.calls.og++; return new Response(`<meta property="og:image" content="${s}/o.png">`, { status: 200 }); }
      return new Response("{}", { status: 200 });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("crawls capped at 8 per sync", w.calls.og === 8, `${w.calls.og} crawls of 20 sites`);
    w.calls.og = 0;
    await worker.scheduled({}, w.env);
    check("next sync makes progress on the rest", w.calls.og === 8, `${w.calls.og}`);
    const covered = Object.values(JSON.parse(w.store.get("data:showcase")).og).filter(e => e.image).length;
    check("16 of 20 resolved after two syncs", covered === 16, `${covered}`);
  }

  // ── 9. upstream without ETag support ────────────────────────────────────────
  section("upstream sends no ETag");
  {
    const w = makeWorld();
    globalThis.fetch = async u => String(u).includes("api.github.com")
      ? new Response(JSON.stringify([{ id: 1, name: "x", homepage: null }]), { status: 200 })
      : new Response("{}", { status: 200 });
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    check("first sync writes", (w.ops.byKey["data:showcase"] ?? 0) === 1, `${w.ops.byKey["data:showcase"] ?? 0}`);
    w.ops.byKey = {};
    await worker.scheduled({}, w.env);
    check("identical body → still no second write", (w.ops.byKey["data:showcase"] ?? 0) === 0, `${w.ops.byKey["data:showcase"] ?? 0}`);
  }



  console.log(fails ? `  → ${fails} failure(s)` : "  → all passed");
  TOTAL_FAILURES += fails;
})();

// ═══════════════════════════════════════════════════════════════════════════
await (async function suite() {
  console.log("\n━━━ payload edge cases, round two");
  const ORIGIN = "https://dhairyakhetan.vercel.app";
  let fails = 0;
  const check = (l, ok, x = "") => { if (!ok) fails++; console.log(`  ${ok ? "pass" : "FAIL"}  ${l}${x ? " — " + x : ""}`); };
  const section = t => console.log(`\n── ${t}`);

  function makeWorld(overrides = {}) {
    const store = new Map();
    const ops = { reads: 0, writes: 0, byKey: {} };
    const calls = { og: 0 };
    return {
      store, ops, calls,
      env: {
        GITHUB_WEBHOOK_SECRET: "s3cret",
        STATS_KV: {
          async get(k, t) {
            ops.reads++;
            if (overrides.getThrows) throw new Error("KV unavailable");
            const v = store.get(k); return v === undefined ? null : (t === "json" ? JSON.parse(v) : v);
          },
          async put(k, v) {
            if (overrides.putThrows) throw new Error("KV write failed");
            ops.writes++; ops.byKey[k] = (ops.byKey[k] ?? 0) + 1; store.set(k, v);
          },
          async list() { return { keys: [...store.keys()].map(name => ({ name })) }; },
        },
        ...overrides.env,
      },
    };
  }
  const ctx = { waitUntil: p => p.catch(() => {}) };
  const req = (o = {}) => new Request(o.url ?? "https://w.dev/?project=showcase",
    { method: o.method ?? "GET",
      headers: o.headers ?? { Origin: ORIGIN, "CF-Connecting-IP": `10.2.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` } });


  const ghOnly = repos => async u => String(u).includes("api.github.com")
    ? new Response(JSON.stringify(repos), { status: 200, headers: { etag: '"e"' } })
    : new Response(JSON.stringify({ result: { data: {} } }), { status: 200, headers: { etag: '"t"' } });

  // ── transform throws ────────────────────────────────────────────────────────
  section("transform throws on an unexpected shape");
  {
    const w = makeWorld();
    // A getter that throws mimics a transform blowing up mid-access.
    globalThis.fetch = async u => String(u).includes("messivsronaldo")
      ? new Response('{"result":null}', { status: 200, headers: { etag: '"t"' } })
      : new Response("[]", { status: 200, headers: { etag: '"g"' } });
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    const stored = w.store.get("data:trophies");
    check("result:null falls back to the whole object, not undefined",
      stored && JSON.parse(JSON.parse(stored).body) !== null, stored ? JSON.parse(stored).body : "nothing stored");
  }

  // ── empty repo list ─────────────────────────────────────────────────────────
  section("account with zero repos");
  {
    const w = makeWorld();
    globalThis.fetch = ghOnly([]);
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    check("empty array is valid, not an error", res.status === 200, `${res.status}`);
    check("serves []", (await res.text()) === "[]");
  }

  // ── repos missing or sharing ids ────────────────────────────────────────────
  section("repo objects with missing / duplicate ids");
  {
    const w = makeWorld();
    globalThis.fetch = async u => {
      const s = String(u);
      if (s.includes("api.github.com")) return new Response(JSON.stringify([
        { name: "no-id", homepage: "https://x1.com/" },
        { name: "no-id-2", homepage: "https://x2.com/" },
        { id: 5, name: "dup-a", homepage: "https://x3.com/" },
        { id: 5, name: "dup-b", homepage: "https://x4.com/" },
      ]), { status: 200, headers: { etag: '"e"' } });
      if (s.startsWith("https://x")) { w.calls.og++; return new Response(`<meta property="og:image" content="${s}o.png">`, { status: 200 }); }
      return new Response(JSON.stringify({ result: { data: {} } }), { status: 200, headers: { etag: '"t"' } });
    };
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    const body = await res.json();
    check("all four repos survive", body.length === 4, `${body.length}`);
    check("no crash on undefined/duplicate ids", res.status === 200, `${res.status}`);
    const byName = Object.fromEntries(body.map(r => [r.name, r.ogImage]));
    check("repo without an id gets ITS OWN image",
      byName["no-id"] === "https://x1.com/o.png" && byName["no-id-2"] === "https://x2.com/o.png",
      JSON.stringify(byName));
  }

  // ── og:image URL variants ───────────────────────────────────────────────────
  section("og:image value variants");
  {
    const cases = {
      absolute: '<meta property="og:image" content="https://cdn.io/a.png">',
      rootRelative: '<meta property="og:image" content="/b.png">',
      pathRelative: '<meta property="og:image" content="img/c.png">',
      protocolRelative: '<meta property="og:image" content="//cdn.io/d.png">',
      garbage: '<meta property="og:image" content="::::not a url::::">',
      missing: "<html><head></head></html>",
      reversedAttrs: '<meta content="https://cdn.io/e.png" property="og:image">',
    };

    for (const [name, markup] of Object.entries(cases)) {
      const w = makeWorld();
      globalThis.fetch = async u => {
        const s = String(u);
        if (s.includes("api.github.com")) return new Response(JSON.stringify([{ id: 1, name, homepage: "https://site.test/page/" }]), { status: 200, headers: { etag: `"${name}"` } });
        if (s.startsWith("https://site.test")) return new Response(markup, { status: 200 });
        return new Response(JSON.stringify({ result: { data: {} } }), { status: 200, headers: { etag: '"t"' } });
      };
      const worker = await freshWorker();
      const res = await worker.fetch(req(), w.env, ctx);
      const got = (await res.json())[0].ogImage;
      check(`${name} → ${JSON.stringify(got)}`, res.status === 200);
    }
  }

  // ── og fetch failures ───────────────────────────────────────────────────────
  section("project site is down or hostile");
  {
    for (const [name, responder] of Object.entries({
      "500s": async () => new Response("err", { status: 500 }),
      "hangs (must hit the 5s abort)": (u, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal.reason ?? new Error("aborted")));
        }),
      "throws": async () => { throw new Error("ECONNRESET"); },
    })) {
      const w = makeWorld();
      globalThis.fetch = async (u, init) => {
        const s = String(u);
        if (s.includes("api.github.com")) return new Response(JSON.stringify([{ id: 1, name: "x", homepage: "https://down.test" }]), { status: 200, headers: { etag: '"e"' } });
        if (s.startsWith("https://down.test")) return responder(u, init);
        return new Response(JSON.stringify({ result: { data: {} } }), { status: 200, headers: { etag: '"t"' } });
      };
      const worker = await freshWorker();
      const res = await Promise.race([
        worker.fetch(req(), w.env, ctx),
        new Promise(r => setTimeout(() => r({ status: -1 }), 9000)),
      ]);
      const body = res.status === 200 ? (await res.json())[0].ogImage : null;
      check(`site ${name} → repo still served, ogImage ${JSON.stringify(body)}`, res.status === 200, `${res.status}`);
    }
  }

  // ── stale client etag ───────────────────────────────────────────────────────
  section("client revalidates with an outdated etag");
  {
    const w = makeWorld();
    globalThis.fetch = ghOnly([{ id: 1, name: "a", homepage: null }]);
    const worker = await freshWorker();
    await worker.fetch(req(), w.env, ctx);
    const res = await worker.fetch(req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.3.3.3", "If-None-Match": '"stale-value"' } }), w.env, ctx);
    check("stale etag gets a full 200, not a 304", res.status === 200, `${res.status}`);
    check("body is present", (await res.text()).startsWith("["));
  }

  // ── unicode in payload ──────────────────────────────────────────────────────
  section("payload with unicode and quotes");
  {
    const w = makeWorld();
    const tricky = [{ id: 1, name: "日本語", description: 'he said "hi" \\ then\nleft', homepage: null }];
    globalThis.fetch = ghOnly(tricky);
    const worker = await freshWorker();
    const a = await worker.fetch(req(), w.env, ctx);
    const etagA = a.headers.get("etag");
    const roundTrip = await a.json();
    check("unicode survives round-trip", roundTrip[0].name === "日本語", roundTrip[0].name);
    check("quotes and newlines survive", roundTrip[0].description === 'he said "hi" \\ then\nleft');
    await worker.scheduled({}, w.env);
    const b = await worker.fetch(req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.4.4.4" } }), w.env, ctx);
    check("etag stable across syncs", b.headers.get("etag") === etagA, `${etagA} vs ${b.headers.get("etag")}`);
  }

  // ── KV failures ─────────────────────────────────────────────────────────────
  section("KV itself misbehaves");
  {
    const w = makeWorld({ getThrows: true });
    globalThis.fetch = ghOnly([{ id: 1, name: "a", homepage: null }]);
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    check("read failure degrades to a live sync", res.status === 200, `${res.status}`);
  }
  {
    const w = makeWorld({ putThrows: true });
    w.store.set("data:showcase", JSON.stringify({
      body: JSON.stringify([{ id: 9, name: "cached", homepage: null }]),
      etag: '"c"', upstreamEtags: { repos: '"old"' }, og: {}, fetchedAt: 0, changedAt: 0,
    }));
    globalThis.fetch = ghOnly([{ id: 1, name: "fresh", homepage: null }]);
    const worker = await freshWorker();
    const res = await worker.fetch(req(), w.env, ctx);
    check("write failure still serves the cached copy", res.status === 200, `${res.status}`);
    check("served cached, not a crash", (await res.json())[0].name === "cached");
  }

  // ── config migration: a path added after the record was written ─────────────
  section("cached record predates a new path in config");
  {
    const w = makeWorld();
    // Record written when trophies had ONE path: body is the bare payload.
    w.store.set("data:trophies", JSON.stringify({
      body: JSON.stringify({ goals: 1 }),
      etag: '"old"', upstreamEtags: { ronaldo: '"r"', messi: '"m"' }, og: null, fetchedAt: 0, changedAt: 0,
    }));
    globalThis.fetch = async (u, init) => {
      const s = String(u);
      if (s.includes("messivsronaldo")) {
        const key = s.includes("/ronaldo-match-history") ? "ronaldo" : "messi";
        if (init?.headers?.["If-None-Match"]) return new Response(null, { status: 304 });
        return new Response(JSON.stringify({ result: { data: { who: key } } }), { status: 200, headers: { etag: `"${key}2"` } });
      }
      return new Response("[]", { status: 200, headers: { etag: '"g"' } });
    };
    const worker = await freshWorker();
    await worker.scheduled({}, w.env);
    const rebuilt = JSON.parse(JSON.parse(w.store.get("data:trophies")).body);
    check("recovered both keys unconditionally",
      rebuilt.ronaldo?.who === "ronaldo" && rebuilt.messi?.who === "messi", JSON.stringify(rebuilt));
  }

  // ── webhook edges ───────────────────────────────────────────────────────────
  section("webhook edge cases");
  {
    async function sign(secret, payload) {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
      return "sha256=" + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    const hook = (body, headers) => new Request("https://w.dev/hooks/github", { method: "POST", body, headers });
    globalThis.fetch = ghOnly([]);

    const w = makeWorld();
    const worker = await freshWorker();
    const payload = JSON.stringify({ repository: { owner: { login: "dhairyakhetan" } } });
    const valid = await sign("s3cret", payload);

    check("GET is rejected", (await worker.fetch(new Request("https://w.dev/hooks/github"), w.env, ctx)).status === 405);
    check("missing signature header → 401", (await worker.fetch(hook(payload, { "X-GitHub-Event": "push" }), w.env, ctx)).status === 401);
    check("right length, wrong bytes → 401",
      (await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid.slice(0, -1) + (valid.at(-1) === "a" ? "b" : "a"), "X-GitHub-Event": "push" }), w.env, ctx)).status === 401);
    check("sha1 prefix → 401", (await worker.fetch(hook(payload, { "X-Hub-Signature-256": "sha1=" + valid.slice(7), "X-GitHub-Event": "push" }), w.env, ctx)).status === 401);
    check("ping event → pong", (await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid, "X-GitHub-Event": "ping" }), w.env, ctx)).status === 200);

    const other = JSON.stringify({ repository: { owner: { login: "someone-else" } } });
    check("other owner ignored", (await worker.fetch(hook(other, { "X-Hub-Signature-256": await sign("s3cret", other), "X-GitHub-Event": "push" }), w.env, ctx)).status === 202);

    const noOwner = JSON.stringify({ zen: "hello" });
    check("payload without repository → ignored, not 500",
      (await worker.fetch(hook(noOwner, { "X-Hub-Signature-256": await sign("s3cret", noOwner), "X-GitHub-Event": "push" }), w.env, ctx)).status === 202);

    const notJson = "<<<not json>>>";
    check("unparseable body → 400",
      (await worker.fetch(hook(notJson, { "X-Hub-Signature-256": await sign("s3cret", notJson), "X-GitHub-Event": "push" }), w.env, ctx)).status === 400);

    const noSecret = makeWorld({ env: { GITHUB_WEBHOOK_SECRET: undefined } });
    noSecret.env.GITHUB_WEBHOOK_SECRET = undefined;
    check("no secret configured → 503",
      (await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid, "X-GitHub-Event": "push" }), noSecret.env, ctx)).status === 503);
  }



  console.log(fails ? `  → ${fails} failure(s)` : "  → all passed");
  TOTAL_FAILURES += fails;
})();

console.log(
  TOTAL_FAILURES
    ? `\n${TOTAL_FAILURES} FAILURE(S) across all suites`
    : "\nall suites passed",
);
process.exit(TOTAL_FAILURES ? 1 : 0);
