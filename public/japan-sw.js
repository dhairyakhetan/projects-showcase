/*
 * The Japan trip planner (/Japan2026) has been taken down. Devices that
 * visited it still have its offline worker installed; when they next check
 * for an update they get this one, which deletes the saved copy and removes
 * itself, so the old page can't keep opening offline. Safe to delete this
 * file once those devices have been online again (give it a few weeks).
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("japan-")) await caches.delete(key);
      }
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })(),
  );
});
