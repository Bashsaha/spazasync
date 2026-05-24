import type { SupabaseClient } from '@supabase/supabase-js'
import type { SaleWithDetails } from '@/types'

export interface MonthlySalesShop {
  id: string
  name: string
  code: string
  profit_tracking_enabled: boolean
}

export interface PerDayRow {
  date: string // YYYY-MM-DD
  sale_count: number
  revenue: number
  profit: number | null
}

export interface PerTellerRow {
  teller_id: string | null // null bucket for legacy sales with no teller
  teller_name: string // "No teller recorded" for null bucket
  sale_count: number
  revenue: number
  profit: number | null
}

export interface MonthlyTotals {
  total_sales: number
  total_revenue: number
  total_profit: number | null // null if ANY line item has null unit_cost
  days_with_sales: number
}

export interface MonthlySalesReport {
  shop: MonthlySalesShop
  year: number
  month: number // 1-12
  sales: SaleWithDetails[]
  perDay: PerDayRow[]
  perTeller: PerTellerRow[]
  totals: MonthlyTotals
}

/** SAST is UTC+2 year-round (no DST). */
function sastMonthBoundaries(year: number, month: number): { start: string; end: string } {
  const startDay = `${year}-${String(month).padStart(2, '0')}-01`
  // Last day of the given month — use Date arithmetic in UTC since SAST has no DST.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const endDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return {
    start: `${startDay}T00:00:00+02:00`,
    end: `${endDay}T23:59:59.999+02:00`,
  }
}

/** SAST date (YYYY-MM-DD) for a timestamp — naive SAST offset without date-fns. */
function toSastDate(iso: string): string {
  // Add 2h to shift to SAST then take the date portion
  const utc = new Date(iso)
  const sast = new Date(utc.getTime() + 2 * 60 * 60 * 1000)
  return sast.toISOString().slice(0, 10)
}

interface SaleItemRow {
  id: string
  product_id: string
  quantity: number
  unit_price: number | string
  unit_cost: number | string | null
  subtotal: number | string
  products: { name: string; barcode: string | null } | null
}

interface SaleRow {
  id: string
  total: number | string
  completed_at: string
  teller_id: string | null
  tellers: { name: string } | null
  sale_items: SaleItemRow[]
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) : v
}

function toNullableNumber(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  return typeof v === 'string' ? parseFloat(v) : v
}

/**
 * Aggregate every sale across a calendar month into a report-ready structure.
 * Pure computation — the SaleWithDetails array comes from one Supabase query.
 *
 * Profit semantics: returns null for per-day / per-teller / totals whenever ANY
 * line in the scope has null unit_cost — mirrors the daily helper so the PDF can
 * show "profit unavailable" rather than a misleading zero.
 */
export function aggregateMonthlyReport(
  sales: SaleWithDetails[],
  shop: MonthlySalesShop,
  year: number,
  month: number,
): MonthlySalesReport {
  // Per-day roll-up
  const dayMap = new Map<string, { sale_count: number; revenue: number; profit: number; hasNull: boolean }>()
  // Per-teller roll-up (null_id bucket for legacy)
  const tellerMap = new Map<string | null, { teller_name: string; sale_count: number; revenue: number; profit: number; hasNull: boolean }>()

  let totalRevenue = 0
  let totalProfit = 0
  let totalsHasNull = false

  for (const sale of sales) {
    const day = toSastDate(sale.completed_at)
    const d = dayMap.get(day) ?? { sale_count: 0, revenue: 0, profit: 0, hasNull: false }
    d.sale_count += 1
    d.revenue += sale.total
    if (sale.profit === null) d.hasNull = true
    else d.profit += sale.profit
    dayMap.set(day, d)

    const tKey = sale.teller_id ?? null
    const t = tellerMap.get(tKey) ?? {
      teller_name: sale.teller_name ?? 'No teller recorded',
      sale_count: 0,
      revenue: 0,
      profit: 0,
      hasNull: false,
    }
    t.sale_count += 1
    t.revenue += sale.total
    if (sale.profit === null) t.hasNull = true
    else t.profit += sale.profit
    tellerMap.set(tKey, t)

    totalRevenue += sale.total
    if (sale.profit === null) totalsHasNull = true
    else totalProfit += sale.profit
  }

  const perDay: PerDayRow[] = Array.from(dayMap.entries())
    .map(([date, v]) => ({
      date,
      sale_count: v.sale_count,
      revenue: v.revenue,
      profit: shop.profit_tracking_enabled && !v.hasNull ? v.profit : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const perTeller: PerTellerRow[] = Array.from(tellerMap.entries())
    .map(([teller_id, v]) => ({
      teller_id,
      teller_name: v.teller_name,
      sale_count: v.sale_count,
      revenue: v.revenue,
      profit: shop.profit_tracking_enabled && !v.hasNull ? v.profit : null,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    shop,
    year,
    month,
    sales,
    perDay,
    perTeller,
    totals: {
      total_sales: sales.length,
      total_revenue: totalRevenue,
      total_profit: shop.profit_tracking_enabled && !totalsHasNull ? totalProfit : null,
      days_with_sales: dayMap.size,
    },
  }
}

/**
 * Fetch every sale in the month (one round-trip) and aggregate.
 */
export async function getMonthlySalesReport(
  supabase: SupabaseClient,
  shopId: string,
  year: number,
  month: number,
): Promise<MonthlySalesReport> {
  if (month < 1 || month > 12) throw new Error('month must be 1-12')

  const { data: shopRow, error: shopErr } = await supabase
    .from('shops')
    .select('id, name, code, profit_tracking_enabled')
    .eq('id', shopId)
    .single()
  if (shopErr) throw shopErr

  const shop: MonthlySalesShop = {
    id: shopRow.id,
    name: shopRow.name,
    code: shopRow.code,
    profit_tracking_enabled: Boolean(shopRow.profit_tracking_enabled),
  }

  const { start, end } = sastMonthBoundaries(year, month)
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, total, completed_at, teller_id, tellers(name), sale_items(id, product_id, quantity, unit_price, unit_cost, subtotal, products(name, barcode))',
    )
    .eq('shop_id', shopId)
    .gte('completed_at', start)
    .lte('completed_at', end)
    .order('completed_at', { ascending: true })
    // Hard ceiling: protects PDF generation memory + Supabase egress. 200
    // sales/day × 31 days = 6,200 — well under the cap. If a real shop ever
    // hits 10k+ sales in a month, this needs proper pagination.
    .limit(10_000)
  if (error) throw error

  const rows = (data ?? []) as unknown as SaleRow[]
  const sales: SaleWithDetails[] = rows.map((sale) => {
    const items = (sale.sale_items ?? []).map((row) => {
      const unit_price = toNumber(row.unit_price)
      const unit_cost = toNullableNumber(row.unit_cost)
      return {
        id: row.id,
        product_id: row.product_id,
        product_name: row.products?.name ?? '(deleted product)',
        product_barcode: row.products?.barcode ?? null,
        quantity: row.quantity,
        unit_price,
        unit_cost,
        subtotal: toNumber(row.subtotal),
        line_profit: unit_cost === null ? null : (unit_price - unit_cost) * row.quantity,
      }
    })
    const profit = items.some((i) => i.line_profit === null)
      ? null
      : items.reduce((sum, i) => sum + (i.line_profit ?? 0), 0)
    return {
      id: sale.id,
      total: toNumber(sale.total),
      completed_at: sale.completed_at,
      teller_id: sale.teller_id,
      teller_name: sale.tellers?.name ?? null,
      items,
      profit,
    }
  })

  return aggregateMonthlyReport(sales, shop, year, month)
}
