/**
 * Movestock Service Worker
 *
 * Strategy:
 *  - install              → precache /offline.html ONLY. Authenticated routes
 *                            are deliberately NOT precached — their HTML
 *                            contains per-user data (shop name, today's
 *                            checklist state, locale-specific strings) and
 *                            references build-specific chunk hashes that
 *                            become stale on every deploy. (BUG-040)
 *  - /_next/static/       → cache-first (content-hashed, safe to cache forever)
 *  - SWR_GET_PATHS        → stale-while-revalidate for stable read endpoints
 *                            (offline support + instant repeat-load). These
 *                            are user-scoped via auth cookie and explicitly
 *                            read-only.
 *  - /api/* (other)       → network-only (auth-sensitive mutations)
 *  - navigation HTML      → network-first with /offline.html fallback. NEVER
 *                            cache the HTML response: a previous BUG-039 SWR
 *                            strategy caused cross-day stale renders (the
 *                            checklist FAB went missing) and post-deploy
 *                            chunk-404 stalls ("pages refuse to load").
 *                            RSC payloads are the fast path for client-side
 *                            navigations; cached HTML never was.
 */

const CACHE = 'movestock-v41'

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

/** Only /offline.html is safe to precache — it has no per-user data and no
 *  build-specific chunk references. Authenticated routes are NEVER precached
 *  (BUG-040). */
const PRECACHE_URLS = ['/offline.html']

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

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return

  // Mutations to a SWR-cached resource (or any sub-path of it) invalidate the
  // cached GET response so the next read hits network. Without this, e.g. a
  // POST /api/tellers (add) or PATCH /api/tellers/:id (remove) succeeds but
  // the immediately-following GET /api/tellers still serves the stale pre-
  // mutation snapshot from the SW SWR cache — the new teller doesn't appear
  // and the removed one keeps showing until the next visibility-triggered
  // refetch happens to land after the background revalidation completes.
  if (request.method !== 'GET') {
    const swrPath = SWR_GET_PATHS.find(
      (p) => url.pathname === p || url.pathname.startsWith(p + '/'),
    )
    if (swrPath) {
      event.waitUntil(
        caches.open(CACHE).then(async (cache) => {
          const keys = await cache.keys()
          await Promise.all(
            keys
              .filter((req) => new URL(req.url).pathname === swrPath)
              .map((req) => cache.delete(req)),
          )
        }),
      )
    }
    return // Mutation passes through to network
  }

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

  // Only treat top-level document loads as "navigation". Next.js client-side
  // navigations issue RSC payload fetches (request.destination !== 'document',
  // and usually carry an RSC header or _rsc= query param) — those must always
  // hit the network so the user sees the current server-rendered state.
  const isDocument =
    request.mode === 'navigate' ||
    request.destination === 'document'
  const isRscPayload =
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  if (!isDocument || isRscPayload) return

  // Page navigation — network-first, /offline.html fallback. We deliberately
  // do NOT cache navigation HTML: it contains per-user data and references
  // build-specific chunk hashes that 404 after the next deploy. The fast path
  // for repeat visits is the in-flight Next.js router prefetch + cached RSC
  // payload, not a stale HTML snapshot. (BUG-040)
  event.respondWith(
    fetch(request).catch(() =>
      caches.open(CACHE).then((cache) => cache.match('/offline.html')),
    ),
  )
})
