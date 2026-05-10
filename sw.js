const CACHE = 'ciscolearn-v2';
const PRECACHE = [
  '/ciscolearn/',
  '/ciscolearn/index.html',
  '/ciscolearn/icon.svg',
  '/ciscolearn/icon-192.png',
  '/ciscolearn/icon-512.png',
  '/ciscolearn/manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/ciscolearn/index.html'));
    })
  );
});
