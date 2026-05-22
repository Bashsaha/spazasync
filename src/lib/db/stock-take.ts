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

  // Stamp WHO did this count from the authenticated user — never trust a
  // client-supplied teller_id. Both owners and tellers have a `tellers` row
  // (the owner's is created at onboarding), so this attributes every count to a
  // real person the owner can see in the stock-count history. Falls back to
  // null only when no teller row exists for this user (edge case).
  const { data: actingTeller } = await supabase
    .from('tellers')
    .select('id')
    .eq('user_id', user.id)
    .eq('shop_id', shopId)
    .maybeSingle()
  const actingTellerId = (actingTeller?.id as string | undefined) ?? null

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

  // 2. Batch-insert audit rows. Only persist a reason when the count actually
  //    went down — a reason on an unchanged/increased count is meaningless.
  const auditRows = entries.map((entry) => {
    const before = qtyBefore.get(entry.product_id) ?? 0
    return {
      shop_id: shopId,
      product_id: entry.product_id,
      qty_before: before,
      qty_after: entry.qty_after,
      teller_id: actingTellerId,
      reason: entry.qty_after < before ? entry.reason ?? null : null,
    }
  })

  const { error: insertError } = await supabase
    .from('stock_take_entries')
    .insert(auditRows)

  if (insertError) throw insertError

  // 3. Update each product's stock_qty. Each row is an independent, RLS-scoped
  //    write keyed by id, so fire them concurrently instead of awaiting one
  //    round-trip per product (a full-catalog count was N serial network hops).
  //    Failure semantics are unchanged: a rejection still surfaces and earlier
  //    writes may already have applied — same as the previous sequential loop.
  const updates = await Promise.all(
    entries.map((entry) =>
      supabase
        .from('products')
        .update({ stock_qty: entry.qty_after })
        .eq('id', entry.product_id),
    ),
  )

  const failed = updates.find((u) => u.error)
  if (failed?.error) throw failed.error

  return { updated: entries.length }
}
