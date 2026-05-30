import { describe, it, expect } from 'vitest'
import {
  TELLER_ALWAYS_ALLOWED,
  TELLER_GRANTED_ONLY,
  pathMatches,
} from '@/lib/auth/route-access'

/** Mirrors the proxy's teller-enforcement reachability check. */
function tellerCanReach(pathname: string): boolean {
  return (
    TELLER_ALWAYS_ALLOWED.some((r) => pathMatches(pathname, r)) ||
    TELLER_GRANTED_ONLY.some((r) => pathMatches(pathname, r))
  )
}

describe('teller route access', () => {
  it('/shop-suspended is in TELLER_ALWAYS_ALLOWED', () => {
    expect(TELLER_ALWAYS_ALLOWED).toContain('/shop-suspended')
  })

  // BUG-047 invariant: any path the proxy can redirect a teller TO must be a
  // path a teller is allowed to stay on — otherwise the redirect bounces back
  // and you get ERR_TOO_MANY_REDIRECTS.
  //
  // Teller redirect targets in the codebase:
  //   - teller enforcement (proxy.ts) → /sale
  //   - granted-only without a grant (proxy.ts) → /inventory
  //   - expired-shop lockout ((app)/layout.tsx) → /shop-suspended
  it.each(['/sale', '/inventory', '/shop-suspended'])(
    'redirect target %s is reachable by a teller',
    (target) => {
      expect(tellerCanReach(target)).toBe(true)
    },
  )

  it('does NOT accidentally open owner-only paths to tellers', () => {
    expect(tellerCanReach('/dashboard')).toBe(false)
    expect(tellerCanReach('/settings')).toBe(false)
    expect(tellerCanReach('/subscribe')).toBe(false)
  })
})

describe('pathMatches()', () => {
  it('matches exact paths', () => {
    expect(pathMatches('/sale', '/sale')).toBe(true)
  })

  it('matches sub-paths', () => {
    expect(pathMatches('/shop-suspended/anything', '/shop-suspended')).toBe(true)
    expect(pathMatches('/api/tellers/me', '/api/tellers/me')).toBe(true)
  })

  it('does not match a prefix that is not a path boundary', () => {
    // '/stock' must NOT match '/stock-take' (BUG note in route-access.ts)
    expect(pathMatches('/stock-take', '/stock')).toBe(false)
  })
})
