import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getExpiryStats } from '@/lib/db/batches'
import { STABLE_READ_CACHE } from '@/lib/utils/api'

/**
 * GET /api/inventory/summary
 * The three counts on the Inventory hub's summary strip: total products,
 * low-stock products (<= the shop threshold), and expiring+expired products.
 * Cache-first on the client (Phase 44b) so the strip paints instantly.
 */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { shopId, supabase } = auth

  const { data: shop } = await supabase
    .from('shops')
    .select('low_stock_threshold')
    .eq('id', shopId)
    .single()
  const threshold = (shop?.low_stock_threshold as number | undefined) ?? 5

  const [{ count: total }, { count: low }, expiryStats] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .lte('stock_qty', threshold),
    getExpiryStats(shopId),
  ])

  return NextResponse.json(
    {
      total: total ?? 0,
      low: low ?? 0,
      expiring: expiryStats.expiringProducts + expiryStats.expiredProducts,
    },
    { headers: STABLE_READ_CACHE },
  )
}
