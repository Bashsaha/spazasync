'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Phase 44 App Shell (Stage 1) — the client brain of the instant splash at `/`.
 *
 * The `/` document is static + data-free, so the SW serves it INSTANTLY on a
 * cold open (no white screen, no network). This component then resolves where
 * the user should actually go using ONLY the local session (no network round
 * trip) and soft-navigates there, so Next shows the destination's loading
 * skeleton during its RSC fetch (splash → skeleton → content).
 *
 * Routing mirrors the old server `app/page.tsx` redirect + proxy.ts:
 *   no session     → /login
 *   no role yet    → /onboarding   (owner mid-signup)
 *   role 'teller'  → /sale
 *   else           → /dashboard
 */
export function LaunchRouter() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function route() {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return

        if (!session) {
          router.replace('/login')
          return
        }
        const role = session.user.app_metadata?.role as string | undefined
        if (!role) router.replace('/onboarding')
        else if (role === 'teller') router.replace('/sale')
        else router.replace('/dashboard')
      } catch {
        // Local session read failed — send them to login (middleware + RLS are
        // the real gate; worst case they re-auth).
        if (!cancelled) router.replace('/login')
      }
    }

    route()
    return () => {
      cancelled = true
    }
  }, [router])

  return null
}
