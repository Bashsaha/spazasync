'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'
import { consumeDataDirty } from '@/lib/events'
import { createClient } from '@/lib/supabase/client'

/**
 * Keeps the dashboard's server-rendered numbers (today's sales, low stock,
 * latest sales) fresh without a full page reload. `router.refresh()` re-streams
 * the server components in place — far cheaper than a hard navigation and the
 * existing UI stays on screen while it updates, so we keep the speed (BUG-042).
 *
 * Triggers:
 *   1. On mount, if a mutation happened since the last render (e.g. a sale was
 *      just completed on /sale before navigating here) — pull fresh data once.
 *   2. While mounted, on any in-tab mutation or when the tab regains focus.
 *   3. Realtime — a sale recorded on ANOTHER device (e.g. a teller's phone)
 *      pushes a `sales` INSERT for this shop; we refresh so the owner's
 *      dashboard updates live without a manual reload. Debounced so a burst of
 *      sales triggers one refresh, not many.
 *
 * Plain dashboard visits with no preceding mutation do NOT refresh, so the
 * cached render stays instant.
 */
export function DashboardAutoRefresh({ shopId }: { shopId?: string }) {
  const router = useRouter()

  useEffect(() => {
    if (consumeDataDirty()) router.refresh()
  }, [router])

  useRefetchOnVisible(() => router.refresh())

  // Realtime cross-device refresh on new sales.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!shopId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`dashboard-sales:${shopId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sales', filter: `shop_id=eq.${shopId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => router.refresh(), 800)
        },
      )
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [shopId, router])

  return null
}
