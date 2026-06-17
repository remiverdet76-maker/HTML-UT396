// Service Worker 0mcha396 — cache-first, chargement offline < 500ms
const CACHE = 'omcha396-v1';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/css/00-fonts.css', '/css/01-base.css', '/css/02-vesica.css',
  '/css/03-controls.css', '/css/04-ui.css', '/css/05-mobile.css',
  '/js/lib/Tone.js',
  '/js/01-config.js', '/js/02-audio.js', '/js/03-backgrounds.js',
  '/js/04-vesica-ui.js', '/js/05-controls.js', '/js/06-ui-builders.js',
  '/js/07-app.js', '/js/08-bowl-engine.js', '/js/09-omcv-sphere.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && !e.request.url.startsWith('chrome-extension')) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
