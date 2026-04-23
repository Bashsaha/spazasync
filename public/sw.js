/**
 * Movestock Service Worker
 *
 * Strategy:
 *  - install         → precache app shell + offline fallback
 *  - /_next/static/  → cache-first (content-hashed, safe to cache forever)
 *  - /api/products   → stale-while-revalidate (enables offline barcode lookup)
 *  - /api/*          → network-only (auth-sensitive mutations must reach server)
 *  - navigation      → network-first, fall back to cache, then /offline.html
 */

const CACHE = 'movestock-v1'

/** Critical routes precached on install so the app works offline from first install. */
const PRECACHE_URLS = [
  '/offline.html',
  '/sale',
  '/login',
  '/dashboard',
  '/settings',
]

// ── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED' }))
        }),
      ),
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Next.js static chunks — cache-first (they're content-hashed)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            caches.open(CACHE).then((c) => c.put(request, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Products API — stale-while-revalidate so barcode scanning works offline
  // Each unique URL (e.g. ?barcode=12345) is cached separately.
  if (url.pathname === '/api/products') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)

        // Always try to refresh in the background
        const networkPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          .catch(() => null)

        // Return cached immediately; await network if nothing cached yet
        if (cached) {
          networkPromise // fire-and-forget background refresh
          return cached
        }

        return (
          (await networkPromise) ??
          new Response('[]', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }),
    )
    return
  }

  // All other API routes — network only (never cache auth/mutation endpoints)
  if (url.pathname.startsWith('/api/')) return

  // Page navigation — network-first, fall back to cached version, then offline page
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(request, res.clone()))
        }
        return res
      })
      .catch(() =>
        caches.match(request).then((cached) =>
          cached ?? caches.match('/offline.html'),
        ),
      ),
  )
})
