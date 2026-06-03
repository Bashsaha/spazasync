import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'

/**
 * GET /api/products/popular
 * Returns up to 10 product IDs ordered by total quantity sold in the last 30 days.
 * Used by ProductPicker to show "Top sellers" at the top of the list.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { supabase, shopId } = auth

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Phase 45b — aggregate top sellers in SQL (shop_popular_products, SECURITY
  // INVOKER → RLS applies) instead of pulling 30 days of sales + every sale_item
  // and summing in JS (which was unbounded and ran on every product-picker open).
  const { data, error } = await supabase.rpc('shop_popular_products', {
    p_shop_id: shopId,
    p_since: since,
    p_limit: 10,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const popular = ((data ?? []) as { product_id: string }[]).map((r) => r.product_id)
  return NextResponse.json({ popular })
}
