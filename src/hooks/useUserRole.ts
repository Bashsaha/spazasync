'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'owner' | 'teller' | 'admin' | null

/**
 * Reads the current user's role from the local session (the cached JWT's
 * app_metadata) — no network call. Returns null until resolved. Useful for
 * cheap UI gating (e.g. hiding owner-only links from tellers) without pulling
 * in the heavier useActiveTeller hook.
 */
export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(null)

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      try {
        const { data } = await createClient().auth.getSession()
        if (cancelled) return
        const r = data.session?.user.app_metadata?.role as UserRole | undefined
        setRole(r ?? null)
      } catch {
        // no session — leave role null
      }
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  return role
}
