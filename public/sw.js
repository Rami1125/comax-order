const CACHE_NAME = "sidur-noa-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logo.jpg"
];

// Install Service Worker and cache essential shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Serve from cache, fallback to network and update cache dynamically
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Only handle http/https requests; skip chrome-extension://, data:, blob:, etc.
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Skip caching API requests so they can be handled by client-side local sync mechanisms
  if (url.pathname.includes("/api/")) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache).catch(() => {
                /* ignore cache put errors for unsupported schemes */
              });
            });
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        // Stale-while-revalidate: return cached, update in background
        fetchPromise.catch(() => {});
        return cachedResponse;
      }

      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        // If both network and cache fail (e.g. navigation request), return cached index.html
        if (request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return new Response("", { status: 504, statusText: "Gateway Timeout" });
      });
    })
  );
});

// Sync event for background data synchronization
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-orders") {
    console.log("[Service Worker] Background sync triggered for orders");
    // In a full production app, this would trigger background sync API calls
  }
});
