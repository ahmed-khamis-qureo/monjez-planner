const VERSION = 'monjez-v2';
const ASSETS = ['./', './index.html', './styles.css', './main.js', './store.js', './timer.js', './ui.js', './utils.js', './views.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
// stale-while-revalidate for same-origin GETs; navigation falls back to the cached shell offline
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
