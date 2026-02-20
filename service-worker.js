const CACHE_NAME = 'claim-construct-v1';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './js/config.js',
    './js/storage.js',
    './js/map.js',
    './js/resources.js',
    './js/base.js',
    './js/game.js',
];

// Install event - cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
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
        }).then(() => self.clients.claim())
    );
});

// Fetch event - cache first, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // For external resources (CDN), use network first, fallback to cache
    if (event.request.url.includes('cdn.jsdelivr.net') || 
        event.request.url.includes('openstreetmap.org')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache successful responses
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    } else {
        // Cache first for local resources
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                        return response;
                    });
                })
                .catch(() => new Response('Offline - Resource not available'))
        );
    }
});
