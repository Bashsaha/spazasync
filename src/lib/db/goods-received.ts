import { createClient } from '@/lib/supabase/server'
import type { GoodsReceived, GoodsReceivedWithNames } from '@/types'

/** Log a single goods-received event (stock top-up). */
export async function logGoodsReceived(input: {
  product_id: string
  quantity: number
  supplier_id?: string | null
  notes?: string | null
}): Promise<GoodsReceived> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) throw new Error('No shop associated with this account')

  const { data, error } = await supabase
    .from('goods_received')
    .insert({
      shop_id: shopId,
      product_id: input.product_id,
      quantity: input.quantity,
      supplier_id: input.supplier_id ?? null,
      notes: input.notes ?? null,
      received_by: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return data as GoodsReceived
}

/**
 * List goods received entries with joined product + supplier names.
 * Supports optional filters for product and date range (ISO strings).
 */
export async function listGoodsReceived(options?: {
  productId?: string
  from?: string
  to?: string
  limit?: number
}): Promise<GoodsReceivedWithNames[]> {
  const supabase = await createClient()

  let query = supabase
    .from('goods_received')
    .select('*, products(name), suppliers(name)')
    .order('received_at', { ascending: false })

  if (options?.productId) query = query.eq('product_id', options.productId)
  if (options?.from) query = query.gte('received_at', options.from)
  if (options?.to) query = query.lte('received_at', options.to)
  if (options?.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error) throw error

  type Row = GoodsReceived & {
    products: { name: string } | null
    suppliers: { name: string } | null
  }

  return ((data as Row[]) ?? []).map((row) => ({
    id: row.id,
    shop_id: row.shop_id,
    product_id: row.product_id,
    supplier_id: row.supplier_id,
    quantity: row.quantity,
    notes: row.notes,
    received_by: row.received_by,
    received_at: row.received_at,
    product_name: row.products?.name ?? '—',
    supplier_name: row.suppliers?.name ?? null,
  }))
}
