/* Rhythm-39 service worker: cache the app shell so it works offline once visited.
   Bump CACHE when shipping changes so clients pick up new files. */
const CACHE = 'rhythm39-v15';
const SHELL = ['./', './index.html', './style.css', './core.js', './app.js', './kits.js', './sampler.js', './song.js', './mixer.js', './library.js', './projects.js', './qr.js', './midi.js', './export.js', './crush-worklet.js', './capture-worklet.js', './help.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, fall back to cache: during development you always get fresh files,
// offline you still get the last good copy.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
