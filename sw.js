const CACHE_NAME = 'gymapp-cache-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css?v=8',
  './js/vendor/chart.umd.js',
  './js/storage.js?v=8',
  './js/seed-exercises.js?v=8',
  './js/exercise-picker.js?v=8',
  './js/workouts.js?v=8',
  './js/routines.js?v=8',
  './js/app.js?v=8',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return; // deja pasar peticiones externas sin interceptar
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
