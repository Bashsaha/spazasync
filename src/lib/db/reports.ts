import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type { DailySummaryData, LowStockItem } from '@/types'

/**
 * Returns ISO boundaries for a given date in SAST (Africa/Johannesburg, UTC+2).
 * Using explicit +02:00 offset — SAST never observes DST.
 */
function getSASTDayBounds(date: Date = new Date()): { start: string; end: string } {
  const dateStr = formatInTimeZone(date, SAST_TZ, 'yyyy-MM-dd')
  return {
    start: `${dateStr}T00:00:00+02:00`,
    end: `${dateStr}T23:59:59.999+02:00`,
  }
}

/**
 * Get today's sales summary for a single shop.
 * Uses the admin client — shopId is always explicitly filtered.
 */
export async function getDailySalesForShop(
  shopId: string,
  date: Date = new Date(),
): Promise<DailySummaryData> {
  const admin = createAdminClient()
  const { start, end } = getSASTDayBounds(date)

  // Fetch today's sales for this specific shop
  const { data: sales, error: salesError } = await admin
    .from('sales')
    .select('id, total, teller_id')
    .eq('shop_id', shopId)
    .gte('completed_at', start)
    .lte('completed_at', end)

  if (salesError) throw salesError

  if (!sales || sales.length === 0) {
    return { salesCount: 0, totalRevenue: 0, topItems: [], tellerCount: 0 }
  }

  const saleIds = sales.map((s) => s.id)
  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0)
  const tellerCount = new Set(sales.map((s) => s.teller_id).filter(Boolean)).size

  // Fetch sale items with product names — all belong to sales already filtered by shop_id
  const { data: saleItems, error: itemsError } = await admin
    .from('sale_items')
    .select('quantity, product_id, products(name)')
    .in('sale_id', saleIds)

  if (itemsError) throw itemsError

  // Aggregate quantities by product
  const itemMap = new Map<string, { name: string; totalQty: number }>()
  for (const item of saleItems ?? []) {
    // Supabase infers FK joins as arrays without generated types; cast via unknown
    const productRaw = item.products as unknown as { name: string } | null
    const productName = productRaw?.name ?? 'Unknown product'
    const existing = itemMap.get(item.product_id)
    if (existing) {
      existing.totalQty += item.quantity
    } else {
      itemMap.set(item.product_id, { name: productName, totalQty: item.quantity })
    }
  }

  const topItems = [...itemMap.values()]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 5)

  return {
    salesCount: sales.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    topItems,
    tellerCount,
  }
}

/**
 * Get all products at or below the low-stock threshold for a single shop.
 * Uses the admin client — shopId is always explicitly filtered.
 */
export async function getLowStockForShop(
  shopId: string,
  threshold: number,
): Promise<LowStockItem[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .select('name, stock_qty')
    .eq('shop_id', shopId)
    .lte('stock_qty', threshold)
    .order('stock_qty', { ascending: true })

  if (error) throw error

  return (data ?? []).map((p) => ({ name: p.name, stock_qty: p.stock_qty }))
}
