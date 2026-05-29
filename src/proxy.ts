import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTellerInventoryGranted } from '@/lib/db/access-requests'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/onboarding', '/auth/callback', '/api/auth/teller-login', '/api/onboarding', '/api/subscribe/notify', '/api/external']

// Routes a teller can always reach — pre- or post-grant.
// Includes /inventory (the request-access UI lives there), the access-request
// API, and /profile (where Switch user lives).
const TELLER_ALWAYS_ALLOWED = [
  '/sale',
  '/inventory',
  '/profile',
  '/api/access-requests',
  // existing API endpoints the sale flow uses
  '/api/sales',
  '/api/products',
  '/api/tellers/me',
  '/api/summary',
]

// Routes a teller can only reach with an active inventory grant. Scope is
// deliberately limited to the stock count: a granted teller can count stock and
// update the numbers, nothing more. Products, stock adjustments, expiry and
// suppliers stay owner-only. /api/products is read-only and already in
// TELLER_ALWAYS_ALLOWED (the sale flow + the count list both need it).
// NOTE: /stock-take must come before any '/stock' prefix check would shadow it;
// it's matched on its own here so '/stock' (adjustments) is NOT granted.
const TELLER_GRANTED_ONLY = [
  '/stock-take',
  '/api/stock-take',
]

// Routes accessible even when subscription is expired
const SUBSCRIPTION_EXEMPT = ['/subscribe', '/api/subscribe', '/settings', '/api/settings', '/api/account']

// Admin-only routes
const ADMIN_ROUTES = ['/admin', '/api/admin']

/** Exact-match or trailing-slash sub-route check. */
function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * `script-src 'self' 'nonce-…'` (note: NO 'unsafe-inline', NO 'unsafe-eval')
 * means the browser only runs scripts that are either same-origin `<script src>`
 * (our Next.js chunks) or carry this exact nonce (Next.js auto-stamps it on its
 * inline hydration scripts when it sees the nonce in the request CSP header, and
 * the root layout stamps it on the one inline beforeinstallprompt script). An
 * injected inline `<script>` from an XSS payload has no nonce → blocked.
 *
 * We deliberately omit 'strict-dynamic': with plain `'self' 'nonce-…'`, a
 * same-origin chunk that somehow misses the nonce still loads via 'self', so a
 * stray un-nonced framework script degrades to "still works" rather than
 * "white screen" — the safer failure mode for an auth-critical path.
 *
 * style-src keeps 'unsafe-inline' (Next.js + next/font + Tailwind inject inline
 * styles; nonce-ing those is a separate, larger task and not in scope here).
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.payfast.co.za https://sandbox.payfast.co.za",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://www.payfast.co.za https://sandbox.payfast.co.za",
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Per-request CSP nonce ──────────────────────────────────
  // Generated once per request and threaded onto BOTH the forwarded request
  // headers (so Next.js can read `x-nonce` / the CSP and stamp its inline
  // scripts + so the root layout can read it via `headers()`) and the response
  // (the header the browser actually enforces).
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  // Apply the enforced CSP header to any outgoing response (next OR redirect).
  const applyCsp = <T extends NextResponse>(res: T): T => {
    res.headers.set('content-security-policy', csp)
    return res
  }
  const redirectTo = (url: URL) => applyCsp(NextResponse.redirect(url))

  // Skip proxy auth logic for Next.js internals and static files. Manifest +
  // service worker MUST be reachable without auth — Chrome's installability
  // checker and the navigator.serviceWorker.register() call both fetch them
  // pre-auth, and a redirect-to-/login would block PWA install (BUG-021).
  // We still forward the nonce + apply the CSP so HTML served from these
  // early-returns (the public legal pages) gets a working policy.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    // Public legal pages (Privacy / Terms). Early-return so they're reachable
    // both logged-out (footer links on /login) AND logged-in (settings footer)
    // — adding them to PUBLIC_ROUTES instead would bounce authenticated users
    // away to their dashboard.
    pathname === '/legal' ||
    pathname.startsWith('/legal/') ||
    pathname.startsWith('/icons/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|css|js|woff|woff2|ttf|json|webmanifest)$/)
  ) {
    return applyCsp(NextResponse.next({ request: { headers: requestHeaders } }))
  }

  let supabaseResponse = applyCsp(NextResponse.next({ request: { headers: requestHeaders } }))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Keep the forwarded request's cookie header in sync with the refreshed
          // tokens so the downstream RSC render reads the new session, not the
          // stale one (BUG-043 cookie-race class). The nonce + CSP request
          // headers are preserved because we re-forward `requestHeaders`.
          requestHeaders.set('cookie', request.headers.get('cookie') ?? requestHeaders.get('cookie') ?? '')
          supabaseResponse = applyCsp(NextResponse.next({ request: { headers: requestHeaders } }))
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Cost-conscious: middleware runs on every request, so we deliberately
  // avoid the auth.getUser() network round-trip and read the JWT locally
  // via getSession(). The @supabase/ssr cookies handler still triggers a
  // refresh-token swap when the access token is near expiry, so sessions
  // stay alive — but the steady state is zero network calls from middleware.
  //
  // Security trade-off: a tampered cookie could lie about role/shop_id, but
  // RLS is the actual security boundary at the data layer, and every API
  // route calls getShopAuth()/requireAdmin() which DO verify the user via
  // getUser() before touching shop-scoped data. Middleware is routing only.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // ── Public routes ──────────────────────────────────────────
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!user) {
    if (isPublic) return supabaseResponse
    // Not authenticated — send to login
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return redirectTo(loginUrl)
  }

  // ── Authenticated — user is logged in ──────────────────────
  // If they're on a public route (e.g. /login), redirect away
  if (isPublic) {
    const role = user.app_metadata?.role as string | undefined
    // Don't redirect away from onboarding pages/API if they haven't set up their shop yet
    if ((pathname.startsWith('/onboarding') || pathname.startsWith('/api/onboarding')) && !role) return supabaseResponse
    const dest = role === 'admin' ? '/admin' : role === 'teller' ? '/sale' : '/dashboard'
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = dest
    return redirectTo(redirectUrl)
  }

  const role = user.app_metadata?.role as string | undefined

  // Owner hasn't completed onboarding yet (no role in metadata).
  // /api/municipalities is reference data the onboarding Area picker needs
  // before a role exists — let it through so the picker can populate.
  if (!role && pathname !== '/onboarding' && !pathname.startsWith('/api/municipalities')) {
    const onboardUrl = request.nextUrl.clone()
    onboardUrl.pathname = '/onboarding'
    return redirectTo(onboardUrl)
  }

  // ── Teller route enforcement ───────────────────────────────
  if (role === 'teller') {
    const isAlwaysAllowed = TELLER_ALWAYS_ALLOWED.some((r) => pathMatches(pathname, r))
    const isGrantedOnly = TELLER_GRANTED_ONLY.some((r) => pathMatches(pathname, r))

    if (!isAlwaysAllowed && !isGrantedOnly) {
      // Path not on either list — bounce back to /sale.
      const saleUrl = request.nextUrl.clone()
      saleUrl.pathname = '/sale'
      return redirectTo(saleUrl)
    }

    if (isGrantedOnly) {
      const granted = await isTellerInventoryGranted(supabase, user.id)
      if (!granted) {
        // Lacking grant — redirect to /inventory where the request-access UI lives.
        const invUrl = request.nextUrl.clone()
        invUrl.pathname = '/inventory'
        return redirectTo(invUrl)
      }
    }
  }

  // ── Admin route enforcement ──────────────────────────────
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r))
  if (isAdminRoute && role !== 'admin') {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = role === 'teller' ? '/sale' : '/dashboard'
    return redirectTo(dashUrl)
  }

  // Admin users skip subscription gate.
  // Dual-role admins (with shop_id) can also access shop pages — API routes
  // read shop_id from JWT metadata and RLS uses their shop_users row.
  if (role === 'admin') return supabaseResponse

  // ── Subscription gate ────────────────────────────────────
  // Check sub_status and sub_until from JWT metadata (zero DB queries).
  //
  // Allow-list approach: only 'active' and 'manual_override' (with a future
  // sub_until or null) bypass. Any other status — 'trialing', 'cancelled',
  // 'expired' — must have a future sub_until to retain access. A missing or
  // empty sub_until on a non-'active' status is treated as expired, since
  // that's a corrupted state (every trial / cancelled sub MUST carry an end
  // date). Without this defence, owners whose JWT metadata is missing
  // sub_until silently bypass the gate forever.
  const isExempt = SUBSCRIPTION_EXEMPT.some((r) => pathname.startsWith(r))
  if (role && !isExempt) {
    const subStatus = user.app_metadata?.sub_status as string | undefined
    const subUntil = user.app_metadata?.sub_until as string | undefined
    const accessGranted = user.app_metadata?.access_granted as boolean | undefined

    const now = new Date()
    const subUntilDate = subUntil ? new Date(subUntil) : null
    const hasFutureUntil = subUntilDate ? subUntilDate.getTime() > now.getTime() : false
    // 'active' (PayFast recurring) doesn't strictly require a future date —
    // ITN renews it on each cycle. 'manual_override' with null sub_until is
    // an admin-granted indefinite override.
    const isActiveLike =
      (subStatus === 'active' && (hasFutureUntil || !subUntilDate)) ||
      (subStatus === 'manual_override' && (hasFutureUntil || !subUntilDate))
    // 'trialing' / 'cancelled' / anything else needs a future sub_until.
    const isOtherWithFutureUntil =
      hasFutureUntil &&
      subStatus !== 'expired' &&
      subStatus !== 'active' &&
      subStatus !== 'manual_override'

    const isExpired = !(isActiveLike || isOtherWithFutureUntil)

    if (isExpired && !accessGranted) {
      const subUrl = request.nextUrl.clone()
      subUrl.pathname = '/subscribe'
      return redirectTo(subUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimisation)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|apple-touch-icon.png|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|json|webmanifest)$).*)',
  ],
}
