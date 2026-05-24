import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
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
 * Resolve which Supabase client to use:
 *   - Caller-supplied client (e.g. request-scoped from a server component) wins.
 *   - Otherwise fall back to the request-scoped client.
 *   - External API routes (no owner session) MUST pass `createAdminClient()`
 *     explicitly — the request-scoped client has no auth context there and
 *     RLS would return zero rows.
 *
 * Dashboard server components default to the request-scoped client so owner
 * dashboards don't open an admin connection (better Supabase connection
 * pooling, and shop_id is still explicitly filtered).
 */
async function resolveClient(client: SupabaseClient | undefined, fallbackAdmin: boolean): Promise<SupabaseClient> {
  if (client) return client
  return fallbackAdmin ? createAdminClient() : await createClient()
}

/**
 * Get today's sales summary for a single shop.
 * Dashboard defaults to request-scoped client; external API passes admin.
 */
export async function getDailySalesForShop(
  shopId: string,
  date: Date = new Date(),
  client?: SupabaseClient,
): Promise<DailySummaryData> {
  const supabase = await resolveClient(client, false)
  const { start, end } = getSASTDayBounds(date)

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, total, teller_id')
    .eq('shop_id', shopId)
    .gte('completed_at', start)
    .lte('completed_at', end)

  if (salesError) throw salesError

  if (!sales || sales.length === 0) {
    return { salesCount: 0, totalRevenue: 0, totalProfit: 0, hasProfitData: false, topItems: [], tellerCount: 0 }
  }

  const saleIds = sales.map((s) => s.id)
  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0)
  const tellerCount = new Set(sales.map((s) => s.teller_id).filter(Boolean)).size

  const { data: saleItems, error: itemsError } = await supabase
    .from('sale_items')
    .select('quantity, product_id, unit_price, unit_cost, products(name)')
    .in('sale_id', saleIds)

  if (itemsError) throw itemsError

  const itemMap = new Map<string, { name: string; totalQty: number }>()
  let totalProfit = 0
  let hasProfitData = false
  for (const item of saleItems ?? []) {
    const productRaw = item.products as unknown as { name: string } | null
    const productName = productRaw?.name ?? 'Unknown product'
    const existing = itemMap.get(item.product_id)
    if (existing) {
      existing.totalQty += item.quantity
    } else {
      itemMap.set(item.product_id, { name: productName, totalQty: item.quantity })
    }
    if (item.unit_cost !== null && item.unit_cost !== undefined) {
      hasProfitData = true
      totalProfit += (Number(item.unit_price) - Number(item.unit_cost)) * item.quantity
    }
  }

  const topItems = [...itemMap.values()]
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 5)

  return {
    salesCount: sales.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    hasProfitData,
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
  client?: SupabaseClient,
): Promise<WeeklyDataPoint[]> {
  const supabase = await resolveClient(client, false)

  const dates: Date[] = []
  for (let i = days - 1; i >= 0; i--) {
    dates.push(subDays(now, i))
  }

  const windowStart = `${formatInTimeZone(dates[0], SAST_TZ, 'yyyy-MM-dd')}T00:00:00+02:00`
  const windowEnd = `${formatInTimeZone(now, SAST_TZ, 'yyyy-MM-dd')}T23:59:59.999+02:00`

  const { data: sales, error } = await supabase
    .from('sales')
    .select('total, completed_at')
    .eq('shop_id', shopId)
    .gte('completed_at', windowStart)
    .lte('completed_at', windowEnd)

  if (error) throw error

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
  client?: SupabaseClient,
): Promise<RecentSale[]> {
  const supabase = await resolveClient(client, false)

  const { data, error } = await supabase
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
  client?: SupabaseClient,
): Promise<TopProduct[]> {
  const supabase = await resolveClient(client, false)

  const weekStart = `${formatInTimeZone(subDays(now, 6), SAST_TZ, 'yyyy-MM-dd')}T00:00:00+02:00`
  const weekEnd = `${formatInTimeZone(now, SAST_TZ, 'yyyy-MM-dd')}T23:59:59.999+02:00`

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id')
    .eq('shop_id', shopId)
    .gte('completed_at', weekStart)
    .lte('completed_at', weekEnd)

  if (salesError) throw salesError
  if (!sales || sales.length === 0) return []

  const saleIds = sales.map((s) => s.id)

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('product_id, quantity, subtotal, products(name)')
    .in('sale_id', saleIds)

  if (itemsError) throw itemsError

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
 */
export async function getLowStockForShop(
  shopId: string,
  threshold: number,
  client?: SupabaseClient,
): Promise<LowStockItem[]> {
  const supabase = await resolveClient(client, false)

  const { data, error } = await supabase
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
 * Used by the external API stock endpoint (no owner session — admin client
 * is the only option there). Pass `createAdminClient()` explicitly from
 * those callers.
 */
export async function getProductsForShop(
  shopId: string,
  client?: SupabaseClient,
): Promise<ShopProduct[]> {
  const supabase = await resolveClient(client, true)

  const { data, error } = await supabase
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
 * "Expiring soon" = expiry_date between today and today + 7 days (inclusive).
 */
export async function getExpiringProductsForShop(
  shopId: string,
  client?: SupabaseClient,
): Promise<ExpiringProductAlert[]> {
  const supabase = await resolveClient(client, false)

  const today = formatInTimeZone(new Date(), SAST_TZ, 'yyyy-MM-dd')
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  const soonDate = formatInTimeZone(sevenDaysFromNow, SAST_TZ, 'yyyy-MM-dd')

  const { data: batches, error } = await supabase
    .from('product_batches')
    .select('product_id, expiry_date, quantity')
    .eq('shop_id', shopId)
    .gt('quantity', 0)
    .lte('expiry_date', soonDate)
    .order('expiry_date', { ascending: true })

  if (error) throw error
  if (!batches || batches.length === 0) return []

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

  const productIds = Array.from(productMap.keys())
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .in('id', productIds)

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
