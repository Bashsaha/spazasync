/**
 * Phase 40 — Stock Loss Report.
 *
 * "Stock loss" here means stock that left the shop WITHOUT being sold:
 *   - manual decrements on the products page / stock detail (→ stock_adjustments, delta < 0)
 *   - stock-take corrections where the counted qty was lower than expected
 *     (→ stock_take_entries, qty_after < qty_before)
 *
 * Sales are NEVER in either of those tables — `decrement_stock_fefo` writes
 * straight to `products.stock_qty` and to `sale_batch_consumptions`. So this
 * report cannot accidentally count a sold item as "lost".
 *
 * Money lost is valued at cost_price (what the shop actually paid). Rows whose
 * product has no cost_price set show value_lost = 0; the totals expose how
 * many rows are in that state so the UI can nudge the owner toward
 * `/products?missing_cost=1`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type StockLossSource = 'adjustment' | 'stock_take'

export interface StockLossRow {
  occurred_at: string
  product_id: string
  product_name: string
  qty_removed: number
  cost_price: number | null
  /** qty_removed × (cost_price ?? 0), rounded to 2dp. */
  value_lost: number
  source: StockLossSource
  reason: string | null
}

export interface StockLossTotals {
  total_items: number
  total_value: number
  rows_count: number
  rows_missing_cost: number
}

export interface StockLossReport {
  rows: StockLossRow[]
  totals: StockLossTotals
}

interface RawAdjustment {
  adjusted_at: string
  product_id: string
  delta: number
  reason: string | null
  products: { name: string; cost_price: number | null } | null
}

interface RawStockTake {
  taken_at: string
  product_id: string
  qty_before: number
  qty_after: number
  reason?: string | null
  products: { name: string; cost_price: number | null } | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Pure shaping function — collapses raw `stock_adjustments` + `stock_take_entries`
 * rows into a unified loss ledger. Filters out non-loss rows (positive/zero
 * deltas and stock-takes where the counted qty went up or stayed flat).
 */
export function shapeStockLoss(
  adjustments: RawAdjustment[],
  stockTakes: RawStockTake[],
): StockLossReport {
  const rows: StockLossRow[] = []

  for (const row of adjustments) {
    // Only count negative deltas. Defensive: even if the DB query already
    // filtered, the shaping function alone should still be safe to call.
    if (row.delta >= 0) continue
    const qtyRemoved = -row.delta
    const costPrice = row.products?.cost_price ?? null
    rows.push({
      occurred_at: row.adjusted_at,
      product_id: row.product_id,
      product_name: row.products?.name ?? '—',
      qty_removed: qtyRemoved,
      cost_price: costPrice,
      value_lost: round2(qtyRemoved * (costPrice ?? 0)),
      source: 'adjustment',
      reason: row.reason ?? null,
    })
  }

  for (const row of stockTakes) {
    if (row.qty_after >= row.qty_before) continue
    // A "miscount" correction isn't real loss — the previous number was just
    // wrong. Record it on the entry, but never count it as shrinkage here.
    if (row.reason === 'miscount') continue
    const qtyRemoved = row.qty_before - row.qty_after
    const costPrice = row.products?.cost_price ?? null
    rows.push({
      occurred_at: row.taken_at,
      product_id: row.product_id,
      product_name: row.products?.name ?? '—',
      qty_removed: qtyRemoved,
      cost_price: costPrice,
      value_lost: round2(qtyRemoved * (costPrice ?? 0)),
      source: 'stock_take',
      reason: row.reason ?? null,
    })
  }

  rows.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  const totals: StockLossTotals = {
    total_items: rows.reduce((s, r) => s + r.qty_removed, 0),
    total_value: round2(rows.reduce((s, r) => s + r.value_lost, 0)),
    rows_count: rows.length,
    rows_missing_cost: rows.filter((r) => r.cost_price === null).length,
  }

  return { rows, totals }
}

/**
 * Fetch and shape stock loss for a shop between two ISO timestamps (inclusive).
 * Caller is responsible for resolving SAST day boundaries → UTC timestamps.
 */
export async function getStockLoss(
  supabase: SupabaseClient,
  shopId: string,
  fromIso: string,
  toIso: string,
): Promise<StockLossReport> {
  const [adjResult, takeResult] = await Promise.all([
    supabase
      .from('stock_adjustments')
      .select('adjusted_at, product_id, delta, reason, products(name, cost_price)')
      .eq('shop_id', shopId)
      .lt('delta', 0)
      .gte('adjusted_at', fromIso)
      .lte('adjusted_at', toIso),
    supabase
      .from('stock_take_entries')
      .select('taken_at, product_id, qty_before, qty_after, reason, products(name, cost_price)')
      .eq('shop_id', shopId)
      .gte('taken_at', fromIso)
      .lte('taken_at', toIso),
  ])

  if (adjResult.error) throw adjResult.error
  if (takeResult.error) throw takeResult.error

  // Supabase's nested select returns `products` as an array when the FK could
  // resolve to many rows; for a single-parent FK we still get an array of
  // length 1 in some runtime configs. Normalise both shapes.
  const adjustments = (adjResult.data ?? []).map((r) => ({
    adjusted_at: r.adjusted_at as string,
    product_id: r.product_id as string,
    delta: r.delta as number,
    reason: (r.reason as string | null) ?? null,
    products: normaliseProduct(r.products),
  }))
  const stockTakes = (takeResult.data ?? []).map((r) => ({
    taken_at: r.taken_at as string,
    product_id: r.product_id as string,
    qty_before: r.qty_before as number,
    qty_after: r.qty_after as number,
    reason: (r.reason as string | null) ?? null,
    products: normaliseProduct(r.products),
  }))

  return shapeStockLoss(adjustments, stockTakes)
}

function normaliseProduct(
  raw: unknown,
): { name: string; cost_price: number | null } | null {
  if (!raw) return null
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object') return null
  const o = obj as { name?: unknown; cost_price?: unknown }
  return {
    name: typeof o.name === 'string' ? o.name : '—',
    cost_price: typeof o.cost_price === 'number' ? o.cost_price : null,
  }
}
