import { describe, it, expect } from 'vitest'
import {
  shapeSalesStatistics,
  type AggProduct,
  type AggDay,
  type AggTotals,
  type NonMover,
} from '@/lib/db/sales-statistics'

// Phase 45b: aggregation now happens in the shop_sales_statistics SQL function.
// These tests cover the pure shaping logic that remains in JS — ranking,
// trend bucketing, rounding — fed the per-product / per-day aggregates the SQL
// function returns. (SQL-side aggregation correctness is verified live via RPC.)

// Convenience builders ────────────────────────────────────────────────────
function agg(
  product_id: string,
  name: string,
  units_sold: number,
  revenue: number,
  profit: number | null,
): AggProduct {
  return { product_id, name, units_sold, revenue, has_cost: profit !== null, profit }
}
function day(d: string, revenue: number, sales_count: number): AggDay {
  return { day: d, revenue, sales_count }
}
function nonMover(product_id: string, name: string, stock_qty: number, price: number): NonMover {
  return { product_id, name, stock_qty, price }
}
function totals(
  sales_count: number,
  units_sold: number,
  revenue: number,
  total_profit: number | null,
  products_missing_cost: number,
): AggTotals {
  return { sales_count, units_sold, revenue, total_profit, products_missing_cost }
}

describe('shapeSalesStatistics — rankings', () => {
  const perProduct = [
    agg('P1', 'Bread', 5, 50, 25), // units 5, revenue 50, profit 25
    agg('P2', 'Milk', 2, 40, null), // units 2, revenue 40, no cost
  ]
  const perDay = [day('2026-05-02', 50, 1), day('2026-05-04', 40, 1)]
  // SQL already excludes after-range + zero-stock products; only true non-movers arrive.
  const nonMovers = [nonMover('P3', 'Sugar', 10, 8)]
  const rawTotals = totals(2, 7, 90, 25, 1)

  const stats = shapeSalesStatistics(perProduct, perDay, nonMovers, rawTotals, '2026-05-01', '2026-05-07', true)

  it('ranks top sellers by units sold (desc)', () => {
    expect(stats.top_sellers.map((p) => p.product_id)).toEqual(['P1', 'P2'])
    expect(stats.top_sellers[0].units_sold).toBe(5)
    expect(stats.top_sellers[0].revenue).toBe(50)
  })

  it('ranks lowest sellers by units sold (asc), only products that sold', () => {
    expect(stats.lowest_sellers.map((p) => p.product_id)).toEqual(['P2', 'P1'])
    expect(stats.lowest_sellers.some((p) => p.product_id === 'P3')).toBe(false)
  })

  it('ranks most profitable by total profit and excludes products with no cost', () => {
    expect(stats.top_profit.map((p) => p.product_id)).toEqual(['P1'])
    expect(stats.top_profit[0].profit).toBe(25)
  })

  it('sorts non-movers by stock on hand (desc)', () => {
    expect(stats.non_movers.map((n) => n.product_id)).toEqual(['P3'])
    expect(stats.non_movers[0].stock_qty).toBe(10)
  })

  it('surfaces the SQL count of sold products missing a cost price', () => {
    expect(stats.totals.products_missing_cost).toBe(1)
  })

  it('computes totals', () => {
    expect(stats.totals.sales_count).toBe(2)
    expect(stats.totals.units_sold).toBe(7)
    expect(stats.totals.revenue).toBe(90)
    expect(stats.totals.avg_sale_value).toBe(45)
    expect(stats.totals.profit).toBe(25)
    expect(stats.totals.profit_tracking_enabled).toBe(true)
  })
})

describe('shapeSalesStatistics — profit tracking off', () => {
  const stats = shapeSalesStatistics(
    [agg('P1', 'Bread', 5, 50, 25)],
    [day('2026-05-02', 50, 1)],
    [],
    totals(1, 5, 50, 25, 0),
    '2026-05-01',
    '2026-05-07',
    false,
  )

  it('hides profit ranking and totals.profit when tracking is off', () => {
    expect(stats.top_profit).toEqual([])
    expect(stats.totals.profit).toBeNull()
    expect(stats.totals.profit_tracking_enabled).toBe(false)
  })
})

describe('shapeSalesStatistics — trend granularity', () => {
  it('uses daily buckets for a 7-day range and fills zero days', () => {
    const stats = shapeSalesStatistics(
      [],
      [day('2026-05-02', 50, 1), day('2026-05-04', 40, 1)],
      [],
      totals(2, 0, 90, 0, 0),
      '2026-05-01',
      '2026-05-07',
      true,
    )
    expect(stats.granularity).toBe('daily')
    expect(stats.trend).toHaveLength(7)
    expect(stats.trend[0]).toMatchObject({ date: '2026-05-01', revenue: 0, salesCount: 0 })
    expect(stats.trend[1]).toMatchObject({ date: '2026-05-02', revenue: 50, salesCount: 1 })
    expect(stats.trend[3]).toMatchObject({ date: '2026-05-04', revenue: 40, salesCount: 1 })
  })

  it('uses daily buckets at exactly 31 days', () => {
    const stats = shapeSalesStatistics([], [], [], totals(0, 0, 0, 0, 0), '2026-01-01', '2026-01-31', true)
    expect(stats.granularity).toBe('daily')
    expect(stats.trend).toHaveLength(31)
  })

  it('switches to weekly buckets past 31 days', () => {
    const stats = shapeSalesStatistics([], [], [], totals(0, 0, 0, 0, 0), '2026-01-01', '2026-02-01', true)
    expect(stats.granularity).toBe('weekly')
    expect(stats.trend).toHaveLength(5)
    expect(stats.trend.map((b) => b.date)).toEqual([
      '2026-01-01',
      '2026-01-08',
      '2026-01-15',
      '2026-01-22',
      '2026-01-29',
    ])
  })

  it('sums per-day revenue into the correct weekly bucket', () => {
    const stats = shapeSalesStatistics(
      [],
      [day('2026-01-03', 100, 1), day('2026-01-10', 200, 1), day('2026-01-11', 50, 1)],
      [],
      totals(3, 0, 350, 0, 0),
      '2026-01-01',
      '2026-02-01',
      true,
    )
    expect(stats.trend[0]).toMatchObject({ date: '2026-01-01', revenue: 100, salesCount: 1 })
    expect(stats.trend[1]).toMatchObject({ date: '2026-01-08', revenue: 250, salesCount: 2 })
  })
})

describe('shapeSalesStatistics — rounding', () => {
  it('rounds revenue and profit to 2 decimals', () => {
    const stats = shapeSalesStatistics(
      [agg('P1', 'Thing', 3, 9.99, 6.66)],
      [day('2026-05-02', 9.99, 1)],
      [],
      totals(1, 3, 9.99, 6.66, 0),
      '2026-05-01',
      '2026-05-07',
      true,
    )
    expect(stats.top_sellers[0].revenue).toBe(9.99)
    expect(stats.top_sellers[0].profit).toBe(6.66)
    expect(stats.totals.revenue).toBe(9.99)
  })
})
