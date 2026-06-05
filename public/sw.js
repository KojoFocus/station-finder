const CACHE_NAME = "station-finder-v1";
const PRECACHE = ["/", "/map-it", "/manifest.json"];

// Install: precache the app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for everything else
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const { pathname } = new URL(e.request.url);

  // Always go network for API routes — never serve stale data
  if (pathname.startsWith("/api/")) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      // Return cached immediately if available, update in background
      return cached ?? networkFetch;
    })
  );
});
