import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { subDays } from 'date-fns'
import { SAST_TZ } from '@/lib/utils/date'
import type { DailySummaryData, LowStockItem, WeeklyDataPoint, RecentSale, TopProduct, ExpiringProductAlert, ShopProduct } from '@/types'

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
 * Get daily revenue totals for the last `days` days (in SAST) for a single shop.
 * Days with no sales are filled with zeros.
 */
export async function getWeeklySalesForShop(
  shopId: string,
  days = 7,
  now: Date = new Date(),
): Promise<WeeklyDataPoint[]> {
  const admin = createAdminClient()

  // Build the list of SAST dates we want (oldest first)
  const dates: Date[] = []
  for (let i = days - 1; i >= 0; i--) {
    dates.push(subDays(now, i))
  }

  // Window start = beginning of the oldest day
  const windowStart = `${formatInTimeZone(dates[0], SAST_TZ, 'yyyy-MM-dd')}T00:00:00+02:00`
  const windowEnd = `${formatInTimeZone(now, SAST_TZ, 'yyyy-MM-dd')}T23:59:59.999+02:00`

  const { data: sales, error } = await admin
    .from('sales')
    .select('total, completed_at')
    .eq('shop_id', shopId)
    .gte('completed_at', windowStart)
    .lte('completed_at', windowEnd)

  if (error) throw error

  // Group by SAST date string
  const byDate = new Map<string, { revenue: number; salesCount: number }>()
  for (const sale of sales ?? []) {
    const dateKey = formatInTimeZone(new Date(sale.completed_at), SAST_TZ, 'yyyy-MM-dd')
    const existing = byDate.get(dateKey)
    if (existing) {
      existing.revenue += Number(sale.total)
      existing.salesCount++
    } else {
      byDate.set(dateKey, { revenue: Number(sale.total), salesCount: 1 })
    }
  }

  // Build result array — fill zeros for days with no sales
  return dates.map((d) => {
    const dateKey = formatInTimeZone(d, SAST_TZ, 'yyyy-MM-dd')
    const entry = byDate.get(dateKey)
    return {
      label: formatInTimeZone(d, SAST_TZ, 'EEE'),
      date: dateKey,
      revenue: entry ? Math.round(entry.revenue * 100) / 100 : 0,
      salesCount: entry?.salesCount ?? 0,
    }
  })
}

/**
 * Get the most recent sales for a single shop.
 */
export async function getRecentSalesForShop(
  shopId: string,
  limit = 10,
): Promise<RecentSale[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('sales')
    .select('id, total, completed_at, tellers(name)')
    .eq('shop_id', shopId)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((s) => {
    const tellerRaw = s.tellers as unknown as { name: string } | null
    return {
      id: s.id,
      total: Number(s.total),
      completed_at: s.completed_at,
      teller_name: tellerRaw?.name ?? null,
    }
  })
}

/**
 * Get the top products sold over the last 7 days for a single shop.
 */
export async function getTopProductsThisWeek(
  shopId: string,
  limit = 5,
  now: Date = new Date(),
): Promise<TopProduct[]> {
  const admin = createAdminClient()

  const weekStart = `${formatInTimeZone(subDays(now, 6), SAST_TZ, 'yyyy-MM-dd')}T00:00:00+02:00`
  const weekEnd = `${formatInTimeZone(now, SAST_TZ, 'yyyy-MM-dd')}T23:59:59.999+02:00`

  // Get sales IDs for this shop in the last 7 days
  const { data: sales, error: salesError } = await admin
    .from('sales')
    .select('id')
    .eq('shop_id', shopId)
    .gte('completed_at', weekStart)
    .lte('completed_at', weekEnd)

  if (salesError) throw salesError
  if (!sales || sales.length === 0) return []

  const saleIds = sales.map((s) => s.id)

  const { data: items, error: itemsError } = await admin
    .from('sale_items')
    .select('product_id, quantity, subtotal, products(name)')
    .in('sale_id', saleIds)

  if (itemsError) throw itemsError

  // Aggregate by product
  const productMap = new Map<string, TopProduct>()
  for (const item of items ?? []) {
    const productRaw = item.products as unknown as { name: string } | null
    const name = productRaw?.name ?? 'Unknown product'
    const existing = productMap.get(item.product_id)
    if (existing) {
      existing.totalQty += item.quantity
      existing.totalRevenue += Number(item.subtotal)
    } else {
      productMap.set(item.product_id, {
        name,
        totalQty: item.quantity,
        totalRevenue: Number(item.subtotal),
      })
    }
  }

  return [...productMap.values()]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, limit)
    .map((p) => ({ ...p, totalRevenue: Math.round(p.totalRevenue * 100) / 100 }))
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

/**
 * Get all products for a single shop with stock levels.
 * Used by the external API stock endpoint.
 */
export async function getProductsForShop(shopId: string): Promise<ShopProduct[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('products')
    .select('id, name, barcode, price, stock_qty')
    .eq('shop_id', shopId)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    price: Number(p.price),
    stock_qty: p.stock_qty,
  }))
}

/**
 * Get products with expired or expiring-soon batches for a single shop.
 * Uses the admin client — no auth needed; scoped by shopId.
 * "Expiring soon" = expiry_date between today and today + 7 days (inclusive).
 */
export async function getExpiringProductsForShop(
  shopId: string,
): Promise<ExpiringProductAlert[]> {
  const admin = createAdminClient()

  const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const soonDate = formatInTimeZone(sevenDaysFromNow, SAST_TZ, 'yyyy-MM-dd')

  // Get all non-zero batches that are expired or expiring within 7 days
  const { data: batches, error } = await admin
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
    { expired_qty: number; expiring_soon_qty: number; earliest_expiry: string }
  >()

  for (const b of batches) {
    const entry = productMap.get(b.product_id) ?? {
      expired_qty: 0,
      expiring_soon_qty: 0,
      earliest_expiry: b.expiry_date,
    }
    if (b.expiry_date < today) {
      entry.expired_qty += b.quantity
    } else {
      entry.expiring_soon_qty += b.quantity
    }
    if (b.expiry_date < entry.earliest_expiry) {
      entry.earliest_expiry = b.expiry_date
    }
    productMap.set(b.product_id, entry)
  }

  // Fetch product names
  const productIds = Array.from(productMap.keys())
  const { data: products } = await admin
    .from('products')
    .select('id, name')
    .in('id', productIds)

  // Build result sorted by earliest_expiry ASC
  const result: ExpiringProductAlert[] = (products ?? []).map((p) => {
    const stats = productMap.get(p.id)!
    return {
      name: p.name,
      expired_qty: stats.expired_qty,
      expiring_soon_qty: stats.expiring_soon_qty,
      earliest_expiry: stats.earliest_expiry,
    }
  })

  result.sort((a, b) => a.earliest_expiry.localeCompare(b.earliest_expiry))
  return result
}
