const CACHE = 'pocket-wild-shell-20261006-14';
const PREFIX = 'pocket-wild-shell-';
const APP_SHELL = ['./', './index.html', './styles.css', './app.js', './core.js', './storage.js', './gemma.js', './model-worker.js', './manifest.webmanifest', './icon.svg', './vendor/runtime.json', './vendor/ort-wasm-simd-threaded.asyncify.mjs'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    const manifest = await (await cache.match('./vendor/runtime.json')).json();
    if (manifest.format !== 1 || !Array.isArray(manifest.chunks) || !manifest.chunks.length || manifest.chunks.length > 8 || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid runtime manifest.');
    const pieces = manifest.chunks.map((chunk, index) => {
      if (chunk.file !== `ort-runtime-${manifest.sha256.slice(0, 16)}-${index}.bin` || !Number.isInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > 8 * 1024 * 1024) throw new Error('Invalid runtime chunk.');
      return `./vendor/${chunk.file}`;
    });
    await cache.addAll(pieces);
  })());
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if (!response.ok) throw new Error('Navigation failed');
      const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('./index.html'))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
});
