'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cacheTellers, getCachedTellers } from '@/lib/offline/db'
import type { Teller } from '@/types'

const SESSION_KEY = 'spaza_active_teller'
// Persisted across PWA opens so a teller staying offline still gets auto-selected.
const TELLER_ME_KEY = 'spaza_teller_me'
// Owner-side mirror of the active teller, persisted across PWA opens. Used ONLY
// as the offline fallback when sessionStorage is empty (e.g. fresh tab after a
// PWA close while the device is offline). Online behavior is unchanged — fresh
// sessions still re-derive the active teller from the live roster.
const LAST_OWNER_TELLER_KEY = 'spaza_last_owner_teller'

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
      // getUser() hits the network; offline it errors or returns null. getSession()
      // is local-only and surfaces the cached JWT, which carries app_metadata.role
      // and the user id we need.
      let user: { id: string; app_metadata?: Record<string, unknown> } | null = null
      try {
        const { data } = await supabase.auth.getUser()
        if (data.user) user = data.user
      } catch {
        // offline — fall through to getSession
      }
      if (!user) {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) user = data.session.user
      }
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
          try {
            localStorage.setItem(LAST_OWNER_TELLER_KEY, JSON.stringify(ownerTeller))
          } catch {
            // ignore storage errors
          }
          setIsLoading(false)
          return
        }

        // 3. Final offline fallback — if we couldn't auto-pick (empty IndexedDB
        //    cache because the owner upgraded from before this fix), restore the
        //    last-known active teller from localStorage. Only when offline; online
        //    we want the existing fresh-session behavior to win.
        if (!networkOk) {
          try {
            const last = localStorage.getItem(LAST_OWNER_TELLER_KEY)
            if (last) {
              const parsed = JSON.parse(last) as Teller | null
              if (parsed?.id) {
                setActiveTellerState(parsed)
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed))
              }
            }
          } catch {
            // ignore parse / storage errors
          }
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
    try {
      // Mirror to localStorage so an offline reopen has a fallback to restore
      // from when sessionStorage has been cleared by tab close.
      localStorage.setItem(LAST_OWNER_TELLER_KEY, JSON.stringify(t))
    } catch {
      // ignore storage errors
    }
  }

  function clearActiveTeller() {
    setActiveTellerState(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  return { activeTeller, setActiveTeller, clearActiveTeller, isLoading, role }
}
