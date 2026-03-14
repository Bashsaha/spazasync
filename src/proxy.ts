import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/onboarding', '/auth/callback', '/api/auth/teller-login', '/api/onboarding']

// Only the sale route is accessible to tellers
const TELLER_ALLOWED_ROUTES = ['/sale']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip proxy for Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js)$/)
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
    const dest = role === 'teller' ? '/sale' : '/dashboard'
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = dest
    return NextResponse.redirect(redirectUrl)
  }

  const role = user.app_metadata?.role as string | undefined

  // Owner hasn't completed onboarding yet (no role in metadata)
  if (!role && pathname !== '/onboarding') {
    const onboardUrl = request.nextUrl.clone()
    onboardUrl.pathname = '/onboarding'
    return NextResponse.redirect(onboardUrl)
  }

  // ── Teller route enforcement ───────────────────────────────
  if (role === 'teller') {
    const allowed = TELLER_ALLOWED_ROUTES.some((r) => pathname.startsWith(r))
    if (!allowed) {
      const saleUrl = request.nextUrl.clone()
      saleUrl.pathname = '/sale'
      return NextResponse.redirect(saleUrl)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
