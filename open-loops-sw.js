const CACHE = 'open-loops-v10-icons';

const NETWORK_FIRST = [
  './open-loops.html',
  './open-loops-config.js'
];

const CACHE_FIRST = [
  './open-loops-manifest.json',
  './open-loops-icon-192-v2.png',
  './open-loops-icon-512-v2.png'
];

const ASSETS = [...NETWORK_FIRST, ...CACHE_FIRST];

const EXTERNAL_HOSTS = [
  'supabase.co',
  'jsdelivr.net',
  'fonts.googleapis',
  'fonts.gstatic',
  'accounts.google'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function pathMatches(request, candidates) {
  const url = new URL(request.url);
  return candidates.some(path => url.pathname.endsWith(path.replace('./', '/')));
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return await caches.match(request) || await caches.match('./open-loops.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function externalNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque' || response.type === 'cors')) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return await caches.match(request) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  const url = new URL(event.request.url);

  if (EXTERNAL_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(externalNetworkFirst(event.request));
    return;
  }

  if (url.origin === location.origin && pathMatches(event.request, NETWORK_FIRST)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    cacheFirst(event.request).catch(() => caches.match('./open-loops.html'))
  );
});
