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
      // Session-first: getSession() is local-only (reads the cached JWT, which
      // carries app_metadata.role + the user id) and returns instantly, so we
      // can paint the sale screen without waiting on the network. getUser() —
      // the authoritative server check — is only needed as a fallback when no
      // cached session exists. Data access is still enforced server-side by
      // RLS + proxy.ts, so trusting the local JWT for UI gating is safe.
      let user: { id: string; app_metadata?: Record<string, unknown> } | null = null
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user) user = sessionData.session.user
      if (!user) {
        try {
          const { data } = await supabase.auth.getUser()
          if (data.user) user = data.user
        } catch {
          // offline + no cached session — give up
        }
      }
      if (!user) {
        setIsLoading(false)
        return
      }
      const resolvedUser = user

      const rawRole = resolvedUser.app_metadata?.role as 'owner' | 'teller' | 'admin' | undefined
      setRole(rawRole ?? null)

      // Dual-role admins (admin JWT + shop_id) run sales the same way owners do.
      const isOwnerLike = rawRole === 'owner' || rawRole === 'admin'

      if (isOwnerLike) {
        // ── Instant path ──────────────────────────────────────────────────────
        // If sessionStorage already holds an active teller, render it NOW and
        // stop blocking. Validation against the live roster happens in the
        // background below — we never make the cashier wait on /api/tellers to
        // start a sale when we already know who's serving. This is the fix that
        // makes "tap New Sale" instant, especially after the app has sat idle
        // (cold network + token refresh used to stall here).
        const stored = sessionStorage.getItem(SESSION_KEY)
        let storedTeller: Teller | null = null
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Teller | null
            if (parsed?.id) {
              storedTeller = parsed
              setActiveTellerState(parsed)
              setIsLoading(false)
            } else {
              sessionStorage.removeItem(SESSION_KEY)
            }
          } catch {
            sessionStorage.removeItem(SESSION_KEY)
          }
        }

        // ── Background: refresh the roster (for offline + validation) ──────────
        let tellers: Teller[] = []
        let networkOk = false
        try {
          const res = await fetch('/api/tellers')
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

        // Validate the instantly-rendered teller against the live roster. Only
        // online — offline we can't validate and forcing the selector would
        // strand the owner (they can't load tellers). If it's gone stale (re-
        // login / deactivation), drop back to the selector.
        if (storedTeller) {
          if (networkOk && !tellers.some((t) => t.id === storedTeller!.id && t.active)) {
            sessionStorage.removeItem(SESSION_KEY)
            setActiveTellerState(null)
          } else {
            return // valid (or offline-trusted) — already rendered
          }
        }

        // No usable stored teller — auto-select the owner's own row (created on
        // onboarding) so sales land under their name. Works offline too as long
        // as the cached roster includes their row.
        const ownerTeller = tellers.find((t) => t.user_id === resolvedUser.id && t.active)
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

        // Final offline fallback — restore the last-known active teller from
        // localStorage (covers an empty IndexedDB roster cache). Only offline;
        // online the fresh-session behavior wins.
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
        // Cache-first: paint the last-known teller from localStorage instantly,
        // then refresh from /api/tellers/me in the background.
        let rendered = false
        try {
          const cached = localStorage.getItem(TELLER_ME_KEY)
          if (cached) {
            setActiveTellerState(JSON.parse(cached) as Teller)
            setIsLoading(false)
            rendered = true
          }
        } catch {
          // ignore parse / storage errors
        }
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
          }
        } catch {
          // offline — the cached render (if any) stands
        }
        if (!rendered) setIsLoading(false)
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
