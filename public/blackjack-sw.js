// Keeps the Blackjack page, code and artwork on the device, so the second visit
// (and the home-screen app) starts from cache and works offline. It only ever
// touches /blackjack.
const CACHE = "bj-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("bj-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function store(request, response) {
  if (response && response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

// Serve what's saved at once and refresh it for next time.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request).then((r) => store(request, r)).catch(() => cached);
  return cached || fresh;
}

// The page itself: the newest copy when the network is there, else the saved one.
async function networkFirst(request) {
  try {
    return await store(request, await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(reject, 4000)),
    ]));
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (url.pathname === "/blackjack") event.respondWith(networkFirst(request));
    else if (url.pathname.startsWith("/blackjack/")) event.respondWith(staleWhileRevalidate(request));
  }
});
