import { describe, it, expect } from 'vitest'
import {
  shapeSalesStatistics,
  type RawStatSale,
  type RawStatItem,
  type RawStatProduct,
} from '@/lib/db/sales-statistics'

// Convenience builders ────────────────────────────────────────────────────
function sale(completed_at: string, total: number): RawStatSale {
  return { completed_at, total }
}
function item(
  product_id: string,
  product_name: string,
  quantity: number,
  unit_price: number,
  unit_cost: number | null,
): RawStatItem {
  return { product_id, product_name, quantity, unit_price, unit_cost }
}
function product(
  id: string,
  name: string,
  stock_qty: number,
  price: number,
  cost_price: number | null,
  created_at: string,
): RawStatProduct {
  return { id, name, stock_qty, price, cost_price, created_at }
}

const CREATED_EARLY = '2026-04-01T00:00:00Z'

describe('shapeSalesStatistics — rankings', () => {
  const sales = [sale('2026-05-02T08:00:00+02:00', 50), sale('2026-05-04T10:00:00+02:00', 40)]
  const items = [
    item('P1', 'Bread', 5, 10, 5), // revenue 50, profit (10-5)*5 = 25
    item('P2', 'Milk', 2, 20, null), // revenue 40, profit null (no cost)
  ]
  const products = [
    product('P1', 'Bread', 3, 10, 5, CREATED_EARLY),
    product('P2', 'Milk', 0, 20, null, CREATED_EARLY),
    product('P3', 'Sugar', 10, 8, 4, CREATED_EARLY), // unsold, in stock → non-mover
    product('P4', 'New item', 5, 15, null, '2026-06-01T00:00:00Z'), // created after range → not a non-mover
    product('P5', 'Empty', 0, 30, 10, CREATED_EARLY), // unsold but no stock → not a non-mover
  ]

  const stats = shapeSalesStatistics(sales, items, products, '2026-05-01', '2026-05-07', true)

  it('ranks top sellers by units sold (desc)', () => {
    expect(stats.top_sellers.map((p) => p.product_id)).toEqual(['P1', 'P2'])
    expect(stats.top_sellers[0].units_sold).toBe(5)
    expect(stats.top_sellers[0].revenue).toBe(50)
  })

  it('ranks lowest sellers by units sold (asc), only products that sold', () => {
    expect(stats.lowest_sellers.map((p) => p.product_id)).toEqual(['P2', 'P1'])
    // P3 never sold — must not appear in lowest sellers
    expect(stats.lowest_sellers.some((p) => p.product_id === 'P3')).toBe(false)
  })

  it('ranks most profitable by total profit and excludes products with no cost', () => {
    expect(stats.top_profit.map((p) => p.product_id)).toEqual(['P1'])
    expect(stats.top_profit[0].profit).toBe(25)
  })

  it('detects non-movers: in stock, unsold, created on/before range end', () => {
    expect(stats.non_movers.map((n) => n.product_id)).toEqual(['P3'])
    expect(stats.non_movers[0].stock_qty).toBe(10)
  })

  it('counts sold products missing a cost price', () => {
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
    [sale('2026-05-02T08:00:00+02:00', 50)],
    [item('P1', 'Bread', 5, 10, 5)],
    [product('P1', 'Bread', 3, 10, 5, CREATED_EARLY)],
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
  const products = [product('P3', 'Sugar', 10, 8, 4, CREATED_EARLY)]

  it('uses daily buckets for a 7-day range and fills zero days', () => {
    const stats = shapeSalesStatistics(
      [sale('2026-05-02T08:00:00+02:00', 50), sale('2026-05-04T10:00:00+02:00', 40)],
      [],
      products,
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
    const stats = shapeSalesStatistics([], [], products, '2026-01-01', '2026-01-31', true)
    expect(stats.granularity).toBe('daily')
    expect(stats.trend).toHaveLength(31)
  })

  it('switches to weekly buckets past 31 days', () => {
    const stats = shapeSalesStatistics([], [], products, '2026-01-01', '2026-02-01', true)
    expect(stats.granularity).toBe('weekly')
    // 32 days → ceil(32/7) = 5 weekly buckets, each labelled by its start day
    expect(stats.trend).toHaveLength(5)
    expect(stats.trend.map((b) => b.date)).toEqual([
      '2026-01-01',
      '2026-01-08',
      '2026-01-15',
      '2026-01-22',
      '2026-01-29',
    ])
  })

  it('sums sales into the correct weekly bucket', () => {
    const stats = shapeSalesStatistics(
      [
        sale('2026-01-03T08:00:00+02:00', 100), // week 0
        sale('2026-01-10T08:00:00+02:00', 200), // week 1
        sale('2026-01-11T08:00:00+02:00', 50), // week 1
      ],
      [],
      products,
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
      [sale('2026-05-02T08:00:00+02:00', 9.99)],
      [item('P1', 'Thing', 3, 3.33, 1.11)], // revenue 9.99, profit (3.33-1.11)*3 = 6.66
      [product('P1', 'Thing', 1, 3.33, 1.11, CREATED_EARLY)],
      '2026-05-01',
      '2026-05-07',
      true,
    )
    expect(stats.top_sellers[0].revenue).toBe(9.99)
    expect(stats.top_sellers[0].profit).toBe(6.66)
    expect(stats.totals.revenue).toBe(9.99)
  })
})
