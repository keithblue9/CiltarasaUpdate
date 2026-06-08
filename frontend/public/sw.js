/* Ciltarasa Service Worker
 * Strategy:
 *  - precache app shell + icons
 *  - cache-first for static assets (CSS/JS/images/fonts)
 *  - network-first for API + navigation
 *  - offline fallback page when network fails
 *  - background sync queue for offline orders
 */

const VERSION = 'ciltarasa-v1.2.0-notif-alert';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const API_CACHE = `${VERSION}-api`;

const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---- Install ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// ---- Activate ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Skip cross-origin analytics
  if (url.hostname.includes('posthog.com') || url.hostname.includes('emergent.sh')) return;

  // Navigation requests → network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // API requests → network-first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful GETs for API
          if (res && res.status === 200 && req.method === 'GET') {
            const copy = res.clone();
            caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => {
          // Image fallback (transparent 1px)
          if (req.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});

// ---- Background sync (offline orders queue) ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'ciltarasa-order-sync') {
    event.waitUntil(replayQueuedOrders());
  }
});

async function replayQueuedOrders() {
  try {
    const cache = await caches.open(`${VERSION}-orders-queue`);
    const keys = await cache.keys();
    for (const req of keys) {
      try {
        const resp = await cache.match(req);
        const body = await resp.json();
        const r = await fetch(body.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body.payload),
        });
        if (r.ok) await cache.delete(req);
      } catch (e) { /* keep in queue */ }
    }
  } catch (e) { /* noop */ }
}

// ---- Push notifications (Ciltarasa Seller) ----
self.addEventListener('push', (event) => {
  let data = { title: 'Ciltarasa', body: 'Notifikasi baru' };
  if (event.data) {
    try { data = event.data.json(); } catch { data = { title: 'Ciltarasa', body: event.data.text() }; }
  }
  event.waitUntil(
    (async () => {
      // 1) Show OS notification (background + lock screen)
      await self.registration.showNotification(data.title || 'Ciltarasa', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        // Strong attention-grabbing vibrate (Android — iOS ignores this)
        vibrate: [300, 100, 300, 100, 300, 100, 500],
        tag: data.tag || 'order-new',
        renotify: true,
        silent: false, // explicit: play default OS sound
        requireInteraction: !!data.requireInteraction,
        timestamp: Date.now(),
        data: {
          url: data.url || '/#/seller',
          order_number: data.order_number || null,
          alert_type: data.alert_type || 'order',
          ...(data.data || {}),
        },
        actions: data.actions || [
          { action: 'open', title: 'Buka Dashboard' },
        ],
      });

      // 2) Forward to any open page so it can play in-page audio + vibrate
      //    (covers the case where app is open but OS suppresses showNotification sound)
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clients) {
          c.postMessage({
            type: 'PUSH_RECEIVED',
            payload: {
              alert_type: data.alert_type || 'order',
              order_number: data.order_number,
              title: data.title,
              body: data.body,
            },
          });
        }
      } catch (e) {
        // ignore
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/#/seller';
  // Focus existing tab jika ada, else open new
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.includes(url.split('?')[0]) && 'focus' in c) {
          c.postMessage({ type: 'NAVIGATE', url });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ---- Messaging from page ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
