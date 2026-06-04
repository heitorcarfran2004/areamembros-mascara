// Service worker mínimo — necessário para o app ser "instalável" (PWA).
// IMPORTANTE: não interceptamos as requisições (sem event.respondWith).
// O handler de fetch existe só para satisfazer o critério de instalabilidade;
// deixar o navegador lidar com o carregamento evita quebrar a página em redes
// instáveis (que foi o erro de carregamento no 1º acesso pelo celular).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handler de fetch vazio: NÃO chama respondWith, então cada requisição segue
// o fluxo normal do navegador (rede), sem risco de falha por cache vazio.
self.addEventListener("fetch", () => {});
