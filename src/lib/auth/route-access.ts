/**
 * Route access lists for the proxy (middleware).
 *
 * Extracted from `proxy.ts` so they can be unit-tested WITHOUT importing the
 * edge runtime / Supabase SSR client. BUG-047's prevention rule (b) wants the
 * "a redirect target must be reachable by the role being redirected"
 * invariant covered by a test — that lives in tests/unit/route-access.test.ts
 * and imports these consts directly.
 *
 * Pure module: no imports, no side effects.
 */

// Routes that don't require authentication.
export const PUBLIC_ROUTES = [
  '/login',
  '/onboarding',
  '/auth/callback',
  '/api/auth/teller-login',
  '/api/onboarding',
  '/api/subscribe/notify',
  '/api/external',
]

// Routes a teller can always reach — pre- or post-grant.
// Includes /inventory (the request-access UI lives there), the access-request
// API, /profile (where Switch user lives), and /shop-suspended (the lockout
// screen a teller is sent to when the shop's subscription has ended — it MUST
// be reachable or the redirect to it would bounce straight back to /sale,
// re-creating the BUG-047 loop).
export const TELLER_ALWAYS_ALLOWED = [
  '/sale',
  '/inventory',
  '/profile',
  '/shop-suspended',
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
export const TELLER_GRANTED_ONLY = [
  '/stock-take',
  '/api/stock-take',
]

// Routes accessible even when subscription is expired.
export const SUBSCRIPTION_EXEMPT = [
  '/subscribe',
  '/api/subscribe',
  '/settings',
  '/api/settings',
  '/api/account',
]

// Admin-only routes.
export const ADMIN_ROUTES = ['/admin', '/api/admin']

/** Exact-match or trailing-slash sub-route check. */
export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/')
}
