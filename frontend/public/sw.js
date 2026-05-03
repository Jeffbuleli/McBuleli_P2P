/* eslint-disable no-undef */
/** Bump pour forcer la mise à jour du SW chez les clients. */
const CACHE = "mcbuleli-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/offline.html", "/unreachable.html"]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const offlineDoc = await caches.match("/offline.html");
      const unreachableDoc = await caches.match("/unreachable.html");

      // Pas de réseau (ou navigateur hors ligne) → vraie page offline
      if (self.navigator && self.navigator.onLine === false && offlineDoc) {
        return offlineDoc;
      }

      // En ligne mais document injoignable (serveur arrêté, etc.)
      if (unreachableDoc) {
        return unreachableDoc;
      }

      return offlineDoc || Response.error();
    }),
  );
});
