const CACHE = "c2-operativo-v1";
const BASE = new URL("./", self.location).pathname;
const FILES = [
  BASE,
  `${BASE}index.html`,
  `${BASE}style.css`,
  `${BASE}app.js`,
  `${BASE}manifest.json`,
  `${BASE}icon.svg`,
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then(value => value || caches.match(`${BASE}index.html`))
    )
  );
});
