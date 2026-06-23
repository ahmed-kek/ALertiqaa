const CACHE_NAME = 'alertiqaa-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/ad.html',
  '/manifest.json',
  '/logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Firebase API calls (firestore.googleapis.com, identitytoolkit, etc.) - network only, no cache
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com')) {
    return; // don't intercept, let browser handle natively
  }

  // Firebase SDK JS files - network first, cache as fallback
  if (url.hostname.includes('gstatic.com') && url.pathname.includes('firebasejs')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // CDN resources (font-awesome, cdnjs, etc.) - cache first
  if (url.hostname.includes('cdnjs.cloudflare.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Our own pages - network first
  if (url.origin === self.location.origin) {
    // Don't cache Firestore/AppCheck API calls  made to our origin
    if (url.pathname.includes('googleapis') || url.pathname.includes('firestore')) {
      return;
    }
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Default: network first
  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response('Offline', { status: 408 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 408 });
  }
}
