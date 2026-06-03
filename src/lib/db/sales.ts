import { createClient } from '@/lib/supabase/server'
import type { Sale, CompleteSaleInput } from '@/types'

/**
 * Persist a completed sale in ONE atomic transaction via the `complete_sale`
 * SQL function (Phase 45c):
 *   1. Insert the sale row (total computed server-side from the items).
 *   2. Insert all sale_items, snapshotting unit_cost from products.
 *   3. Run FEFO batch consumption for every line (reuses decrement_stock_fefo).
 *
 * All-or-nothing: a stock_qty < 0 CHECK violation on any line rolls back the
 * whole sale (the old per-item RPC loop left a partial sale behind on failure).
 * Idempotent on offline_id — replaying a synced offline sale returns the
 * existing row instead of inserting a duplicate, so the offline queue is safe.
 *
 * One RPC round-trip total, instead of (insert sale) + (cost lookup) +
 * (insert items) + one round-trip per cart line.
 */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase.rpc('complete_sale', {
    p_shop_id: shopId,
    p_teller_id: input.teller_id ?? null,
    p_offline_id: input.offline_id ?? null,
    p_items: input.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
  })

  if (error) throw error
  return data as Sale
}
