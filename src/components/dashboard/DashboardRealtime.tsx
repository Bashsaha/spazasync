'use client'

import { useEffect, useRef } from 'react'
import { emitDataChanged } from '@/lib/events'
import { createClient } from '@/lib/supabase/client'

/**
 * Cross-device live refresh for the (now client cache-first) dashboard. A sale
 * recorded on ANOTHER device (e.g. a teller's phone) pushes a `sales` INSERT for
 * this shop; we fire `emitDataChanged()` (debounced) so every cache-first reader
 * on the dashboard — the /api/dashboard payload AND the /api/summary/daily cards
 * — revalidates. Same-device mutations already emit DATA_CHANGED at the source.
 *
 * (Replaces DashboardAutoRefresh, whose router.refresh() only re-streamed server
 * components — a no-op now that the dashboard renders from client caches.)
 */
export function DashboardRealtime({ shopId }: { shopId?: string }) {
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
          debounceRef.current = setTimeout(() => emitDataChanged(), 800)
        },
      )
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [shopId])

  return null
}
