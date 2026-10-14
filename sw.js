const CACHE_NAME = 'cuacaku-sekitarku-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/leaf.svg',
  '/manifest.webmanifest',
  '/css/style.css',
  '/css/responsive.css',
  '/css/features.css',
  '/js/data.js',
  '/js/sekitarku-data.js',
  '/js/app.js',
  '/js/sekitarku.js',
  '/js/charts.js',
  '/js/radar.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Navigation / Document: Network First, fallback to cached index.html
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Real-time External & Internal APIs (BMKG, Open-Meteo, /api/*): Network First with Cache Fallback
  if (
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('data.bmkg.go.id') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Static JS/CSS/Fonts/Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('widgetinstall', (event) => {
  event.waitUntil(updateWidgetData());
});

self.addEventListener('widgetresume', (event) => {
  event.waitUntil(updateWidgetData());
});

self.addEventListener('widgetclick', (event) => {
  if (event.action === 'refresh') {
    event.waitUntil(updateWidgetData());
  } else if (self.clients && self.clients.openWindow) {
    event.waitUntil(self.clients.openWindow('/'));
  }
});

async function updateWidgetData() {
  try {
    const template = await (await fetch('/widget.json')).text();
    const data = await (await fetch('/api/widget')).text();
    if (self.widgets && self.widgets.updateByTag) {
      await self.widgets.updateByTag('sekitarku-widget', { template, data });
    }
  } catch (e) {
    // Ignore widget update error
  }
}
