import { createClient } from '@/lib/supabase/client'
import { clearSessionCaches } from '@/lib/offline/clear-session-cache'

/**
 * The ONLY correct way to sign a user out on a (frequently shared) device.
 *
 * Drops the Supabase session AND purges every shop/user-scoped client cache
 * (SECURITY-001) so the next person to log in on the same phone can never see
 * the previous user's cached data (products, settings, tellers, dashboard,
 * SW-cached /api/* responses, the chrome identity mirror, …).
 *
 * Both steps are best-effort and ALWAYS run: a failed `signOut` (e.g. the user
 * was already deleted server-side, or the radio is asleep) still purges, and a
 * failed purge still leaves the session dropped. Callers handle navigation
 * themselves — soft (`router.push`) vs hard (`window.location.assign`) differs
 * per path; the first authenticated render after an auth transition MUST be
 * reached via a hard nav (BUG-043), but a sign-out lands on /login (public), so
 * the existing per-call choice is preserved.
 *
 * Every sign-out / switch-user / account-delete path MUST route through this —
 * do not call `supabase.auth.signOut()` directly (that re-opens SECURITY-001).
 */
export async function signOutAndPurge(): Promise<void> {
  try {
    await createClient().auth.signOut()
  } catch {
    /* already signed out / network down — still purge below */
  }
  await clearSessionCaches()
}
