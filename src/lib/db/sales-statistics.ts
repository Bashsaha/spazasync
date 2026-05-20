/**
 * Phase 42 — Sales Statistics.
 *
 * A period overview for owners: a revenue trend graph, the products that sold
 * the most / least, the products that made the most profit, and the
 * "non-movers" — products that have stock on hand but sold nothing in the
 * window. Everything is derived from `sales` + `sale_items` + `products`; there
 * is no new table.
 *
 * Profit is only meaningful when the shop has cost prices: it is the sum of
 * `(unit_price - unit_cost) * quantity` over items whose `unit_cost` snapshot is
 * present. Products with no cost price are excluded from the profit ranking and
 * counted in `products_missing_cost` so the UI can nudge the owner.
 *
 * The shaping function is pure (no DB, no clock) so it can be unit-tested. The
 * fetcher resolves SAST day bounds → UTC timestamps and feeds it raw rows.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { formatInTimeZone } from 'date-fns-tz'
import { SAST_TZ } from '@/lib/utils/date'
import type { WeeklyDataPoint } from '@/types'

export type Granularity = 'daily' | 'weekly'

/** Threshold (inclusive) at which the trend graph switches daily → weekly. */
export const DAILY_GRANULARITY_MAX_DAYS = 31

export interface ProductMovement {
  product_id: string
  name: string
  units_sold: number
  revenue: number
  /** Total profit over the period, or null when no cost price is known. */
  profit: number | null
}

export interface NonMover {
  product_id: string
  name: string
  stock_qty: number
  price: number
}

export interface SalesStatsTotals {
  sales_count: number
  units_sold: number
  revenue: number
  avg_sale_value: number
  /** Null when profit tracking is off. */
  profit: number | null
  profit_tracking_enabled: boolean
  /** Distinct sold products with no cost price (profit ranking is partial). */
  products_missing_cost: number
}

export interface SalesStatistics {
  from: string
  to: string
  granularity: Granularity
  trend: WeeklyDataPoint[]
  totals: SalesStatsTotals
  top_sellers: ProductMovement[]
  lowest_sellers: ProductMovement[]
  top_profit: ProductMovement[]
  non_movers: NonMover[]
}

export interface RawStatSale {
  completed_at: string
  total: number
}

export interface RawStatItem {
  product_id: string
  quantity: number
  unit_price: number
  unit_cost: number | null
  product_name: string
}

export interface RawStatProduct {
  id: string
  name: string
  stock_qty: number
  price: number
  cost_price: number | null
  created_at: string
}

const LIST_LIMIT = 10

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Enumerate SAST day strings (YYYY-MM-DD) from `fromYmd` to `toYmd` inclusive. */
function enumerateDays(fromYmd: string, toYmd: string): string[] {
  const days: string[] = []
  const [fy, fm, fd] = fromYmd.split('-').map((n) => parseInt(n, 10))
  const [ty, tm, td] = toYmd.split('-').map((n) => parseInt(n, 10))
  let cursor = Date.UTC(fy, fm - 1, fd)
  const end = Date.UTC(ty, tm - 1, td)
  // Guard against an inverted range — caller validates, but stay safe.
  while (cursor <= end && days.length < 1000) {
    days.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += 24 * 60 * 60 * 1000
  }
  return days
}

/** Human label for a bucket start day, e.g. "5 Jun". */
function dayLabel(ymd: string): string {
  return formatInTimeZone(new Date(`${ymd}T00:00:00+02:00`), SAST_TZ, 'd MMM')
}

/**
 * Pure shaping function. Collapses raw rows into the full statistics payload.
 * `fromYmd`/`toYmd` are SAST day strings (YYYY-MM-DD); `sales[].completed_at`
 * are ISO timestamps.
 */
export function shapeSalesStatistics(
  sales: RawStatSale[],
  items: RawStatItem[],
  products: RawStatProduct[],
  fromYmd: string,
  toYmd: string,
  profitTrackingEnabled: boolean,
): SalesStatistics {
  // ── Per-product aggregation from sale items ──────────────────────────────
  interface Agg {
    name: string
    units: number
    revenue: number
    profit: number
    hasCost: boolean
  }
  const byProduct = new Map<string, Agg>()
  let totalUnits = 0
  let totalProfit = 0

  for (const it of items) {
    const existing = byProduct.get(it.product_id)
    const lineRevenue = it.unit_price * it.quantity
    const hasCost = it.unit_cost !== null && it.unit_cost !== undefined
    const lineProfit = hasCost ? (it.unit_price - (it.unit_cost as number)) * it.quantity : 0
    totalUnits += it.quantity
    if (hasCost) totalProfit += lineProfit
    if (existing) {
      existing.units += it.quantity
      existing.revenue += lineRevenue
      existing.profit += lineProfit
      existing.hasCost = existing.hasCost || hasCost
      if (!existing.name && it.product_name) existing.name = it.product_name
    } else {
      byProduct.set(it.product_id, {
        name: it.product_name || '—',
        units: it.quantity,
        revenue: lineRevenue,
        profit: lineProfit,
        hasCost,
      })
    }
  }

  const movements: ProductMovement[] = [...byProduct.entries()].map(([product_id, a]) => ({
    product_id,
    name: a.name,
    units_sold: a.units,
    revenue: round2(a.revenue),
    profit: a.hasCost ? round2(a.profit) : null,
  }))

  // ── Top / lowest sellers (by units sold) ─────────────────────────────────
  const top_sellers = [...movements]
    .sort((a, b) => b.units_sold - a.units_sold || b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, LIST_LIMIT)

  const lowest_sellers = [...movements]
    .filter((m) => m.units_sold > 0)
    .sort((a, b) => a.units_sold - b.units_sold || a.revenue - b.revenue || a.name.localeCompare(b.name))
    .slice(0, LIST_LIMIT)

  // ── Most profitable (by total profit) — only when cost data exists ───────
  const top_profit = profitTrackingEnabled
    ? [...movements]
        .filter((m) => m.profit !== null)
        .sort((a, b) => (b.profit as number) - (a.profit as number) || a.name.localeCompare(b.name))
        .slice(0, LIST_LIMIT)
    : []

  // ── Non-movers: in stock, zero units sold, and existed by the range end ──
  const soldIds = new Set(byProduct.keys())
  const rangeEndMs = new Date(`${toYmd}T23:59:59.999+02:00`).getTime()
  const non_movers: NonMover[] = products
    .filter(
      (p) =>
        p.stock_qty > 0 &&
        !soldIds.has(p.id) &&
        new Date(p.created_at).getTime() <= rangeEndMs,
    )
    .map((p) => ({ product_id: p.id, name: p.name, stock_qty: p.stock_qty, price: round2(p.price) }))
    .sort((a, b) => b.stock_qty - a.stock_qty || a.name.localeCompare(b.name))

  // ── Revenue trend (adaptive daily vs weekly buckets) ─────────────────────
  const days = enumerateDays(fromYmd, toYmd)
  const granularity: Granularity = days.length <= DAILY_GRANULARITY_MAX_DAYS ? 'daily' : 'weekly'

  // Map each SAST day to its bucket start day.
  const dayToBucketStart = new Map<string, string>()
  for (let i = 0; i < days.length; i++) {
    const bucketStart = granularity === 'daily' ? days[i] : days[Math.floor(i / 7) * 7]
    dayToBucketStart.set(days[i], bucketStart)
  }

  const bucketOrder: string[] = []
  const buckets = new Map<string, { revenue: number; salesCount: number }>()
  for (const day of days) {
    const start = dayToBucketStart.get(day) as string
    if (!buckets.has(start)) {
      buckets.set(start, { revenue: 0, salesCount: 0 })
      bucketOrder.push(start)
    }
  }

  let totalRevenue = 0
  for (const s of sales) {
    totalRevenue += s.total
    const sast = formatInTimeZone(new Date(s.completed_at), SAST_TZ, 'yyyy-MM-dd')
    const start = dayToBucketStart.get(sast)
    if (!start) continue // outside the enumerated range (shouldn't happen)
    const b = buckets.get(start)!
    b.revenue += s.total
    b.salesCount += 1
  }

  const trend: WeeklyDataPoint[] = bucketOrder.map((start) => {
    const b = buckets.get(start)!
    return {
      label: dayLabel(start),
      date: start,
      revenue: round2(b.revenue),
      salesCount: b.salesCount,
    }
  })

  // ── Totals ───────────────────────────────────────────────────────────────
  const salesCount = sales.length
  const revenue = round2(totalRevenue)
  const productsMissingCost = [...byProduct.values()].filter((a) => !a.hasCost).length

  const totals: SalesStatsTotals = {
    sales_count: salesCount,
    units_sold: totalUnits,
    revenue,
    avg_sale_value: salesCount > 0 ? round2(revenue / salesCount) : 0,
    profit: profitTrackingEnabled ? round2(totalProfit) : null,
    profit_tracking_enabled: profitTrackingEnabled,
    products_missing_cost: productsMissingCost,
  }

  return {
    from: fromYmd,
    to: toYmd,
    granularity,
    trend,
    totals,
    top_sellers,
    lowest_sellers,
    top_profit,
    non_movers,
  }
}

function sastDayToUtc(ymd: string, end: boolean): string {
  const [y, mo, d] = ymd.split('-').map((n) => parseInt(n, 10))
  const utc = end
    ? Date.UTC(y, mo - 1, d, 21, 59, 59, 999)
    : Date.UTC(y, mo - 1, d, -2, 0, 0, 0)
  return new Date(utc).toISOString()
}

function normaliseName(raw: unknown): string {
  if (!raw) return '—'
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object') return '—'
  const o = obj as { name?: unknown }
  return typeof o.name === 'string' ? o.name : '—'
}

/**
 * Fetch + shape sales statistics for a shop over an inclusive SAST day range.
 * Uses the admin client scoped by shopId (mirrors lib/db/reports.ts).
 */
export async function getSalesStatistics(
  shopId: string,
  fromYmd: string,
  toYmd: string,
  profitTrackingEnabled: boolean,
): Promise<SalesStatistics> {
  const admin = createAdminClient()
  const fromIso = sastDayToUtc(fromYmd, false)
  const toIso = sastDayToUtc(toYmd, true)

  const [salesRes, productsRes] = await Promise.all([
    admin
      .from('sales')
      .select('id, total, completed_at')
      .eq('shop_id', shopId)
      .gte('completed_at', fromIso)
      .lte('completed_at', toIso),
    admin
      .from('products')
      .select('id, name, stock_qty, price, cost_price, created_at')
      .eq('shop_id', shopId),
  ])

  if (salesRes.error) throw salesRes.error
  if (productsRes.error) throw productsRes.error

  const rawSales = (salesRes.data ?? []).map((s) => ({
    completed_at: s.completed_at as string,
    total: Number(s.total),
  }))

  let items: RawStatItem[] = []
  const saleIds = (salesRes.data ?? []).map((s) => s.id as string)
  if (saleIds.length > 0) {
    const { data: itemRows, error: itemsError } = await admin
      .from('sale_items')
      .select('product_id, quantity, unit_price, unit_cost, products(name)')
      .in('sale_id', saleIds)
    if (itemsError) throw itemsError
    items = (itemRows ?? []).map((r) => ({
      product_id: r.product_id as string,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      unit_cost: r.unit_cost === null || r.unit_cost === undefined ? null : Number(r.unit_cost),
      product_name: normaliseName(r.products),
    }))
  }

  const products: RawStatProduct[] = (productsRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    stock_qty: Number(p.stock_qty),
    price: Number(p.price),
    cost_price: p.cost_price === null || p.cost_price === undefined ? null : Number(p.cost_price),
    created_at: p.created_at as string,
  }))

  return shapeSalesStatistics(rawSales, items, products, fromYmd, toYmd, profitTrackingEnabled)
}
