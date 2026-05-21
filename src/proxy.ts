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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip proxy for Next.js internals and static files. Manifest + service
  // worker MUST be reachable without auth — Chrome's installability checker
  // and the navigator.serviceWorker.register() call both fetch them
  // pre-auth, and a redirect-to-/login would block PWA install (BUG-021).
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/offline.html' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|json|webmanifest)$/)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the session — IMPORTANT: do not use getSession() here, use getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Public routes ──────────────────────────────────────────
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  if (!user) {
    if (isPublic) return supabaseResponse
    // Not authenticated — send to login
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
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
    return NextResponse.redirect(redirectUrl)
  }

  const role = user.app_metadata?.role as string | undefined

  // Owner hasn't completed onboarding yet (no role in metadata).
  // /api/municipalities is reference data the onboarding Area picker needs
  // before a role exists — let it through so the picker can populate.
  if (!role && pathname !== '/onboarding' && !pathname.startsWith('/api/municipalities')) {
    const onboardUrl = request.nextUrl.clone()
    onboardUrl.pathname = '/onboarding'
    return NextResponse.redirect(onboardUrl)
  }

  // ── Teller route enforcement ───────────────────────────────
  if (role === 'teller') {
    const isAlwaysAllowed = TELLER_ALWAYS_ALLOWED.some((r) => pathMatches(pathname, r))
    const isGrantedOnly = TELLER_GRANTED_ONLY.some((r) => pathMatches(pathname, r))

    if (!isAlwaysAllowed && !isGrantedOnly) {
      // Path not on either list — bounce back to /sale.
      const saleUrl = request.nextUrl.clone()
      saleUrl.pathname = '/sale'
      return NextResponse.redirect(saleUrl)
    }

    if (isGrantedOnly) {
      const granted = await isTellerInventoryGranted(supabase, user.id)
      if (!granted) {
        // Lacking grant — redirect to /inventory where the request-access UI lives.
        const invUrl = request.nextUrl.clone()
        invUrl.pathname = '/inventory'
        return NextResponse.redirect(invUrl)
      }
    }
  }

  // ── Admin route enforcement ──────────────────────────────
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r))
  if (isAdminRoute && role !== 'admin') {
    const dashUrl = request.nextUrl.clone()
    dashUrl.pathname = role === 'teller' ? '/sale' : '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  // Admin users skip subscription gate.
  // Dual-role admins (with shop_id) can also access shop pages — API routes
  // read shop_id from JWT metadata and RLS uses their shop_users row.
  if (role === 'admin') return supabaseResponse

  // ── Subscription gate ────────────────────────────────────
  // Check sub_status and sub_until from JWT metadata (zero DB queries)
  const isExempt = SUBSCRIPTION_EXEMPT.some((r) => pathname.startsWith(r))
  if (role && !isExempt) {
    const subStatus = user.app_metadata?.sub_status as string | undefined
    const subUntil = user.app_metadata?.sub_until as string | undefined
    const accessGranted = user.app_metadata?.access_granted as boolean | undefined

    const isExpired =
      subStatus === 'expired' ||
      (subUntil && new Date(subUntil) < new Date())

    if (isExpired && !accessGranted) {
      const subUrl = request.nextUrl.clone()
      subUrl.pathname = '/subscribe'
      return NextResponse.redirect(subUrl)
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
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|apple-touch-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|webmanifest)$).*)',
  ],
}
