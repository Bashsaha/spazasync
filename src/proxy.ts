import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTellerInventoryGranted } from '@/lib/db/access-requests'
import { isSubscriptionExpired } from '@/lib/subscription/expiry'
import {
  PUBLIC_ROUTES,
  TELLER_ALWAYS_ALLOWED,
  TELLER_GRANTED_ONLY,
  SUBSCRIPTION_EXEMPT,
  ADMIN_ROUTES,
  pathMatches,
} from '@/lib/auth/route-access'

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * `script-src 'self' 'nonce-…'` (NO 'unsafe-inline', NO 'unsafe-eval') means the
 * browser only runs same-origin `<script src>` (our Next.js chunks) or scripts
 * carrying this exact nonce — Next.js auto-stamps it on its inline hydration
 * scripts when it sees the nonce in the request CSP header, and the root layout
 * stamps it on the one inline beforeinstallprompt script. An XSS-injected inline
 * script has no nonce → blocked.
 *
 * 'strict-dynamic' is deliberately omitted: with plain `'self' 'nonce-…'`, a
 * same-origin chunk that somehow misses the nonce still loads via 'self', so a
 * stray un-nonced framework script degrades to "still works" rather than
 * "white screen" — the safer failure mode for the auth-critical path.
 *
 * style-src keeps 'unsafe-inline' (Next.js + next/font + Tailwind inject inline
 * styles; nonce-ing those is a separate, larger task and out of scope).
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
  // Threaded onto BOTH the forwarded request headers (so Next.js reads the
  // nonce to stamp its inline scripts, and the root layout reads `x-nonce`)
  // and the enforced response header.
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const csp = buildCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  // Build a NextResponse.next() that forwards the nonce'd request headers and
  // carries the enforced CSP. Used everywhere we'd previously have written
  // `NextResponse.next({ request })`.
  const nextResponse = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('content-security-policy', csp)
    return res
  }
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url)
    res.headers.set('content-security-policy', csp)
    return res
  }

  // Skip proxy auth logic for Next.js internals and static files. Manifest +
  // service worker MUST be reachable without auth — Chrome's installability
  // checker and the navigator.serviceWorker.register() call both fetch them
  // pre-auth, and a redirect-to-/login would block PWA install (BUG-021).
  // We still forward the nonce + apply the CSP so HTML served from these
  // early-returns (the public legal pages) gets a working policy.
  if (
    // Vercel Cron endpoints self-authenticate via CRON_SECRET (Bearer) and carry
    // NO session cookie — without this early-return the auth logic below would
    // 307-redirect them to /login BEFORE the handler validates the secret, so the
    // cron body never runs. Each /api/cron/* route checks the secret itself, so
    // bypassing routing-only middleware here weakens nothing.
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    // App Shell entry (Phase 44): `/` is a static, data-free brand splash that
    // client-routes by local session. Early-return so it renders for BOTH
    // logged-out and logged-in cold opens — letting the auth logic below run
    // would bounce it (logged-out → /login, defeating the instant splash).
    pathname === '/' ||
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
    return nextResponse()
  }

  let supabaseResponse = nextResponse()

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
          // Rebuild the FORWARDED request's cookie header from the authoritative
          // cookie store after the refresh, so the refreshed access token
          // reaches the downstream RSC render (the (app)/layout getUser()).
          // Without this, forwarding a stale headers clone would make the layout
          // see no/expired session → redirect('/login') → loop (BUG-043/047).
          requestHeaders.set(
            'cookie',
            request.cookies
              .getAll()
              .map((c) => `${c.name}=${c.value}`)
              .join('; '),
          )
          supabaseResponse = nextResponse()
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
  const isPublic = PUBLIC_ROUTES.some((route) => pathMatches(pathname, route))

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
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathMatches(pathname, r))
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
  //
  // Gate OWNERS ONLY. Tellers can't subscribe (they have no billing identity
  // and their JWT doesn't carry the shop's sub_until), so applying THIS gate to
  // them would redirect them to /subscribe — which teller enforcement above
  // immediately bounces back to /sale, producing an infinite /sale ⇄ /subscribe
  // redirect loop (BUG-047). Teller lockout for an expired shop is enforced
  // separately in (app)/layout.tsx using the LIVE shop row (the teller's JWT
  // can't be trusted for sub state), redirecting to /shop-suspended — a path
  // teller enforcement DOES allow. Both gates share isSubscriptionExpired() so
  // they can never drift.
  const isExempt = SUBSCRIPTION_EXEMPT.some((r) => pathMatches(pathname, r))
  if (role === 'owner' && !isExempt) {
    const expired = isSubscriptionExpired({
      status: user.app_metadata?.sub_status as string | undefined,
      subUntil: user.app_metadata?.sub_until as string | undefined,
      accessGranted: user.app_metadata?.access_granted as boolean | undefined,
    })

    if (expired) {
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
