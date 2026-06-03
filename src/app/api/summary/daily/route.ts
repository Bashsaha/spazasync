import { NextResponse } from 'next/server'
import { getShopAuthFast } from '@/lib/auth/shop-auth'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import {
  getDailySalesForShop,
  getLowStockForShop,
  getExpiringProductsForShop,
} from '@/lib/db/reports'

/**
 * GET /api/summary/daily
 * Returns today's sales summary, low-stock items, and expiring products
 * for the authenticated shop. Used by the in-app daily summary alert.
 */
export async function GET(request: Request) {
  const { limited } = await checkRateLimit(request, { limit: 120, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const auth = await getShopAuthFast()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the shop's low_stock_threshold + profit_tracking flag
  const { data: shop } = await auth.supabase
    .from('shops')
    .select('low_stock_threshold, profit_tracking_enabled')
    .eq('id', auth.shopId)
    .single()

  const threshold = shop?.low_stock_threshold ?? 5
  const profitTrackingEnabled = Boolean(shop?.profit_tracking_enabled)

  try {
    const [sales, lowStock, expiring] = await Promise.all([
      getDailySalesForShop(auth.shopId),
      getLowStockForShop(auth.shopId, threshold),
      getExpiringProductsForShop(auth.shopId),
    ])

    // Count products missing cost price when profit tracking is on
    let productsMissingCost = 0
    if (profitTrackingEnabled) {
      const { count } = await auth.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', auth.shopId)
        .is('cost_price', null)
      productsMissingCost = count ?? 0
    }

    return NextResponse.json({ sales, lowStock, expiring, profitTrackingEnabled, productsMissingCost })
  } catch (err) {
    console.error('Daily summary API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
