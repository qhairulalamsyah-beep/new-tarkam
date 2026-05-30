const CACHE_NAME = 'tarkam-idm-v3';
const STATIC_ASSETS = [
  '/logo1.webp',
  '/logo.webp',
  '/logo.png',
  '/manifest.json',
];

// Install: precache only image assets (NOT HTML or JS bundles)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches (including v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════════
// PUSH NOTIFICATION SUPPORT
// ═══════════════════════════════════════════════════════════

// Handle incoming push events — show notification
self.addEventListener('push', (event) => {
  let data = {
    title: 'TARKAM IDM',
    body: 'Ada update baru!',
    icon: '/logo.webp',
    url: '/',
    tag: 'idm-notification',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    // Fallback to defaults if data parsing fails
    console.warn('[SW] Push data parse error, using defaults', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.webp',
    badge: '/logo.webp',
    tag: data.tag || 'idm-notification',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'dismiss', title: 'Tutup' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click — open/focus the app window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an existing window and focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Navigate to the target URL and focus
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing window — open a new one
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ═══════════════════════════════════════════════════════════
// FETCH STRATEGY (existing)
// ═══════════════════════════════════════════════════════════

// Fetch strategy:
// - API calls: network-only (never cache)
// - HTML page: network-first (always try fresh, fallback to cache only when offline)
// - JS/CSS bundles: network-first (always get latest code, fallback only when offline)
// - Images/fonts: cache-first (these rarely change)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // API calls: network-only — never cache API responses
  // ★ IMPORTANT: CMS content must always be fresh to prevent "stale flash"
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // HTML page (navigation requests): network-first
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh HTML for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // JS/CSS bundles (_next/static): network-first — always get latest code
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images, fonts, and other static assets: cache-first
  if (url.pathname.match(/\.(webp|jpg|jpeg|png|gif|svg|woff2|woff|ttf|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
