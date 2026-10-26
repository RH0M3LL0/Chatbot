const CACHE = 'rhomeo-v3';
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(['./', './index.html', './manifest.json', ...CDN].map(u => c.add(u)))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.hostname.endsWith('supabase.co') || u.hostname.includes('googleapis.com')) return;
  if (r.mode === 'navigate') { // page: newest version when the network answers within 4s, saved copy otherwise
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, j) => setTimeout(j, 4000))]);
        const copy = res.clone(); c.put('./index.html', copy);
        return res;
      } catch { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); }
    })());
    return;
  }
  e.respondWith(caches.match(r).then(hit => { // libraries and files: instant from cache, refreshed in the background
    const net = fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
