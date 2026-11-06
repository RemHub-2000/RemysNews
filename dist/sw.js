const scope = self.registration.scope;
const prefix = 'remys-morning-brief:' + scope + ':';
const cacheName = prefix + 'v1';
const shell = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const shellPaths = new Set(shell.map(path => new URL(path, scope).href));
const editionURL = new URL('./editions.json', scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(shell.map(path => new Request(new URL(path, scope), {cache: 'reload'})));
    // Offline launch should work after the first successful online visit.
    try {
      const response = await fetch(editionURL, {cache: 'no-store'});
      if (response.ok) await cache.put(editionURL, response);
    } catch {}
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const isEdition = request.url === editionURL;
  const isNavigation = request.mode === 'navigate' && new Set([scope, new URL('./index.html', scope).href]).has(request.url.split('?')[0]);
  if (!isEdition && !isNavigation && !shellPaths.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const key = isNavigation ? scope : request.url;
    try {
      const response = await fetch(request, {cache: isEdition || isNavigation ? 'no-store' : 'no-cache'});
      if (response.ok && !response.redirected) {
        try { await cache.put(key, response.clone()); } catch {}
      }
      // Do not serve an offline copy in place of an explicit access denial.
      return response;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  })());
});
