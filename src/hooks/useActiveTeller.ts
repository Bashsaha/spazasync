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
        const stored = sessionStorage.getItem(SESSION_KEY)
        if (stored) {
          try {
            setActiveTellerState(JSON.parse(stored) as Teller)
          } catch {
            sessionStorage.removeItem(SESSION_KEY)
          }
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
