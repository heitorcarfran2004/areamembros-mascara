// Service worker mínimo — necessário para o app ser "instalável" (PWA).
const CACHE = "espaco-criativo-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler de fetch (mesmo simples) é exigido por alguns navegadores para
// considerar o app instalável. Usa rede e cai pro cache só se a rede falhar.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
