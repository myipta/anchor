// Anchor service worker — offline app shell + safe runtime caching.
// Bump CACHE on any shell change to force an update.
const CACHE = 'anchor-v2';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest',
  '/vendor/react.min.js', '/vendor/react-dom.min.js', '/vendor/babel.min.js',
  '/icon-192.png', '/icon-512.png', '/icon-180.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Don't fail the whole install if one asset 404s.
    await Promise.allSettled(SHELL.map(u => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API calls: always network, never cached (they need fresh data + auth).
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // Navigations / index: network-first so deploys show immediately; cache fallback offline.
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE); c.put('/index.html', net.clone());
        return net;
      } catch {
        return (await caches.match('/index.html')) || (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // Same-origin static assets: cache-first, fall back to network and populate.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const net = await fetch(req);
        if (net.ok) { const c = await caches.open(CACHE); c.put(req, net.clone()); }
        return net;
      } catch { return hit || Response.error(); }
    })());
  }
});
