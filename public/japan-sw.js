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
 * loaded (and both of its URLs) once it has settled; see "save" below.
 *
 * Only the latest version is ever kept. Renaming the caches (v2) drops every
 * copy saved by an older worker on activate; "save" drops pages and files the
 * current build doesn't use; and if slow data made a saved page answer first,
 * the page is told to reload as soon as a different, newer copy arrives.
 */

const PAGES = "japan-pages-v2";
const ASSETS = "japan-assets-v2";
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

/** "/Japan2026/" and "/Japan2026" are the same saved page. */
const pageKey = url => new URL(url, self.location.origin).pathname.replace(/\/+$/, "");

async function page(event) {
  const cache = await caches.open(PAGES);
  const key = pageKey(event.request.url);

  // Both pages are the same app reading the URL, so either can stand in.
  const saved = async () => (await cache.match(key)) || (await cache.match("/Japan2026"));
  /** The saved copy, if it answered because the network was slow. */
  let servedStale = null;

  const network = fetch(event.request);
  // Copied before the page reads the body, and kept alive past the response
  // so the fresh copy is saved even when the saved one answered first. If the
  // saved one did answer and the fresh copy differs, it was an older version:
  // tell the page to reload onto the new one.
  event.waitUntil(
    network
      .then(async response => {
        if (!response.ok) return;
        // Taken now: only a saved copy that answered before this arrived counts.
        const stale = servedStale;
        const fresh = stale ? response.clone() : null;
        await cache.put(key, response.clone());
        if (stale && (await stale.text()) !== (await fresh.text())) {
          for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "updated" });
        }
      })
      .catch(() => {}),
  );

  const slow = new Promise(resolve => setTimeout(resolve, TIMEOUT))
    .then(saved)
    .then(hit => {
      if (hit) servedStale = hit.clone();
      return hit;
    });

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
 * Saves both pages and the files this visit loaded. Cached files this
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

  // Pages this build no longer has (the old /Japan2026/dayN) go too.
  const keep = new Set(pages.map(path => new URL(pageKey(path), self.location.origin).href));
  for (const request of await pageCache.keys()) if (!keep.has(request.url)) await pageCache.delete(request);
}
