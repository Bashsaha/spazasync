import { createClient } from '@/lib/supabase/server'
import { sanitizeSearch } from '@/lib/utils/search'
import type { Product } from '@/types'

export type ProductWithStock = Product & { low_stock: boolean }

/**
 * List all products for the shop, ordered by stock_qty ASC (lowest first).
 * Each product is decorated with a `low_stock` boolean based on the shop's
 * low_stock_threshold setting.
 */
export async function listProductsWithStock(
  search?: string,
): Promise<{ products: ProductWithStock[]; threshold: number }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  // Fetch the shop's low_stock_threshold
  const { data: shop } = await supabase
    .from('shops')
    .select('low_stock_threshold')
    .eq('id', shopId)
    .single()

  const threshold = (shop?.low_stock_threshold as number) ?? 5

  // Fetch products ordered by stock_qty ascending (lowest first)
  const base = supabase.from('products').select('*').order('stock_qty', { ascending: true })
  const s = search?.trim() ? sanitizeSearch(search) : ''
  const { data } = s
    ? await base.or(`name.ilike.%${s}%,barcode.ilike.%${s}%`)
    : await base

  const products: ProductWithStock[] = ((data as Product[]) ?? []).map((p) => ({
    ...p,
    low_stock: p.stock_qty <= threshold,
  }))

  return { products, threshold }
}

/**
 * Adjust stock for a single product by a delta (positive = add, negative = remove).
 * Stock is clamped to a minimum of 0 — it cannot go negative.
 * An audit row is inserted into stock_adjustments for every call.
 * Returns the updated product.
 */
export async function adjustStock(input: {
  product_id: string
  qty_delta: number
  reason?: string
}): Promise<Product> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  // Fetch current stock_qty
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('id', input.product_id)
    .single()

  if (fetchError || !product) throw fetchError ?? new Error('Product not found')

  const qtyBefore = (product as Product).stock_qty
  const qtyAfter = Math.max(0, qtyBefore + input.qty_delta)
  const actualDelta = qtyAfter - qtyBefore   // real delta after clamping

  // Insert audit row
  const { error: auditError } = await supabase.from('stock_adjustments').insert({
    shop_id: shopId,
    product_id: input.product_id,
    qty_before: qtyBefore,
    qty_after: qtyAfter,
    delta: actualDelta,
    reason: input.reason ?? null,
    adjusted_by: user.id,
  })

  if (auditError) throw auditError

  // Update product stock_qty
  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ stock_qty: qtyAfter })
    .eq('id', input.product_id)
    .select()
    .single()

  if (updateError) throw updateError
  return updated as Product
}
