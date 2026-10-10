/*
 * Keeps /Japan2026 usable with no signal — underground, or on patchy roaming.
 *
 * Registered by src/japan/App.tsx with scope /Japan2026, so the portfolio
 * never goes through it. Pages are network-first with a short timeout: online,
 * you always get the latest plan, and the saved copy only answers when the
 * network can't. Files under /_next/static are content-hashed — a changed
 * file gets a new name — so once saved they're served straight from the cache.
 *
 * A first visit isn't controlled by this worker yet, so the page posts what it
 * loaded (and every day's URL) once it has settled; see "save" below.
 */

const PAGES = "japan-pages-v1";
const ASSETS = "japan-assets-v1";
/** How long one bar of roaming gets before the saved copy answers instead. */
const TIMEOUT = 3500;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== PAGES && key !== ASSETS) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") event.respondWith(page(event));
  else if (url.pathname.startsWith("/_next/static/")) event.respondWith(asset(request));
});

/** "/Japan2026/day3/" and "/Japan2026/day3" are the same saved page. */
const pageKey = url => new URL(url, self.location.origin).pathname.replace(/\/+$/, "");

async function page(event) {
  const cache = await caches.open(PAGES);
  const key = pageKey(event.request.url);

  const network = fetch(event.request);
  // Copied before the page reads the body, and kept alive past the response
  // so the fresh copy is saved even when the saved one answered first.
  event.waitUntil(
    network.then(response => (response.ok ? cache.put(key, response.clone()) : undefined)).catch(() => {}),
  );

  // Every day is the same app reading the URL, so any saved page can stand in.
  const saved = async () => (await cache.match(key)) || (await cache.match("/Japan2026"));
  const slow = new Promise(resolve => setTimeout(resolve, TIMEOUT)).then(saved);

  try {
    // Nothing saved yet means waiting for the network after all.
    return await Promise.race([network, slow.then(hit => hit || network)]);
  } catch {
    return (await saved()) || Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("message", event => {
  if (event.data?.type === "save") event.waitUntil(save(event.data.pages, event.data.assets));
});

/**
 * Saves every day's page and the files this visit loaded. Cached files this
 * visit didn't load are from an older build — the site was redeployed — and
 * every other saved page still points at them, so all pages are fetched again
 * first, and the old files only go once every page came back.
 */
async function save(pages, assets) {
  const pageCache = await caches.open(PAGES);
  const assetCache = await caches.open(ASSETS);

  const wanted = new Set(assets.map(path => new URL(path, self.location.origin).href));
  const saved = await assetCache.keys();
  const have = new Set(saved.map(request => request.url));
  const stale = saved.filter(request => !wanted.has(request.url));

  await Promise.all(
    [...wanted].filter(url => !have.has(url)).map(url => assetCache.add(url).catch(() => {})),
  );

  const results = await Promise.all(
    pages.map(async path => {
      const key = pageKey(path);
      if (stale.length === 0 && (await pageCache.match(key))) return true;
      try {
        const response = await fetch(path, { cache: "no-cache" });
        // A redirected response can't answer a navigation.
        if (!response.ok || response.redirected) return false;
        await pageCache.put(key, response);
        return true;
      } catch {
        return false;
      }
    }),
  );

  if (results.every(Boolean)) await Promise.all(stale.map(request => assetCache.delete(request)));
}
