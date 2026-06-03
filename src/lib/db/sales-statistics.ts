/**
 * Phase 42 — Sales Statistics. Phase 45b — aggregation pushed into SQL.
 *
 * A period overview for owners: a revenue trend graph, the products that sold
 * the most / least, the products that made the most profit, and the
 * "non-movers" — products that have stock on hand but sold nothing in the
 * window. Everything is derived from `sales` + `sale_items` + `products`.
 *
 * SCALE: the heavy aggregation (per-product sums, per-day revenue, non-mover
 * detection) is done in the `shop_sales_statistics` SQL function via GROUP BY,
 * so the number of rows returned to the app is bounded by (distinct products) +
 * (days in range), NOT by the number of sales. This removes the old 20,000-sale
 * cap that silently truncated an established shop's totals.
 *
 * `shapeSalesStatistics` stays pure (no DB, no clock) and only does the cheap,
 * well-tested parts: ranking (sort/slice over the bounded per-product list) and
 * trend bucketing (daily vs weekly over the bounded per-day list).
 */

import { createClient } from '@/lib/supabase/server'
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

// ── Aggregate inputs (shapes returned by the shop_sales_statistics SQL fn) ────

export interface AggProduct {
  product_id: string
  name: string
  units_sold: number
  revenue: number
  has_cost: boolean
  /** Summed profit; meaningful only when has_cost. */
  profit: number | null
}

export interface AggDay {
  /** SAST day, YYYY-MM-DD. */
  day: string
  revenue: number
  sales_count: number
}

export interface AggTotals {
  sales_count: number
  units_sold: number
  revenue: number
  total_profit: number | null
  products_missing_cost: number
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
 * Pure shaping function. Turns the SQL aggregates into the full statistics
 * payload: rankings (sort/slice) + trend bucketing. No DB, no clock.
 */
export function shapeSalesStatistics(
  perProduct: AggProduct[],
  perDay: AggDay[],
  nonMovers: NonMover[],
  rawTotals: AggTotals,
  fromYmd: string,
  toYmd: string,
  profitTrackingEnabled: boolean,
): SalesStatistics {
  // ── Movements (already per-product aggregated in SQL) ─────────────────────
  const movements: ProductMovement[] = perProduct.map((p) => ({
    product_id: p.product_id,
    name: p.name || '—',
    units_sold: p.units_sold,
    revenue: round2(p.revenue),
    profit: p.has_cost ? round2(p.profit ?? 0) : null,
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

  // ── Non-movers (SQL already filtered: in stock, unsold, created ≤ range end)
  const non_movers: NonMover[] = [...nonMovers]
    .map((n) => ({ ...n, price: round2(n.price) }))
    .sort((a, b) => b.stock_qty - a.stock_qty || a.name.localeCompare(b.name))

  // ── Revenue trend (adaptive daily vs weekly buckets) ─────────────────────
  const days = enumerateDays(fromYmd, toYmd)
  const granularity: Granularity = days.length <= DAILY_GRANULARITY_MAX_DAYS ? 'daily' : 'weekly'

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

  const perDayMap = new Map(perDay.map((d) => [d.day, d]))
  for (const day of days) {
    const agg = perDayMap.get(day)
    if (!agg) continue
    const start = dayToBucketStart.get(day) as string
    const b = buckets.get(start)!
    b.revenue += agg.revenue
    b.salesCount += agg.sales_count
  }

  const trend: WeeklyDataPoint[] = bucketOrder.map((start) => {
    const b = buckets.get(start)!
    return { label: dayLabel(start), date: start, revenue: round2(b.revenue), salesCount: b.salesCount }
  })

  // ── Totals ───────────────────────────────────────────────────────────────
  const salesCount = rawTotals.sales_count
  const revenue = round2(rawTotals.revenue)
  const totals: SalesStatsTotals = {
    sales_count: salesCount,
    units_sold: rawTotals.units_sold,
    revenue,
    avg_sale_value: salesCount > 0 ? round2(revenue / salesCount) : 0,
    profit: profitTrackingEnabled ? round2(rawTotals.total_profit ?? 0) : null,
    profit_tracking_enabled: profitTrackingEnabled,
    products_missing_cost: rawTotals.products_missing_cost,
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

/**
 * Fetch + shape sales statistics for a shop over an inclusive SAST day range.
 * The shop_sales_statistics SQL function (SECURITY INVOKER → RLS applies) does
 * all aggregation server-side; shop_id is also explicitly bound.
 */
export async function getSalesStatistics(
  shopId: string,
  fromYmd: string,
  toYmd: string,
  profitTrackingEnabled: boolean,
): Promise<SalesStatistics> {
  const supabase = await createClient()
  const fromIso = sastDayToUtc(fromYmd, false)
  const toIso = sastDayToUtc(toYmd, true)

  const { data, error } = await supabase.rpc('shop_sales_statistics', {
    p_shop_id: shopId,
    p_start: fromIso,
    p_end: toIso,
    p_range_end: toIso,
  })
  if (error) throw error

  const payload = (data ?? {}) as {
    per_product?: AggProduct[]
    per_day?: AggDay[]
    non_movers?: NonMover[]
    totals?: AggTotals
  }
  const rawTotals: AggTotals = payload.totals ?? {
    sales_count: 0,
    units_sold: 0,
    revenue: 0,
    total_profit: 0,
    products_missing_cost: 0,
  }

  return shapeSalesStatistics(
    payload.per_product ?? [],
    payload.per_day ?? [],
    payload.non_movers ?? [],
    rawTotals,
    fromYmd,
    toYmd,
    profitTrackingEnabled,
  )
}
