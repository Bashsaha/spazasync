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

const CACHE = 'movestock-v89'

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
//
// Path match is EXACT here (not prefix). Sub-paths like '/api/products/popular'
// need their own entry. Mutation invalidation below uses prefix match so a
// POST/PATCH on '/api/tellers/:id' clears the cached '/api/tellers' list AND
// any cached sub-paths of '/api/tellers' (e.g. '/api/tellers/me').
//
// Note: '/api/daily-checklist/status' is deliberately NOT here — the route
// returns `Cache-Control: no-store` because the checklist buzzer relies on
// fresh state to clear immediately on save and to flip on a new-day rollover.
// Caching it caused stale buzzer visibility for ~10s after completing.
const SWR_GET_PATHS = [
  '/api/products',
  '/api/products/popular',
  '/api/settings',
  '/api/tellers',
  '/api/tellers/me',
  '/api/suppliers',
  '/api/business-documents',
  '/api/compliance-score',
  '/api/compliance-reminders',
  '/api/access-requests',
  '/api/daily-checklist',
  '/api/pest-control',
  '/api/waste-management',
  '/api/inventory/summary',
  '/api/dashboard',
  '/api/sales/hub',
]

/** Only /offline.html is safe to precache atomically — no per-user data, no
 *  build-specific chunk references. Authenticated routes are NEVER precached
 *  (BUG-040). The App Shell splash `/` is ALSO data-free + safe to cache (Phase
 *  44) but is precached best-effort below so a transient non-200 can't fail the
 *  whole install. */
const PRECACHE_URLS = ['/offline.html']

// The static, data-free App Shell entry. Precached + served cache-first so a
// cold open (manifest start_url) paints the branded splash instantly.
const APP_SHELL_DOC = '/'

// Authenticated routes whose HTML is now DATA-FREE per locale (Phase 44 Stage 2
// — the (app) layout bakes no per-shop data; chrome renders client-side). Safe
// to SW-cache + serve instantly on cold open. Cached PER-LOCALE (keyed off the
// mvs_locale cookie) so each language gets its correct copy with no flash.
// ONLY add a route here once it renders NO per-user server data (BUG-040).
const SHELL_DOC_LOCALE_PATHS = ['/sale', '/dashboard']
const SUPPORTED_LOCALES = ['en', 'so', 'am', 'zu', 'ur']

/** Locale from the request's mvs_locale cookie (default 'en'). Lets us cache a
 *  separate shell copy per language. */
function localeFromRequest(request) {
  const cookie = request.headers.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)mvs_locale=([a-zA-Z]{2})/)
  const loc = m ? m[1].toLowerCase() : 'en'
  return SUPPORTED_LOCALES.indexOf(loc) !== -1 ? loc : 'en'
}

/** Cache-first read of a stored response, with background revalidate. Shared by
 *  the App Shell document branches. `key` may be a synthetic string. */
function shellCacheFirst(event, request, key) {
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key)
      const networkPromise = fetch(request)
        .then((res) => {
          // Only cache a clean, same-URL 200. A redirected response (e.g. an
          // expired owner's /dashboard → /subscribe, or a teller's /sale →
          // /shop-suspended) must NOT be cached under the original key, or we'd
          // serve the wrong page next cold open. The client gates in AppChrome
          // re-enforce these redirects on the cached-serve path anyway.
          if (res.ok && !res.redirected) cache.put(key, res.clone())
          return res
        })
        .catch(() => null)
      if (cached) {
        networkPromise // fire-and-forget background refresh
        return cached
      }
      return (
        (await networkPromise) ??
        (await cache.match('/offline.html')) ??
        new Response('', { status: 503, statusText: 'Offline' })
      )
    }),
  )
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(async (cache) => {
        await cache.addAll(PRECACHE_URLS)
        // Best-effort: don't fail install (→ no SW) if the splash momentarily 500s.
        try {
          await cache.add(APP_SHELL_DOC)
        } catch {
          /* will be cached on first navigation instead */
        }
      })
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
  // cached GET response so the next read hits network. We clear BOTH the
  // matched SWR base path AND any other cached SWR entries that share its
  // prefix — e.g. a POST /api/daily-checklist invalidates the cached
  // /api/daily-checklist GET AND the cached /api/daily-checklist/status GET.
  // Without this, a freshly-completed checklist would still see the FAB stuck
  // visible for up to 10s while the SW background-revalidated the status
  // endpoint.
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
              .filter((req) => {
                const path = new URL(req.url).pathname
                // Invalidate the matched path itself + any sub-paths of it
                // (so POST /api/daily-checklist clears both /api/daily-checklist
                // and /api/daily-checklist/status).
                return path === swrPath || path.startsWith(swrPath + '/')
              })
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

  // App Shell entry `/` — static + data-free splash (Phase 44 Stage 1). Serve
  // cache-first (instant cold open). BUG-040-safe: no per-user data; the CACHE
  // version bump on every deploy evicts the old copy + its chunk refs. No
  // translated text on the splash, so a single (locale-agnostic) copy is fine.
  if (url.pathname === APP_SHELL_DOC) {
    shellCacheFirst(event, request, APP_SHELL_DOC)
    return
  }

  // Data-free authenticated shell routes (Phase 44 Stage 2, e.g. /sale). The
  // (app) layout bakes NO per-shop data; the chrome renders client-side, so the
  // HTML is identical for everyone on a given LOCALE. Cache + serve cache-first
  // keyed PER-LOCALE (mvs_locale cookie) so languages don't bleed into each
  // other. BUG-040-safe ONLY because these routes are verified data-free.
  if (SHELL_DOC_LOCALE_PATHS.indexOf(url.pathname) !== -1) {
    const locale = localeFromRequest(request)
    shellCacheFirst(event, request, `shell:${url.pathname}::${locale}`)
    return
  }

  // Page navigation — network-first, /offline.html fallback. We deliberately
  // do NOT cache navigation HTML: it contains per-user data and references
  // build-specific chunk hashes that 404 after the next deploy. The fast path
  // for repeat visits is the in-flight Next.js router prefetch + cached RSC
  // payload, not a stale HTML snapshot. (BUG-040)
  //
  // 25s timeout race: on mobile, when the radio is suspended by Android's
  // battery-save heuristics, fetch() can hang indefinitely until a user
  // interaction wakes the radio — the symptom is "the screen loads endlessly
  // until I tap on the screen". Bailing to offline.html after 25s lets the
  // user see something and reload, rather than staring at a blank page.
  // (Bumped from 15s — 15s was firing during normal slow-3G cold opens and
  // the user saw a misleading "You're offline" message while actually online.
  // The offline.html template auto-reloads, so the user doesn't need to tap.)
  event.respondWith(
    new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        caches.open(CACHE).then((cache) =>
          cache.match('/offline.html').then((res) =>
            resolve(res ?? new Response('', { status: 504 })),
          ),
        )
      }, 25000)

      fetch(request)
        .then((res) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(res)
        })
        .catch(() => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          caches.open(CACHE).then((cache) =>
            cache.match('/offline.html').then((res) =>
              resolve(res ?? new Response('', { status: 504 })),
            ),
          )
        })
    }),
  )
})
