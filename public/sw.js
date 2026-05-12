/**
 * Movestock Service Worker
 *
 * Strategy:
 *  - install              → precache app shell + offline fallback
 *  - /_next/static/       → cache-first (content-hashed, safe to cache forever)
 *  - SWR_GET_PATHS        → stale-while-revalidate for stable read endpoints
 *                            (offline support + instant repeat-load)
 *  - /api/* (other)       → network-only (auth-sensitive mutations)
 *  - navigation           → network-first, fall back to cache, then /offline.html
 */

const CACHE = 'movestock-v7'

// Resources that MUST always be fetched fresh from the network so Chrome's
// installability checker (and the platform's home-screen icon installer) sees
// the latest manifest + icons. Caching these caused users to keep installing
// the old SVG-only manifest as a non-standalone shortcut. (BUG-021)
const NEVER_CACHE_PATHS = [
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icons/',
  '/sw.js',
]

// Read-only API endpoints safe to serve stale-while-revalidate. Each unique URL
// (incl. query string) is cached separately. Adding endpoints here makes pages
// open instantly on repeat visits and continue to work offline.
const SWR_GET_PATHS = [
  '/api/products',
  '/api/settings',
  '/api/tellers',
  '/api/suppliers',
  '/api/business-documents',
  '/api/compliance-score',
  '/api/daily-checklist',
]

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

  // Never intercept the manifest or icons — Chrome's install pipeline reads
  // these directly to decide whether the site qualifies as a standalone PWA.
  // A stale cached response here makes Chrome install a bookmark shortcut
  // instead of a WebAPK. Let them go straight to network.
  if (NEVER_CACHE_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p))) return

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

  // Stable read endpoints — stale-while-revalidate. Repeat loads are instant
  // (cache hit) while a background fetch keeps the cache fresh for next time.
  // Works offline because the cached response stays available without network.
  if (SWR_GET_PATHS.some((p) => url.pathname === p)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)

        const networkPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          .catch(() => null)

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
