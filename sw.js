// sw.js
const CACHE_NAME = 'pente-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/background_top.png',
  '/background_button.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept external requests (CounterAPI, Google Ads, etc.)
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});