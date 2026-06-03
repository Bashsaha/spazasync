'use client'

import { useEffect, useRef } from 'react'
import { emitDataChanged } from '@/lib/events'
import { subscribeShopBroadcast } from '@/lib/realtime/shop-channel'

/**
 * Cross-device live refresh for the (client cache-first) dashboard. A sale
 * recorded on ANOTHER device (e.g. a teller's phone) is pushed to this shop's
 * `sales` Broadcast topic by an AFTER INSERT trigger; we fire `emitDataChanged()`
 * (debounced) so every cache-first reader on the dashboard revalidates.
 * Same-device mutations already emit DATA_CHANGED at the source, and the
 * cache-first readers also revalidate on RESUME_READY — so a missed broadcast
 * just means "updates on refocus", never stale-forever.
 *
 * Phase 45d: switched from postgres_changes (a persistent per-client socket that
 * re-evaluates RLS per change) to Broadcast (routes by topic, scales far better).
 */
export function DashboardRealtime({ shopId }: { shopId?: string }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!shopId) return
    const channel = subscribeShopBroadcast(shopId, 'sales', () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => emitDataChanged(), 800)
    })
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      channel.close()
    }
  }, [shopId])

  return null
}
