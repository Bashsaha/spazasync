'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Phase 44 App Shell — the client brain of the instant splash at `/`.
 *
 * The `/` document is static + data-free, so the SW serves it INSTANTLY on a
 * cold open (no white screen, no network). This component then resolves where
 * the user should actually go using ONLY the local session (no network round
 * trip) and HARD-navigates there with window.location.assign.
 *
 * Hard nav (not router.replace) is deliberate: a soft/SPA navigation fetches the
 * destination's RSC payload, which the service worker does NOT serve from cache
 * — so it would hit the network on a cold radio. A hard navigation is a DOCUMENT
 * load, which the SW DOES serve from its per-locale shell cache (Stage 2:
 * /sale, /dashboard) — instantly, with no network. The browser keeps this splash
 * on screen until the destination paints, so there's no white flash even when a
 * route isn't cached yet (/login, /onboarding).
 *
 * Routing mirrors the old server `app/page.tsx` redirect + proxy.ts:
 *   no session     → /login
 *   no role yet    → /onboarding   (owner mid-signup)
 *   role 'teller'  → /sale
 *   else           → /dashboard
 */
export function LaunchRouter() {
  useEffect(() => {
    let cancelled = false

    async function route() {
      let dest = '/login'
      try {
        const {
          data: { session },
        } = await createClient().auth.getSession()
        if (cancelled) return
        if (session) {
          const role = session.user.app_metadata?.role as string | undefined
          dest = !role ? '/onboarding' : role === 'teller' ? '/sale' : '/dashboard'
        }
      } catch {
        // Local session read failed — fall through to /login (middleware + RLS
        // are the real gate; worst case they re-auth).
      }
      if (!cancelled) window.location.assign(dest)
    }

    route()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
