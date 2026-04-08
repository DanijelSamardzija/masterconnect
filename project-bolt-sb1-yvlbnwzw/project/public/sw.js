const CACHE_VERSION = '2025-02-28-v8-build-marker-001';
const CACHE_NAME = `majstor-servis-v${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/feed',
  '/discover',
  '/messages',
  '/profile',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing new service worker version:', CACHE_VERSION);
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching important routes');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new service worker version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't intercept non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Don't intercept Supabase requests
  if (url.origin.includes('supabase')) {
    return;
  }

  // Don't intercept API routes - they have authentication headers that change
  // IMPORTANT: Always fetch fresh data for /api/posts (feed)
  if (url.pathname.startsWith('/api/')) {
    console.log('[SW] Network-only for API route:', url.pathname);
    event.respondWith(
      fetch(event.request)
        .catch(err => {
          console.error('[SW] API fetch failed:', err);
          return new Response(JSON.stringify({ error: 'Network error' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // For all other requests, use network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache (offline):', event.request.url);
            return cachedResponse;
          }

          if (event.request.destination === 'document') {
            return caches.match('/');
          }

          return new Response('Offline - No cached version available', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});
