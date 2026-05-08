'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cacheTellers, getCachedTellers } from '@/lib/offline/db'
import type { Teller } from '@/types'

const SESSION_KEY = 'spaza_active_teller'
// Persisted across PWA opens so a teller staying offline still gets auto-selected.
const TELLER_ME_KEY = 'spaza_teller_me'

export interface ActiveTellerState {
  activeTeller: Teller | null
  setActiveTeller: (t: Teller) => void
  clearActiveTeller: () => void
  isLoading: boolean
  /**
   * 'admin' here means a dual-role admin (admin JWT + shop_id) — they run sales
   * the same way an owner does, so the sale page treats them identically.
   */
  role: 'owner' | 'teller' | 'admin' | null
}

/**
 * Provides the active teller for the current user:
 * - Owner: manually selected teller stored in sessionStorage
 * - Teller: automatically derived from their own auth session
 */
export function useActiveTeller(): ActiveTellerState {
  const [activeTeller, setActiveTellerState] = useState<Teller | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<'owner' | 'teller' | 'admin' | null>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      const rawRole = user.app_metadata?.role as 'owner' | 'teller' | 'admin' | undefined
      setRole(rawRole ?? null)

      // Dual-role admins (admin JWT + shop_id) run sales the same way owners do.
      const isOwnerLike = rawRole === 'owner' || rawRole === 'admin'

      if (isOwnerLike) {
        // Try the network first; if it fails (offline) fall back to the IndexedDB
        // cache so we can still validate sessionStorage / auto-pick the owner row.
        let tellers: Teller[] = []
        let networkOk = false
        try {
          const res = await fetch('/api/tellers', { cache: 'no-store' })
          if (res.ok) {
            tellers = (await res.json()) as Teller[]
            networkOk = true
            cacheTellers(tellers)
          }
        } catch {
          // Network issue — fall through to cache
        }
        if (!networkOk) {
          tellers = await getCachedTellers()
        }

        // 1. Re-hydrate from sessionStorage. Online: validate against the live
        //    roster (handles stale entries after re-login / deactivation). Offline:
        //    trust the stored entry as-is — we can't validate, and forcing the
        //    selector here would strand the owner since they can't load tellers.
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Teller | null
            if (parsed?.id) {
              const stillValid = networkOk
                ? tellers.some((t) => t.id === parsed.id && t.active)
                : true
              if (stillValid) {
                setActiveTellerState(parsed)
                setIsLoading(false)
                return
              }
              sessionStorage.removeItem(SESSION_KEY)
            }
          } catch {
            sessionStorage.removeItem(SESSION_KEY)
          }
        }

        // 2. Auto-select the owner's own teller row (created on onboarding) so sales
        //    land under their name instead of forcing them through the selector or
        //    (worse) going in with teller_id = null. Works offline too as long as
        //    the cached roster includes their row.
        const ownerTeller = tellers.find((t) => t.user_id === user.id && t.active)
        if (ownerTeller) {
          setActiveTellerState(ownerTeller)
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(ownerTeller))
        }
        setIsLoading(false)
      } else if (rawRole === 'teller') {
        // Try network first; cache the result for offline. On failure, fall back
        // to the last-known teller from localStorage so an offline teller still
        // lands on a usable sale screen.
        try {
          const res = await fetch('/api/tellers/me')
          if (res.ok) {
            const teller = (await res.json()) as Teller
            setActiveTellerState(teller)
            try {
              localStorage.setItem(TELLER_ME_KEY, JSON.stringify(teller))
            } catch {
              // localStorage may be disabled — non-fatal
            }
            setIsLoading(false)
            return
          }
        } catch {
          // offline — fall through
        }
        try {
          const cached = localStorage.getItem(TELLER_ME_KEY)
          if (cached) setActiveTellerState(JSON.parse(cached) as Teller)
        } catch {
          // ignore parse / storage errors
        }
        setIsLoading(false)
      } else {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  function setActiveTeller(t: Teller) {
    setActiveTellerState(t)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(t))
  }

  function clearActiveTeller() {
    setActiveTellerState(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  return { activeTeller, setActiveTeller, clearActiveTeller, isLoading, role }
}
