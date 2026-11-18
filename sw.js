/* Rhomeo service worker: offline app shell + safe runtime caching. Bump VERSION to roll out a new shell. */
const VERSION = 'rhomeo-v1';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';
const PRECACHE = [
  './', 'index.html', 'manifest.json',
  'icons/favicon.svg', 'icons/favicon-32.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/rhomeo-logo.png', 'icons/rhomeo-wordmark.png'
];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('rhomeo-') && k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const put = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(name).then(c => c.put(req, copy)).catch(() => {}); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // never touch the backend: auth, database, edge functions, realtime, uploads, anything with credentials
  if (/supabase\.(co|in)$/.test(url.hostname) || url.pathname.includes('/functions/v1/') || url.pathname.includes('/auth/v1/') || req.headers.has('range')) return;

  // pages: network first (always fresh), fall back to the cached shell when offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => put(SHELL, 'index.html', r)).catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  // same-origin files (icons, manifest): cache first, refreshed in the background
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => put(SHELL, req, r)).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // pinned CDN libraries and fonts: cache first (versioned URLs never change)
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(RUNTIME, req, r))));
  }
});
