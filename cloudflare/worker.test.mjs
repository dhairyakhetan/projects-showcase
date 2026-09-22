/**
 * Worker test suite. Run with:  npm run test:worker
 *
 * No dependencies and no network. Each scenario builds its own in-memory KV
 * and stubs global fetch, then asserts on COUNTED operations — KV reads, KV
 * writes, upstream requests — because the worker's whole design is about
 * keeping those numbers low, so the numbers are what has to be checked.
 *
 * Every scenario re-imports the worker fresh: it holds per-isolate state
 * (rate-limit buckets, the lazy-sync throttle) that would otherwise leak
 * between tests and make results order-dependent.
 */

import { promises as fs } from "node:fs";

const WORKER_PATH = new URL("./worker.js", import.meta.url).pathname;
const SOURCE = await fs.readFile(WORKER_PATH, "utf8");
const ORIGIN = "https://dhairyakhetan.vercel.app";

let failures = 0;
let seq = 0;

const check = (label, ok, note = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "pass" : "FAIL"}  ${label}${note ? ` — ${note}` : ""}`);
};
const section = title => console.log(`\n── ${title}`);

async function freshWorker() {
  const url =
    "data:text/javascript;base64," + Buffer.from(`${SOURCE}\n//${seq++}`).toString("base64");
  return (await import(url)).default;
}

function makeEnv({ getThrows = false, putThrows = false, secret, token } = {}) {
  // `secret` defaults via ?? rather than a destructuring default: passing
  // `undefined` explicitly must mean "no secret", not "use the default".
  const webhookSecret = secret === null ? undefined : (secret ?? "s3cret");
  const store = new Map();
  const ops = { reads: 0, writes: 0 };

  return {
    store,
    ops,
    env: {
      GITHUB_WEBHOOK_SECRET: webhookSecret,
      GITHUB_TOKEN: token,
      STATS_KV: {
        async get(key, type) {
          ops.reads++;
          if (getThrows) throw new Error("KV unavailable");
          const value = store.get(key);
          return value === undefined ? null : type === "json" ? JSON.parse(value) : value;
        },
        async put(key, value) {
          if (putThrows) throw new Error("KV write failed");
          ops.writes++;
          store.set(key, value);
        },
      },
    },
  };
}

const ctx = { waitUntil: promise => promise.catch(() => {}) };

let ipSeq = 0;
const req = (options = {}) =>
  new Request(options.url ?? "https://w.dev/?project=showcase", {
    method: options.method ?? "GET",
    headers: options.headers ?? {
      Origin: ORIGIN,
      "CF-Connecting-IP": options.ip ?? `10.0.0.${++ipSeq % 250}`,
    },
  });

/** GitHub responder with ETag support; anything else 500s. */
function githubStub(state) {
  return async (url, init) => {
    const target = String(url);

    if (target.startsWith("https://api.github.com")) {
      state.calls++;
      const conditional = init?.headers?.["If-None-Match"];
      if (conditional) state.conditional++;
      if (conditional && conditional === state.etag) {
        state.notModified++;
        return new Response(null, { status: 304 });
      }
      return new Response(JSON.stringify(state.repos), {
        status: 200,
        headers: state.etag ? { etag: state.etag } : {},
      });
    }

    if (state.sites && target.startsWith("https://")) {
      state.ogCalls++;
      return state.sites(target, init);
    }

    return new Response("nope", { status: 500 });
  };
}

const ghState = (repos, etag = '"v1"', sites = null) => ({
  repos, etag, sites, calls: 0, conditional: 0, notModified: 0, ogCalls: 0,
});

// ═══════════════════════════════════════════════════ core operation counts ══
section("steady state costs");
{
  const { env, ops, store } = makeEnv();
  const state = ghState(
    [{ id: 1, name: "site", homepage: "https://ex.com" }, { id: 2, name: "lib", homepage: null }],
    '"v1"',
    target => new Response(`<meta property="og:image" content="/card.png">`, { status: 200 }),
  );
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();

  const cold = await worker.fetch(req(), env, ctx);
  check("cold fetch 200", cold.status === 200);
  check("one GitHub call", state.calls === 1, `${state.calls}`);
  check("one og crawl (only the repo with a site)", state.ogCalls === 1, `${state.ogCalls}`);
  check("one KV write", ops.writes === 1, `${ops.writes}`);

  const body = await cold.clone().json();
  check("relative og:image resolved absolute", body[0].ogImage === "https://ex.com/card.png", body[0].ogImage);
  check("repo without a site gets null", body[1].ogImage === null);
  const etag = cold.headers.get("etag");

  ops.writes = 0; ops.reads = 0; state.calls = 0;
  for (let i = 0; i < 50; i++) await worker.fetch(req(), env, ctx);
  check("50 requests → ZERO KV writes", ops.writes === 0, `${ops.writes}`);
  check("50 requests → 50 KV reads", ops.reads === 50, `${ops.reads}`);
  check("50 requests → ZERO upstream calls", state.calls === 0, `${state.calls}`);

  const conditional = await worker.fetch(
    req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.9.9.9", "If-None-Match": etag } }), env, ctx);
  check("client If-None-Match → 304", conditional.status === 304, `${conditional.status}`);

  ops.writes = 0;
  await worker.scheduled({}, env);
  check("cron sends a conditional request", state.conditional >= 1, `${state.conditional}`);
  check("upstream answered 304", state.notModified >= 1, `${state.notModified}`);
  check("unchanged cron → ZERO KV writes", ops.writes === 0, `${ops.writes}`);

  state.repos = [...state.repos, { id: 3, name: "new", homepage: null }];
  state.etag = '"v2"';
  ops.writes = 0;
  await worker.scheduled({}, env);
  check("a real change → exactly one write", ops.writes === 1, `${ops.writes}`);
  const after = JSON.parse(JSON.parse(store.get("data:showcase")).body);
  check("new repo served", after.length === 3, `${after.length}`);
  check("existing og reused, not re-crawled", after[0].ogImage === "https://ex.com/card.png");
}

// ═══════════════════════════════════════════════════════════ payload edges ══
section("upstream 304s but nothing is cached");
{
  const { env, ops, store } = makeEnv();
  let served = 0;
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith("https://api.github.com")) return new Response("x", { status: 500 });
    // Misbehaving upstream: 304s even with no If-None-Match sent.
    if (!init?.headers?.["If-None-Match"] && served++ === 0) return new Response(null, { status: 304 });
    return new Response(JSON.stringify([{ id: 1, name: "a", homepage: null }]),
      { status: 200, headers: { etag: '"x"' } });
  };
  const worker = await freshWorker();
  const res = await worker.fetch(req(), env, ctx);
  const body = await res.clone().text();
  check("never serves an empty body", body.length > 0 && body !== "undefined", JSON.stringify(body.slice(0, 40)));
  check("recovered by asking unconditionally", res.status === 200, `${res.status}`);
  check("stored a real payload", JSON.parse(store.get("data:showcase")).body.startsWith("["));
}

section("upstream 304s forever with nothing cached");
{
  const { env, ops } = makeEnv();
  globalThis.fetch = async () => new Response(null, { status: 304 });
  const worker = await freshWorker();
  const res = await worker.fetch(req(), env, ctx);
  check("fails with 502 rather than looping", res.status === 502, `${res.status}`);
  check("wrote nothing", ops.writes === 0, `${ops.writes}`);
}

section("og entry expires while upstream is unchanged");
{
  const { env, ops, store } = makeEnv();
  let image = 0;
  const state = ghState([{ id: 1, name: "site", homepage: "https://ex.com" }], '"v1"',
    () => new Response(`<meta property="og:image" content="/i-${++image}.png">`, { status: 200 }));
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();

  await worker.scheduled({}, env);
  check("first sync crawls once", state.ogCalls === 1, `${state.ogCalls}`);

  const record = JSON.parse(store.get("data:showcase"));
  record.og["1"].checkedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
  store.set("data:showcase", JSON.stringify(record));

  state.ogCalls = 0; ops.writes = 0; state.notModified = 0;
  await worker.scheduled({}, env);
  check("upstream answered 304", state.notModified === 1, `${state.notModified}`);
  check("og re-crawled despite the 304", state.ogCalls === 1, `${state.ogCalls}`);
  check("refreshed image written", ops.writes === 1, `${ops.writes}`);
  check("new image served",
    JSON.parse(JSON.parse(store.get("data:showcase")).body)[0].ogImage === "https://ex.com/i-2.png");

  state.ogCalls = 0; ops.writes = 0;
  await worker.scheduled({}, env);
  check("fresh og not re-crawled", state.ogCalls === 0, `${state.ogCalls}`);
  check("truly unchanged → no write", ops.writes === 0, `${ops.writes}`);
}

section("GitHub answers 200 with an error object");
{
  const { env, ops, store } = makeEnv();
  store.set("data:showcase", JSON.stringify({
    body: JSON.stringify([{ id: 1, name: "good", homepage: null, ogImage: null }]),
    etag: '"good"', upstreamEtag: '"old"', og: {}, fetchedAt: Date.now(), changedAt: Date.now(),
  }));
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Not Found" }), { status: 200, headers: { etag: '"bad"' } });
  const worker = await freshWorker();
  await worker.scheduled({}, env);
  check("garbage not written over good data", ops.writes === 0, `${ops.writes}`);
  check("good payload still served",
    JSON.parse(JSON.parse(store.get("data:showcase")).body)[0].name === "good");
}

section("cached record body is unparseable");
{
  const { env, store } = makeEnv();
  store.set("data:showcase", JSON.stringify({
    body: "{not json at all", etag: '"e"', upstreamEtag: '"old"', og: {}, fetchedAt: 0,
  }));
  let sentConditional = false;
  globalThis.fetch = async (url, init) => {
    if (init?.headers?.["If-None-Match"]) sentConditional = true;
    return new Response(JSON.stringify([{ id: 7, name: "recovered", homepage: null }]),
      { status: 200, headers: { etag: '"new"' } });
  };
  const worker = await freshWorker();
  await worker.scheduled({}, env);
  check("did not trust the corrupt cache's etag", sentConditional === false);
  check("rebuilt from upstream",
    JSON.parse(JSON.parse(store.get("data:showcase")).body)[0].name === "recovered");
}

section("repo list churn");
{
  const { env, store } = makeEnv();
  const state = ghState(
    [{ id: 1, name: "a", homepage: "https://a.com/" }, { id: 2, name: "b", homepage: "https://b.com/" }],
    '"1"', target => new Response(`<meta property="og:image" content="${target}og.png">`, { status: 200 }));
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();

  await worker.scheduled({}, env);
  check("crawled both", state.ogCalls === 2, `${state.ogCalls}`);

  state.repos = [{ id: 1, name: "a", homepage: "https://a.com/" }];
  state.etag = '"2"'; state.ogCalls = 0;
  await worker.scheduled({}, env);
  check("deleted repo dropped from og state", !("2" in JSON.parse(store.get("data:showcase")).og));
  check("survivor not re-crawled", state.ogCalls === 0, `${state.ogCalls}`);

  state.repos = [{ id: 1, name: "a", homepage: "https://moved.com/" }];
  state.etag = '"3"'; state.ogCalls = 0;
  await worker.scheduled({}, env);
  check("moved homepage re-crawled", state.ogCalls === 1, `${state.ogCalls}`);
  check("stale image replaced",
    JSON.parse(JSON.parse(store.get("data:showcase")).body)[0].ogImage === "https://moved.com/og.png");
}

section("cold cache with many live projects");
{
  const { env, store } = makeEnv();
  const state = ghState(
    Array.from({ length: 20 }, (_, i) => ({ id: i, name: `p${i}`, homepage: `https://s${i}.com/` })),
    '"m"', target => new Response(`<meta property="og:image" content="${target}o.png">`, { status: 200 }));
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();

  await worker.scheduled({}, env);
  check("crawls capped at 8 per sync", state.ogCalls === 8, `${state.ogCalls} of 20 sites`);
  state.ogCalls = 0;
  await worker.scheduled({}, env);
  check("next sync makes progress", state.ogCalls === 8, `${state.ogCalls}`);
  check("16 of 20 resolved after two syncs",
    Object.values(JSON.parse(store.get("data:showcase")).og).filter(e => e.image).length === 16);
}

section("account with zero repos");
{
  const { env } = makeEnv();
  globalThis.fetch = githubStub(ghState([]));
  const worker = await freshWorker();
  const res = await worker.fetch(req(), env, ctx);
  check("empty array is valid, not an error", res.status === 200, `${res.status}`);
  check("serves []", (await res.text()) === "[]");
}

section("repos with missing or duplicate ids");
{
  const { env } = makeEnv();
  const state = ghState([
    { name: "no-id", homepage: "https://x1.com/" },
    { name: "no-id-2", homepage: "https://x2.com/" },
    { id: 5, name: "dup-a", homepage: "https://x3.com/" },
    { id: 5, name: "dup-b", homepage: "https://x4.com/" },
  ], '"e"', target => new Response(`<meta property="og:image" content="${target}o.png">`, { status: 200 }));
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();
  const body = await (await worker.fetch(req(), env, ctx)).json();
  const byName = Object.fromEntries(body.map(r => [r.name, r.ogImage]));
  check("all four survive", body.length === 4, `${body.length}`);
  check("repo without an id gets ITS OWN image",
    byName["no-id"] === "https://x1.com/o.png" && byName["no-id-2"] === "https://x2.com/o.png",
    JSON.stringify(byName));
}

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
    const { env } = makeEnv();
    globalThis.fetch = githubStub(ghState(
      [{ id: 1, name, homepage: "https://site.test/page/" }], `"${name}"`,
      () => new Response(markup, { status: 200 })));
    const worker = await freshWorker();
    const res = await worker.fetch(req(), env, ctx);
    check(`${name} → ${JSON.stringify((await res.json())[0].ogImage)}`, res.status === 200);
  }
}

section("project site is down or hostile");
{
  const responders = {
    "500s": async () => new Response("err", { status: 500 }),
    "hangs (must hit the 5s abort)": (target, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal.reason ?? new Error("aborted")));
      }),
    throws: async () => { throw new Error("ECONNRESET"); },
  };

  for (const [name, responder] of Object.entries(responders)) {
    const { env } = makeEnv();
    globalThis.fetch = githubStub(ghState(
      [{ id: 1, name: "x", homepage: "https://down.test/" }], '"e"', responder));
    const worker = await freshWorker();

    // AbortSignal.timeout's timer is unref'd in Node, so without something
    // holding the event loop open the 5s abort never gets a chance to fire.
    const keepAlive = setInterval(() => {}, 250);
    const res = await worker.fetch(req(), env, ctx);
    clearInterval(keepAlive);

    const image = res.status === 200 ? (await res.json())[0].ogImage : "n/a";
    check(`site ${name} → repo still served, ogImage ${JSON.stringify(image)}`, res.status === 200, `${res.status}`);
  }
}

section("client revalidates with an outdated etag");
{
  const { env } = makeEnv();
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "a", homepage: null }]));
  const worker = await freshWorker();
  await worker.fetch(req(), env, ctx);
  const res = await worker.fetch(req({
    headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.3.3.3", "If-None-Match": '"stale"' } }), env, ctx);
  check("stale etag gets a full 200", res.status === 200, `${res.status}`);
  check("body present", (await res.text()).startsWith("["));
}

section("payload with unicode and quotes");
{
  const { env } = makeEnv();
  globalThis.fetch = githubStub(ghState(
    [{ id: 1, name: "日本語", description: 'he said "hi" \\ then\nleft', homepage: null }]));
  const worker = await freshWorker();
  const first = await worker.fetch(req(), env, ctx);
  const etag = first.headers.get("etag");
  const parsed = await first.json();
  check("unicode survives round-trip", parsed[0].name === "日本語", parsed[0].name);
  check("quotes and newlines survive", parsed[0].description === 'he said "hi" \\ then\nleft');
  await worker.scheduled({}, env);
  const second = await worker.fetch(req({ headers: { Origin: ORIGIN, "CF-Connecting-IP": "10.4.4.4" } }), env, ctx);
  check("etag stable across syncs", second.headers.get("etag") === etag);
}

section("upstream sends no ETag");
{
  const { env, ops } = makeEnv();
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "x", homepage: null }], null));
  const worker = await freshWorker();
  await worker.scheduled({}, env);
  check("first sync writes", ops.writes === 1, `${ops.writes}`);
  ops.writes = 0;
  await worker.scheduled({}, env);
  check("identical body → no second write", ops.writes === 0, `${ops.writes}`);
}

section("KV itself misbehaves");
{
  const { env } = makeEnv({ getThrows: true });
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "a", homepage: null }]));
  const worker = await freshWorker();
  check("read failure degrades to a live sync", (await worker.fetch(req(), env, ctx)).status === 200);
}
{
  const { env, store } = makeEnv({ putThrows: true });
  store.set("data:showcase", JSON.stringify({
    body: JSON.stringify([{ id: 9, name: "cached", homepage: null }]),
    etag: '"c"', upstreamEtag: '"old"', og: {}, fetchedAt: 0, changedAt: 0,
  }));
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "fresh", homepage: null }], '"new"'));
  const worker = await freshWorker();
  const res = await worker.fetch(req(), env, ctx);
  check("write failure still serves the cached copy", res.status === 200, `${res.status}`);
  check("served cached, not a crash", (await res.json())[0].name === "cached");
}

// ═══════════════════════════════════════════════════════ routing & access ══
section("origin, routing and rate limit");
{
  const { env, ops } = makeEnv();
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "a", homepage: null }]));
  const worker = await freshWorker();

  check("no origin blocked", (await worker.fetch(req({ headers: {} }), env, ctx)).status === 403);
  check("wrong origin blocked",
    (await worker.fetch(req({ headers: { Origin: "https://evil.test" } }), env, ctx)).status === 403);
  check("preflight allowed", (await worker.fetch(req({ method: "OPTIONS" }), env, ctx)).status === 204);
  check("preflight blocked for strangers",
    (await worker.fetch(req({ method: "OPTIONS", headers: { Origin: "https://evil.test" } }), env, ctx)).status === 403);
  check("unknown project 404",
    (await worker.fetch(req({ url: "https://w.dev/?project=trophies" }), env, ctx)).status === 404);

  const root = await worker.fetch(req({ url: "https://w.dev/" }), env, ctx);
  check("bare visit is plain text", root.headers.get("content-type")?.startsWith("text/plain"),
    root.headers.get("content-type"));

  const cold = await worker.fetch(req({ url: "https://w.dev/admin-panel" }), env, ctx);
  check("admin panel before any sync says so", (await cold.text()).includes("NEVER FETCHED"));

  // Warm the cache so the populated panel can be checked too. This is also
  // the first allowed project request, so it cold-syncs and writes once.
  await worker.fetch(req(), env, ctx);

  const admin = await worker.fetch(req({ url: "https://w.dev/admin-panel" }), env, ctx);
  const adminBody = await admin.text();
  check("admin panel is plain text", admin.headers.get("content-type")?.startsWith("text/plain"));
  check("admin panel reports repo count", /repos\s+\d+/.test(adminBody), adminBody.split("\n").find(l => l.startsWith("repos")));
  check("admin panel reports webhook state", adminBody.includes("webhook"));
  check("admin panel has no HTML", !adminBody.includes("<"), adminBody.match(/<[^>]+>/)?.[0] ?? "");
  check("admin panel trailing slash works",
    (await worker.fetch(req({ url: "https://w.dev/admin-panel/" }), env, ctx)).status === 200);

  ops.writes = 0;
  const codes = [];
  for (let i = 0; i < 125; i++) {
    codes.push((await worker.fetch(req({
      headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7" } }), env, ctx)).status);
  }
  check("rate limit trips at 120", codes.filter(c => c === 429).length === 5,
    `${codes.filter(c => c === 429).length} blocked of 125`);
  check("rate limiting costs no KV writes", ops.writes === 0, `${ops.writes}`);
}

section("upstream failure");
{
  const { env, ops, store } = makeEnv();
  globalThis.fetch = githubStub(ghState([{ id: 1, name: "a", homepage: null }]));
  const worker = await freshWorker();
  await worker.fetch(req(), env, ctx);

  globalThis.fetch = async () => new Response("boom", { status: 503 });
  ops.writes = 0;
  await worker.scheduled({}, env);
  check("dead upstream → no write", ops.writes === 0, `${ops.writes}`);
  check("still serves cached data", (await worker.fetch(req(), env, ctx)).status === 200);
}

// ═════════════════════════════════════════════════════════════════ webhook ══
section("webhook");
{
  async function sign(secret, payload) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return "sha256=" + [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const hook = (body, headers) =>
    new Request("https://w.dev/hooks/github", { method: "POST", body, headers });

  const { env, store } = makeEnv();
  const state = ghState([{ id: 1, name: "before", homepage: null }]);
  globalThis.fetch = githubStub(state);
  const worker = await freshWorker();
  await worker.scheduled({}, env);

  const payload = JSON.stringify({ repository: { owner: { login: "dhairyakhetan" } } });
  const valid = await sign("s3cret", payload);

  check("GET rejected", (await worker.fetch(new Request("https://w.dev/hooks/github"), env, ctx)).status === 405);
  check("missing signature → 401",
    (await worker.fetch(hook(payload, { "X-GitHub-Event": "push" }), env, ctx)).status === 401);
  check("right length, wrong bytes → 401",
    (await worker.fetch(hook(payload, {
      "X-Hub-Signature-256": valid.slice(0, -1) + (valid.at(-1) === "a" ? "b" : "a"),
      "X-GitHub-Event": "push" }), env, ctx)).status === 401);
  check("sha1 prefix → 401",
    (await worker.fetch(hook(payload, { "X-Hub-Signature-256": "sha1=" + valid.slice(7), "X-GitHub-Event": "push" }), env, ctx)).status === 401);
  check("ping → pong",
    (await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid, "X-GitHub-Event": "ping" }), env, ctx)).status === 200);

  const other = JSON.stringify({ repository: { owner: { login: "someone-else" } } });
  check("foreign owner ignored",
    (await worker.fetch(hook(other, { "X-Hub-Signature-256": await sign("s3cret", other), "X-GitHub-Event": "push" }), env, ctx)).status === 202);

  const noRepo = JSON.stringify({ zen: "hello" });
  check("payload without repository → ignored, not 500",
    (await worker.fetch(hook(noRepo, { "X-Hub-Signature-256": await sign("s3cret", noRepo), "X-GitHub-Event": "push" }), env, ctx)).status === 202);

  const notJson = "<<<not json>>>";
  check("unparseable body → 400",
    (await worker.fetch(hook(notJson, { "X-Hub-Signature-256": await sign("s3cret", notJson), "X-GitHub-Event": "push" }), env, ctx)).status === 400);

  const { env: noSecret } = makeEnv({ secret: null });
  check("no secret configured → 503",
    (await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid, "X-GitHub-Event": "push" }), noSecret, ctx)).status === 503);

  // A valid delivery must actually sync.
  state.repos = [{ id: 2, name: "pushed-just-now", homepage: null }];
  state.etag = '"v2"';
  const pending = [];
  const capturing = { waitUntil: p => pending.push(p) };
  const accepted = await worker.fetch(hook(payload, { "X-Hub-Signature-256": valid, "X-GitHub-Event": "push" }), env, capturing);
  check("valid delivery accepted", accepted.status === 202, `${accepted.status}`);
  await Promise.all(pending);
  check("webhook synced immediately",
    JSON.parse(JSON.parse(store.get("data:showcase")).body)[0].name === "pushed-just-now");
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
