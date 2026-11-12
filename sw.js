const CACHE = 'music-space-shell-v9';
const FILES = ['./','./index.html','./css/style.css','./js/core.js','./js/audio.js','./js/cosmos.js','./js/orbit.js','./js/app.js','./js/navigation.js','./manifest.webmanifest','./assets/icon-32.png','./assets/icon-180.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('nest-shell-') || key.startsWith('music-space-shell-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
