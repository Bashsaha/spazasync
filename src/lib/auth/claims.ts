import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Minimal, render-only identity used by Server Components to draw the app shell.
 *
 * `id` is the auth user id; `appMetadata` carries `role` / `shop_id` / the
 * subscription claims the middleware bakes into the JWT.
 */
export type AuthClaims = {
  id: string
  appMetadata: Record<string, unknown>
}

function fromAppMetadata(id: string, appMetadata: unknown): AuthClaims {
  return {
    id,
    appMetadata: (appMetadata as Record<string, unknown> | null | undefined) ?? {},
  }
}

/**
 * Resolve the current user's claims for **UI gating + shell rendering** —
 * deliberately NOT the data-layer security boundary (RLS + per-route
 * `getShopAuth()` / `requireAdmin()` still call `getUser()` to validate before
 * touching shop-scoped data).
 *
 * Why `getClaims()` instead of `getUser()` (the resume-from-background fix):
 *   `getUser()` ALWAYS makes a network round-trip to the Supabase auth server.
 *   On a mid-range Android resuming from background, that radio is often still
 *   suspended — the call hangs or throws, and every page that ran it crashed
 *   into the (app) error boundary ("we ran into a problem") or stalled on a tab
 *   tap. `getClaims()` verifies the JWT **locally via WebCrypto with no network
 *   call** WHEN the project uses asymmetric JWT signing keys — so a valid
 *   (non-expired) token renders the shell instantly even on a dead radio.
 *
 *   Until asymmetric keys are enabled in the Supabase dashboard, `getClaims()`
 *   transparently falls back to a network verification (same cost as the old
 *   `getUser()` — no regression), so this change is safe to ship first and pays
 *   off fully the moment the keys are flipped. See tasks/bugs.md (BUG-049).
 *
 * Resilience: on a transient verification failure (network blip / waking radio
 * on the symmetric-key fallback path) we degrade to the LOCAL session
 * (`getSession()` reads the cookie with no network) so a momentary blip renders
 * the shell from the existing token instead of bouncing a logged-in owner to
 * /login or throwing. A genuinely absent token still returns null → /login.
 */
export async function getAuthClaims(
  client?: SupabaseClient,
): Promise<AuthClaims | null> {
  const supabase = client ?? (await createClient())

  try {
    const { data, error } = await supabase.auth.getClaims()
    if (data?.claims?.sub) {
      return fromAppMetadata(data.claims.sub as string, data.claims.app_metadata)
    }
    if (error) {
      // Transient verify failure — fall back to the local cookie session for
      // render-only gating. Security stays enforced at the data layer.
      const { data: s } = await supabase.auth.getSession()
      if (s.session?.user) {
        return fromAppMetadata(s.session.user.id, s.session.user.app_metadata)
      }
    }
    // No token (clean logged-out state) → caller redirects to /login.
    return null
  } catch {
    try {
      const { data: s } = await supabase.auth.getSession()
      if (s.session?.user) {
        return fromAppMetadata(s.session.user.id, s.session.user.app_metadata)
      }
    } catch {
      /* ignore — treat as logged out */
    }
    return null
  }
}
