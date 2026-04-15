import { createClient } from '@/lib/supabase/server'
import type { Sale, CompleteSaleInput } from '@/types'

/**
 * Persist a completed sale:
 *  1. Insert the sale row.
 *  2. Insert all sale_items.
 *  3. Decrement stock for every item via the `decrement_stock` SQL function.
 *
 * Note: these three steps are not wrapped in a single DB transaction here —
 * full transactional safety is added in Phase 7 (offline queue + sync).
 * The `stock_qty >= 0` CHECK constraint on products prevents going negative.
 */
export async function completeSale(input: CompleteSaleInput): Promise<Sale> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const total = input.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  // 1. Insert sale
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      shop_id: shopId,
      teller_id: input.teller_id,
      total,
      offline_id: input.offline_id ?? null,
    })
    .select()
    .single()

  if (saleError) throw saleError

  // Snapshot cost_price per product — keeps historical profit correct when
  // the owner later edits the product's cost_price.
  const productIds = Array.from(new Set(input.items.map((i) => i.product_id)))
  const { data: costRows } = await supabase
    .from('products')
    .select('id, cost_price')
    .in('id', productIds)
  const costMap = new Map<string, number | null>(
    (costRows ?? []).map((p) => [p.id as string, p.cost_price as number | null]),
  )

  // 2. Insert sale items
  const saleItems = input.items.map((item) => ({
    sale_id: sale.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    unit_cost: costMap.get(item.product_id) ?? null,
    subtotal: item.unit_price * item.quantity,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
  if (itemsError) throw itemsError

  // 3. Decrement stock for each item
  for (const item of input.items) {
    const { error } = await supabase.rpc('decrement_stock_fefo', {
      p_product_id: item.product_id,
      p_qty: item.quantity,
      p_sale_id: sale.id,
    })
    if (error) throw error
  }

  return sale as Sale
}
