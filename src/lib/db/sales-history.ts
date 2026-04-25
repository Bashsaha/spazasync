import type { SaleWithDetails, SaleItemWithProduct, DailySalesTotals } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/** SAST is UTC+2 year-round (no DST). Build ISO day boundaries directly. */
function sastDayBoundaries(dateYmd: string): { start: string; end: string } {
  // dateYmd like "2026-04-24" → "2026-04-24T00:00:00+02:00" .. "2026-04-24T23:59:59.999+02:00"
  return {
    start: `${dateYmd}T00:00:00+02:00`,
    end: `${dateYmd}T23:59:59.999+02:00`,
  }
}

/**
 * Pure helper — compute the profit for a single sale.
 * Returns null if any item has a null unit_cost (meaning cost data is incomplete for this sale).
 */
export function computeSaleProfit(items: SaleItemWithProduct[]): number | null {
  let sum = 0
  for (const item of items) {
    if (item.line_profit === null) return null
    sum += item.line_profit
  }
  return sum
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

function shapeItem(row: SaleItemRow): SaleItemWithProduct {
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
}

/**
 * List every sale for a given SAST date, joined with teller + line items + product names.
 * Ordered newest-first within the day.
 */
export async function listSalesForDate(
  supabase: SupabaseClient,
  shopId: string,
  dateYmd: string,
): Promise<SaleWithDetails[]> {
  const { start, end } = sastDayBoundaries(dateYmd)
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, total, completed_at, teller_id, tellers(name), sale_items(id, product_id, quantity, unit_price, unit_cost, subtotal, products(name, barcode))',
    )
    .eq('shop_id', shopId)
    .gte('completed_at', start)
    .lte('completed_at', end)
    .order('completed_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as SaleRow[]
  return rows.map((sale) => {
    const items = (sale.sale_items ?? []).map(shapeItem)
    return {
      id: sale.id,
      total: toNumber(sale.total),
      completed_at: sale.completed_at,
      teller_id: sale.teller_id,
      teller_name: sale.tellers?.name ?? null,
      items,
      profit: computeSaleProfit(items),
    }
  })
}

/** Aggregate totals for a day — cheap to derive from already-shaped sales. */
export function computeDailyTotals(
  sales: SaleWithDetails[],
  profitTrackingEnabled: boolean,
): DailySalesTotals {
  let revenue = 0
  let profit = 0
  let hasNullProfit = false
  const tellerIds = new Set<string>()
  for (const sale of sales) {
    revenue += sale.total
    if (sale.profit === null) hasNullProfit = true
    else profit += sale.profit
    if (sale.teller_id) tellerIds.add(sale.teller_id)
  }
  return {
    saleCount: sales.length,
    revenue,
    profit: profitTrackingEnabled && !hasNullProfit ? profit : null,
    uniqueTellers: tellerIds.size,
  }
}
