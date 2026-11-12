/* Service Worker — Cantina SENAI
 * Faz o app funcionar offline e permite a instalação como PWA / APK (TWA).
 * Tecnologia: JavaScript (web standard). */
const CACHE = "cantina-senai-v15";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./animata.css",
  "./app.js",
  "./dados/cardapio.json",
  "./dados/usuarios.json",
  "./img/comercial-bisteca.jpg",
  "./img/comercial-calabresa.jpg",
  "./img/comercial-contrafile.jpg",
  "./img/comercial-frango.jpg",
  "./img/comercial-linguica.jpg",
  "./img/comercial-omelete.jpg",
  "./img/pao-manteiga.jpg",
  "./img/pao-ovo.jpg",
  "./img/pao-requeijao.jpg",
  "./img/pao-ovo-salada.jpg",
  "./img/comercial-amigao.jpg",
  "./img/comercial-strogonoff.jpg",
  "./img/pao-manteiga-requeijao.jpg",
  "./img/x-salada.jpg",
  "./img/queijo-quente-tomate.jpg",
  "./img/misto-quente.jpg",
  "./img/bauru.jpg",
  "./img/x-salada-egg.jpg",
  "./img/x-bacon.jpg",
  "./img/queijo-quente.jpg",
  "./img/americano.jpg",
  "./img/hamburguer.jpg",
  "./img/x-burguer.jpg",
  "./img/x-egg.jpg",
  "./img/calabresa-queijo.jpg",
  "./img/calabresa-queijo-salada.jpg",
  "./img/pao-manteiga-chapa.jpg",
  "./img/file-frango.jpg",
  "./img/salada-frango.jpg",
  "./img/calabresa.jpg",
  "./img/comercial-parmegiana.jpg",
  "./icones/icon-192.png",
  "./icones/icon-512.png",
  "./icones/icon-maskable-512.png",
  "./icones/apple-touch-icon.png",
  "./icones/favicon-32.png",
  "./icones/favicon.ico",
  "./icones/logo-64.png",
  /* CDNs permitidas (Tailwind CSS, jQuery, Google Fonts) — cacheadas para offline */
  "https://cdn.tailwindcss.com",
  "https://code.jquery.com/jquery-3.7.1.min.js",
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Estratégia: stale-while-revalidate para tudo, com fallback de cache. */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const req = event.request;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && (resp.type === "basic" || resp.type === "cors")) {
            const clone = resp.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
