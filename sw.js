const CACHE = 'rhomeo-v10';
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js'
];
const LOCAL = ['./', './index.html', './manifest.json', './icons/favicon.svg', './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled([...LOCAL, ...CDN].map(u => c.add(u)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});

const isFont = u => u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co')) return; // chat data always goes straight to the network

  if (r.mode === 'navigate') { // page: fresh copy if the network answers within 2.5s, otherwise the saved copy (fast on bad networks)
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(j, 2500))]);
        if (res && res.ok) c.put('./index.html', res.clone());
        return res;
      } catch { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); }
    })());
    return;
  }

  // everything else: instant from cache, refreshed quietly in the background
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(r);
    const net = fetch(r).then(res => {
      // fonts come back "opaque" from other origins; they are safe to keep and make repeat visits instant
      if (res && (res.ok || (isFont(u) && res.type === 'opaque'))) c.put(r, res.clone());
      return res;
    }).catch(() => hit);
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })());
});
