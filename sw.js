const CACHE_NAME = 'tapgod-v3';
const urlsToCache = ['/'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // CRITICAL: only handle requests to our own site. Never intercept
  // cross-origin requests (Google Fonts, Supabase CDN, etc) — doing so
  // broke those resources entirely and crashed the whole page's auth.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  
  event.respondWith(
    fetch(event.request).then(response => {
      if (!response || response.status !== 200) {
        return caches.match(event.request).then(cached => cached || response);
      }
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(event.request, responseToCache);
      });
      return response;
    }).catch(() => caches.match(event.request))
  );
});
