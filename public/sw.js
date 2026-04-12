const CACHE_NAME = "compareng-tools-static-v1"

const APP_SHELL = [
  "/",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/apple-icon.png",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/android-icon-192x192.png"
]

const offlineResponse = new Response("Offline", {
  status: 503,
  statusText: "Service Unavailable",
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
  },
})

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
          return undefined
        })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET" || request.url.startsWith("chrome-extension")) {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  const acceptHeader = request.headers.get("Accept") || ""
  const isApiRequest = url.pathname.startsWith("/api/") || acceptHeader.includes("application/json")
  const isNavigationRequest =
    request.mode === "navigate" ||
    (acceptHeader.includes("text/html") && !url.pathname.startsWith("/_next"))

  if (isApiRequest) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        return cached || offlineResponse.clone()
      })
    )
    return
  }

  if (isNavigationRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const appShell = await caches.match("/")
          return appShell || offlineResponse.clone()
        })
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => {})
          return response
        })
        .catch(() => cachedResponse || offlineResponse.clone())

      return cachedResponse || fetchPromise
    })
  )
})
