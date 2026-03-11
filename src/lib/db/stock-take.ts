import { createClient } from '@/lib/supabase/server'
import type { StockTakeInput } from '@/types'

/**
 * Save a stock take:
 *  1. Batch-fetch current stock_qty for all products (as qty_before).
 *  2. Batch-insert stock_take_entries audit rows.
 *  3. Update each product's stock_qty to the new qty_after.
 *
 * Only entries supplied by the caller are touched — products omitted by the
 * owner (left blank on the form) are not modified.
 */
export async function saveStockTake(
  entries: StockTakeInput[],
): Promise<{ updated: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const productIds = entries.map((e) => e.product_id)

  // 1. Fetch current stock_qty for all involved products
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, stock_qty')
    .in('id', productIds)

  if (fetchError) throw fetchError

  const qtyBefore = new Map(
    (products ?? []).map((p) => [p.id as string, p.stock_qty as number]),
  )

  // 2. Batch-insert audit rows
  const auditRows = entries.map((entry) => ({
    shop_id: shopId,
    product_id: entry.product_id,
    qty_before: qtyBefore.get(entry.product_id) ?? 0,
    qty_after: entry.qty_after,
    teller_id: entry.teller_id ?? null,
  }))

  const { error: insertError } = await supabase
    .from('stock_take_entries')
    .insert(auditRows)

  if (insertError) throw insertError

  // 3. Update each product's stock_qty
  for (const entry of entries) {
    const { error } = await supabase
      .from('products')
      .update({ stock_qty: entry.qty_after })
      .eq('id', entry.product_id)

    if (error) throw error
  }

  return { updated: entries.length }
}
