import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Phase 45d — per-shop Realtime via Broadcast (replaces postgres_changes).
 *
 * Why Broadcast: postgres_changes opens a persistent socket per client AND
 * re-evaluates RLS for every change against every subscriber — the lowest, hardest
 * ceiling in the stack at scale. Broadcast routes by topic and does NOT re-run RLS
 * per subscriber, so it scales far past a few thousand concurrent owners.
 *
 * Topic shape: `shop:<shop_id>:<table>` (a private channel). Authorization is the
 * RLS policy on `realtime.messages` — a client may only join a topic whose shop_id
 * is one of its `shop_users` memberships. `sales` / `access_requests` are pushed by
 * AFTER-trigger `realtime.broadcast_changes`; `products` (stock-take) is pushed
 * client-side via `send()` on save, so the hot sale path carries no broadcast cost.
 *
 * Callers should ALSO refetch on focus/resume so a missed broadcast degrades to
 * "updates on refocus" rather than "stops updating".
 */
export interface ShopChannel {
  /** Send a client broadcast to peers on this topic (e.g. after a stock-take save). */
  send: (payload?: Record<string, unknown>) => void
  /** Tear down the subscription. */
  close: () => void
}

export function subscribeShopBroadcast(
  shopId: string,
  table: 'sales' | 'access_requests' | 'products',
  onChange: () => void,
): ShopChannel {
  const supabase = createClient()
  const topic = `shop:${shopId}:${table}`
  let channel: RealtimeChannel | null = null
  let cancelled = false

  ;(async () => {
    try {
      // Private channels require the user's JWT on the realtime socket.
      const { data } = await supabase.auth.getSession()
      await supabase.realtime.setAuth(data.session?.access_token ?? null)
    } catch {
      /* setAuth failed → subscription may not authorize; callers degrade to refetch-on-focus */
    }
    if (cancelled) return
    channel = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: table }, () => onChange())
      .subscribe()
  })()

  return {
    send: (payload = {}) => {
      channel?.send({ type: 'broadcast', event: table, payload })
    },
    close: () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    },
  }
}
