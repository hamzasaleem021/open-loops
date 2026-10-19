// Bump on every release, together with APP_VERSION in open-loops.html.
const CACHE = 'open-loops-v21-profile';

const NETWORK_FIRST = [
  './open-loops.html',
  './open-loops-config.js'
];

const CACHE_FIRST = [
  './open-loops-manifest.json',
  './open-loops-icon-192-v4.png',
  './open-loops-icon-512-v4.png',
  './open-loops-nudge-192.png',
  './open-loops-badge-96.png'
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
      // cache: 'reload' skips the browser's own HTTP cache, so a new version
      // never stores an older copy of the page the browser had lying around.
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
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

// no-cache: always ask the server whether the file changed (a tiny "not
// modified" reply when it didn't). GitHub Pages lets browsers reuse a copy for
// 10 minutes, which could otherwise show the old version after a release.
function fresh(request) {
  // Some browsers refuse to copy a page load with new options, so a page load
  // is rebuilt from its URL; redirects are handed back to the browser as before.
  return request.mode === 'navigate'
    ? new Request(request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' })
    : new Request(request, { cache: 'no-cache' });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(fresh(request));
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

// ── NUDGES (web push) ──
// The Supabase "push" function sends a nudge when a parked loop wakes up, and
// a check-in at the time you picked. The payload is JSON:
// { title, body, url, tag, renotify?, actions?, token?, actionUrl? }.
const ICON = './open-loops-nudge-192.png';
const BADGE = './open-loops-badge-96.png';

// The app is open and in front of you: it says it there instead of buzzing
// the phone. A test always shows as a real notification.
async function focusedWindow() {
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return wins.find(w => w.focused && w.visibilityState === 'visible') || null;
}

self.addEventListener('push', event => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; }
  catch (_) { msg = { body: event.data ? event.data.text() : '' }; }
  const title = msg.title || 'Open Loops';
  const url = new URL(msg.url || './open-loops.html', self.registration.scope).href;
  const options = {
    body: msg.body || '',
    icon: ICON,
    badge: BADGE,
    tag: msg.tag || 'open-loops-nudge',
    // A new wake-up rings again even if an older one is still showing.
    renotify: !!msg.renotify,
    data: { url, token: msg.token || null, actionUrl: msg.actionUrl || null }
  };
  // Done / Tomorrow need a signed token; without one, a tap just opens the app.
  if (msg.token && Array.isArray(msg.actions)) options.actions = msg.actions.slice(0, 2);
  event.waitUntil((async () => {
    const win = msg.tag === 'open-loops-test' ? null : await focusedWindow();
    if (win) {
      win.postMessage({ type: 'nudge', title, body: options.body, url });
      return;
    }
    await self.registration.showNotification(title, options);
  })());
});

async function openApp(url) {
  const target = new URL(url || './open-loops.html', self.registration.scope).href;
  const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const w of wins) {
    if ('focus' in w) {
      await w.focus();
      w.postMessage({ type: 'open', url: target });
      return;
    }
  }
  if (self.clients.openWindow) await self.clients.openWindow(target);
}

self.addEventListener('notificationclick', event => {
  const n = event.notification;
  const d = n.data || {};
  n.close();
  if ((event.action === 'done' || event.action === 'tomorrow') && d.token && d.actionUrl) {
    event.waitUntil((async () => {
      let ok = false;
      try {
        const r = await fetch(d.actionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job: 'action', token: d.token, action: event.action })
        });
        ok = r.ok && !!(await r.json().catch(() => ({}))).ok;
      } catch (_) {}
      if (!ok) { await openApp(d.url); return; }   // couldn't do it from here: open the app instead
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      wins.forEach(w => w.postMessage({ type: 'loops-changed' }));
      const text = event.action === 'done' ? 'Closed. One thing out of your head.' : 'Back tomorrow at 9:00.';
      await self.registration.showNotification(text, { icon: ICON, badge: BADGE, tag: 'open-loops-done', silent: true });
      await new Promise(resolve => setTimeout(resolve, 4000));
      const shown = await self.registration.getNotifications({ tag: 'open-loops-done' });
      shown.forEach(x => x.close());
    })());
    return;
  }
  event.waitUntil(openApp(d.url));
});

// The browser rotated this phone's subscription: get a new one. The app
// saves it to Supabase the next time it opens.
self.addEventListener('pushsubscriptionchange', event => {
  const options = event.oldSubscription && event.oldSubscription.options;
  if (!options || !options.applicationServerKey) return;
  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey }).catch(() => {}));
});
