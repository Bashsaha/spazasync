import { createClient } from '@/lib/supabase/server'
import type { ProductBatch, AddBatchInput, ExpiryProductDetail, BatchDetail } from '@/types'

/**
 * List non-zero batches for a product, ordered by expiry date (earliest first).
 */
export async function listBatchesForProduct(productId: string): Promise<ProductBatch[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('product_batches')
    .select('*')
    .eq('product_id', productId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProductBatch[]
}

/**
 * Add a batch with an expiry date.
 * Also increments products.stock_qty by the batch quantity.
 */
export async function addBatch(input: AddBatchInput): Promise<ProductBatch> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  // Insert batch row
  const { data: batch, error: batchError } = await supabase
    .from('product_batches')
    .insert({
      shop_id: shopId,
      product_id: input.product_id,
      expiry_date: input.expiry_date,
      quantity: input.quantity,
    })
    .select()
    .single()

  if (batchError) throw batchError

  // Increment products.stock_qty
  const { error: stockError } = await supabase.rpc('decrement_stock', {
    p_product_id: input.product_id,
    p_qty: -input.quantity, // negative = increment
  })

  if (stockError) throw stockError

  return batch as ProductBatch
}

/**
 * Discard a batch (set qty to 0) and decrement products.stock_qty accordingly.
 */
export async function removeBatch(batchId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch batch to get current quantity
  const { data: batch, error: fetchError } = await supabase
    .from('product_batches')
    .select('id, product_id, quantity')
    .eq('id', batchId)
    .single()

  if (fetchError || !batch) throw fetchError ?? new Error('Batch not found')

  if (batch.quantity === 0) return // already discarded

  // Set batch quantity to 0
  const { error: updateError } = await supabase
    .from('product_batches')
    .update({ quantity: 0 })
    .eq('id', batchId)

  if (updateError) throw updateError

  // Decrement products.stock_qty by the batch's quantity
  const { error: stockError } = await supabase.rpc('decrement_stock', {
    p_product_id: batch.product_id,
    p_qty: batch.quantity,
  })

  if (stockError) throw stockError
}

/**
 * Get expiry stats for a shop: count of products with expired or expiring-soon batches.
 */
export async function getExpiryStats(shopId: string): Promise<{
  expiringProducts: number
  expiredProducts: number
}> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  // Batches expiring within 7 days (but not yet expired)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const soonDate = sevenDaysFromNow.toISOString().split('T')[0]

  // Products with expired batches (qty > 0, expiry_date < today)
  const { data: expired } = await supabase
    .from('product_batches')
    .select('product_id')
    .eq('shop_id', shopId)
    .gt('quantity', 0)
    .lt('expiry_date', today)

  // Products with expiring-soon batches (qty > 0, expiry_date between today and today+7)
  const { data: expiring } = await supabase
    .from('product_batches')
    .select('product_id')
    .eq('shop_id', shopId)
    .gt('quantity', 0)
    .gte('expiry_date', today)
    .lte('expiry_date', soonDate)

  // Count unique product IDs
  const expiredProductIds = new Set((expired ?? []).map((r) => r.product_id))
  const expiringProductIds = new Set((expiring ?? []).map((r) => r.product_id))

  return {
    expiredProducts: expiredProductIds.size,
    expiringProducts: expiringProductIds.size,
  }
}

/**
 * List ALL products with expiry-tracked batches for a shop.
 * Groups products by urgency: expired → expiring soon (≤7 days) → OK.
 * Each product includes its individual batch details.
 */
export async function listAllProductsWithBatches(shopId: string): Promise<ExpiryProductDetail[]> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const soonDate = sevenDaysFromNow.toISOString().split('T')[0]

  // Get ALL non-zero batches for this shop
  const { data: batches, error } = await supabase
    .from('product_batches')
    .select('id, product_id, expiry_date, quantity')
    .eq('shop_id', shopId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  if (!batches || batches.length === 0) return []

  // Group batches by product_id
  const productMap = new Map<
    string,
    { batches: BatchDetail[]; hasExpired: boolean; hasExpiringSoon: boolean }
  >()

  for (const b of batches) {
    const entry = productMap.get(b.product_id) ?? {
      batches: [],
      hasExpired: false,
      hasExpiringSoon: false,
    }

    let status: 'expired' | 'expiring_soon' | 'ok'
    if (b.expiry_date < today) {
      status = 'expired'
      entry.hasExpired = true
    } else if (b.expiry_date <= soonDate) {
      status = 'expiring_soon'
      entry.hasExpiringSoon = true
    } else {
      status = 'ok'
    }

    entry.batches.push({
      id: b.id,
      expiry_date: b.expiry_date,
      quantity: b.quantity,
      status,
    })

    productMap.set(b.product_id, entry)
  }

  // Fetch product details
  const productIds = Array.from(productMap.keys())
  const { data: products } = await supabase
    .from('products')
    .select('id, name, barcode, stock_qty')
    .in('id', productIds)

  // Build result with urgency grouping
  const result: ExpiryProductDetail[] = (products ?? []).map((p) => {
    const entry = productMap.get(p.id)!
    const urgency: 'expired' | 'expiring_soon' | 'ok' = entry.hasExpired
      ? 'expired'
      : entry.hasExpiringSoon
      ? 'expiring_soon'
      : 'ok'

    return {
      product_id: p.id,
      product_name: p.name,
      barcode: p.barcode,
      stock_qty: p.stock_qty,
      urgency,
      batches: entry.batches,
    }
  })

  // Sort: expired first, then expiring_soon, then ok
  const urgencyOrder = { expired: 0, expiring_soon: 1, ok: 2 }
  result.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return result
}

/**
 * List products with expiring or expired batches for a shop.
 * Returns product info + batch summary.
 */
export async function listExpiringProducts(shopId: string): Promise<
  Array<{
    product_id: string
    product_name: string
    barcode: string | null
    stock_qty: number
    expired_qty: number
    expiring_soon_qty: number
    earliest_expiry: string | null
  }>
> {
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const soonDate = sevenDaysFromNow.toISOString().split('T')[0]

  // Get all non-zero batches expiring within 7 days or already expired
  const { data: batches, error } = await supabase
    .from('product_batches')
    .select('product_id, expiry_date, quantity')
    .eq('shop_id', shopId)
    .gt('quantity', 0)
    .lte('expiry_date', soonDate)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  if (!batches || batches.length === 0) return []

  // Group by product_id
  const productMap = new Map<
    string,
    { expired_qty: number; expiring_soon_qty: number; earliest_expiry: string | null }
  >()

  for (const b of batches) {
    const entry = productMap.get(b.product_id) ?? {
      expired_qty: 0,
      expiring_soon_qty: 0,
      earliest_expiry: null,
    }
    if (b.expiry_date < today) {
      entry.expired_qty += b.quantity
    } else {
      entry.expiring_soon_qty += b.quantity
    }
    if (!entry.earliest_expiry || b.expiry_date < entry.earliest_expiry) {
      entry.earliest_expiry = b.expiry_date
    }
    productMap.set(b.product_id, entry)
  }

  // Fetch product details
  const productIds = Array.from(productMap.keys())
  const { data: products } = await supabase
    .from('products')
    .select('id, name, barcode, stock_qty')
    .in('id', productIds)

  return (products ?? []).map((p) => {
    const stats = productMap.get(p.id)!
    return {
      product_id: p.id,
      product_name: p.name,
      barcode: p.barcode,
      stock_qty: p.stock_qty,
      expired_qty: stats.expired_qty,
      expiring_soon_qty: stats.expiring_soon_qty,
      earliest_expiry: stats.earliest_expiry,
    }
  })
}
