import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
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
export async function GET() {
  const auth = await getShopAuth()
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

    return NextResponse.json({ sales, lowStock, expiring, profitTrackingEnabled })
  } catch (err) {
    console.error('Daily summary API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
