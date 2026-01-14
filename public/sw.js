// Service Worker for Push Notifications
const CACHE_VERSION = 'v3';
const CACHE_NAME = `cardpon-cache-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  // Do NOT call skipWaiting() here - let it be controlled via message
  // This prevents the infinite reload loop
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all caches that don't match current version
          if (cacheName !== CACHE_NAME && cacheName.startsWith('cardpon-cache-')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          // Also delete workbox caches that might be stale
          if (cacheName.includes('workbox') || cacheName.includes('supabase')) {
            console.log('Cleaning cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => {
      // Take control of all clients - but don't force reload from here
      return clients.claim();
    })
  );
});

// Fetch event - always try network first for HTML and JS files
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // For navigation requests and JS/CSS files, always use network-first
  if (event.request.mode === 'navigate' || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // Only use cache as fallback when offline
          return caches.match(event.request);
        })
    );
    return;
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Cardpon',
    body: 'Você tem uma nova notificação',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'default',
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('Push payload:', payload);
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {},
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Ver detalhes',
      },
      {
        action: 'close',
        title: 'Fechar',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Get the URL from notification data
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Listen for messages to force update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
