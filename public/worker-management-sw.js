const CACHE_VERSION = "mfms-worker-shell-v2"
const WORKER_SHELL = [
  "/worker-management",
  "/worker-management/daily-attendance",
  "/worker-management/workers",
  "/worker-management/weekly-settlement",
  "/worker-management/loan-register",
  "/worker-management/dashboard",
  "/worker-management/query",
  "/worker-management.webmanifest",
  "/muthu-farms-logo.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(WORKER_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("mfms-worker-shell-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

function isWorkerNavigation(request, url) {
  return request.mode === "navigate" && url.pathname.startsWith("/worker-management")
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/muthu-farms-logo.png" ||
    url.pathname === "/worker-management.webmanifest"
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return

  if (isWorkerNavigation(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached ?? caches.match("/worker-management")
        }),
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)))
          }
          return response
        }),
      ),
    )
  }
})
