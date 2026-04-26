'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Teller } from '@/types'

const SESSION_KEY = 'spaza_active_teller'

export interface ActiveTellerState {
  activeTeller: Teller | null
  setActiveTeller: (t: Teller) => void
  clearActiveTeller: () => void
  isLoading: boolean
  role: 'owner' | 'teller' | null
}

/**
 * Provides the active teller for the current user:
 * - Owner: manually selected teller stored in sessionStorage
 * - Teller: automatically derived from their own auth session
 */
export function useActiveTeller(): ActiveTellerState {
  const [activeTeller, setActiveTellerState] = useState<Teller | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<'owner' | 'teller' | null>(null)

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

      const userRole = user.app_metadata?.role as 'owner' | 'teller' | undefined
      setRole(userRole ?? null)

      if (userRole === 'owner') {
        // 1. Re-hydrate from sessionStorage if the owner explicitly picked a teller earlier.
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            setActiveTellerState(JSON.parse(stored) as Teller)
            setIsLoading(false)
            return
          } catch {
            sessionStorage.removeItem(SESSION_KEY)
          }
        }

        // 2. Auto-select the owner's own teller row (created on onboarding) so sales
        //    land under their name instead of forcing them through the selector or
        //    (worse) going in with teller_id = null.
        try {
          const res = await fetch('/api/tellers')
          if (res.ok) {
            const tellers = (await res.json()) as Teller[]
            const ownerTeller = tellers.find((t) => t.user_id === user.id && t.active)
            if (ownerTeller) {
              setActiveTellerState(ownerTeller)
              sessionStorage.setItem(SESSION_KEY, JSON.stringify(ownerTeller))
            }
          }
        } catch {
          // Network issue — fall through to TellerSelector (no auto-select)
        }
        setIsLoading(false)
      } else if (userRole === 'teller') {
        // Auto-select: fetch own teller record
        try {
          const res = await fetch('/api/tellers/me')
          if (res.ok) {
            const teller = (await res.json()) as Teller
            setActiveTellerState(teller)
          }
        } finally {
          setIsLoading(false)
        }
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
