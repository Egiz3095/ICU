/* ICU MCQ service worker: the page is fetched fresh when online (so new uploads show at once)
   and served from cache when offline. Libraries and fonts are cached after first use.
   Supabase requests (login, progress, questions) always go to the network. */
const CACHE = 'icu-mcq-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
const LIBS = /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache:'reload'})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function pageFromNetwork(req){
  // give a slow network 5 s before falling back to the cached copy
  const net = fetch(req, {cache:'no-cache'}).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, 5000)).then(() => caches.match('index.html'));
  return Promise.race([net.catch(() => caches.match('index.html')), timeout.then(r => r || net)])
    .then(r => r || caches.match('index.html'));
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || /supabase\.co$/.test(url.hostname)) return;
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) { e.respondWith(pageFromNetwork(req)); return; }
  if (url.origin === location.origin || LIBS.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
      return hit ? (net.catch(() => {}), hit) : net;
    }));
  }
});
