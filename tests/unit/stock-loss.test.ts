import { describe, it, expect } from 'vitest'
import { shapeStockLoss } from '@/lib/db/stock-loss'

function adj(over: Partial<Parameters<typeof shapeStockLoss>[0][number]> = {}) {
  return {
    adjusted_at: '2026-05-10T08:00:00.000Z',
    product_id: 'p1',
    delta: -3,
    reason: 'damaged',
    products: { name: 'Bread', cost_price: 10 },
    ...over,
  }
}

function take(over: Partial<Parameters<typeof shapeStockLoss>[1][number]> = {}) {
  return {
    taken_at: '2026-05-09T08:00:00.000Z',
    product_id: 'p2',
    qty_before: 20,
    qty_after: 15,
    products: { name: 'Milk', cost_price: 8 },
    ...over,
  }
}

describe('shapeStockLoss', () => {
  it('returns empty rows and zero totals when both inputs are empty', () => {
    const r = shapeStockLoss([], [])
    expect(r.rows).toEqual([])
    expect(r.totals).toEqual({
      total_items: 0,
      total_value: 0,
      rows_count: 0,
      rows_missing_cost: 0,
    })
  })

  it('counts a negative adjustment as a loss valued at cost_price', () => {
    const r = shapeStockLoss([adj({ delta: -5, products: { name: 'Coke', cost_price: 7 } })], [])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].qty_removed).toBe(5)
    expect(r.rows[0].value_lost).toBe(35)
    expect(r.rows[0].source).toBe('adjustment')
    expect(r.totals.total_value).toBe(35)
    expect(r.totals.total_items).toBe(5)
  })

  it('ignores zero and positive adjustment deltas (defensive — DB filter is the first line)', () => {
    const r = shapeStockLoss(
      [adj({ delta: 0 }), adj({ delta: 5 }), adj({ delta: -2, products: { name: 'X', cost_price: 1 } })],
      [],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].qty_removed).toBe(2)
  })

  it('counts a stock-take row only when qty_after < qty_before', () => {
    const r = shapeStockLoss(
      [],
      [
        take({ qty_before: 10, qty_after: 10 }),  // no change
        take({ qty_before: 10, qty_after: 12 }),  // increase
        take({ qty_before: 10, qty_after: 7, products: { name: 'Milk', cost_price: 8 } }),
      ],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].qty_removed).toBe(3)
    expect(r.rows[0].value_lost).toBe(24)
    expect(r.rows[0].source).toBe('stock_take')
  })

  it('treats null cost_price as zero in the value calc and counts it under rows_missing_cost', () => {
    const r = shapeStockLoss(
      [adj({ delta: -4, products: { name: 'Eggs', cost_price: null } })],
      [],
    )
    expect(r.rows[0].value_lost).toBe(0)
    expect(r.rows[0].cost_price).toBe(null)
    expect(r.totals.rows_missing_cost).toBe(1)
    expect(r.totals.rows_count).toBe(1)
  })

  it('sums totals across both sources and rounds value to 2dp', () => {
    const r = shapeStockLoss(
      [adj({ delta: -3, products: { name: 'A', cost_price: 1.235 } })],
      [take({ qty_before: 5, qty_after: 1, products: { name: 'B', cost_price: 2.5 } })],
    )
    // Adjustment: 3 × 1.235 = 3.705 → round → 3.71 (or 3.7 depending on rounding)
    // Stock-take: 4 × 2.5 = 10.00
    expect(r.totals.rows_count).toBe(2)
    expect(r.totals.total_items).toBe(7)
    expect(r.totals.total_value).toBeCloseTo(13.71, 2)
  })

  it('sorts rows by occurred_at descending', () => {
    const r = shapeStockLoss(
      [
        adj({ adjusted_at: '2026-05-01T00:00:00.000Z', delta: -1 }),
        adj({ adjusted_at: '2026-05-10T00:00:00.000Z', delta: -1 }),
      ],
      [take({ taken_at: '2026-05-05T00:00:00.000Z', qty_before: 5, qty_after: 4 })],
    )
    expect(r.rows.map((x) => x.occurred_at)).toEqual([
      '2026-05-10T00:00:00.000Z',
      '2026-05-05T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z',
    ])
  })

  it('preserves the reason on adjustment rows and leaves stock-take reason as null', () => {
    const r = shapeStockLoss(
      [adj({ reason: 'stolen', delta: -1 })],
      [take({ qty_before: 2, qty_after: 1 })],
    )
    expect(r.rows.find((x) => x.source === 'adjustment')!.reason).toBe('stolen')
    expect(r.rows.find((x) => x.source === 'stock_take')!.reason).toBe(null)
  })

  it('falls back to em-dash product name when the join returns null', () => {
    const r = shapeStockLoss(
      [adj({ delta: -1, products: null })],
      [],
    )
    expect(r.rows[0].product_name).toBe('—')
    expect(r.rows[0].cost_price).toBe(null)
  })

  it('passes a coded stock-take reason through to the row', () => {
    const r = shapeStockLoss(
      [],
      [take({ qty_before: 10, qty_after: 6, reason: 'unsure' })],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].reason).toBe('unsure')
  })

  it('excludes miscount corrections from the loss report entirely', () => {
    const r = shapeStockLoss(
      [],
      [
        take({ product_id: 'a', qty_before: 10, qty_after: 6, reason: 'miscount' }), // not loss
        take({ product_id: 'b', qty_before: 10, qty_after: 8, reason: 'unsure', products: { name: 'B', cost_price: 5 } }),
      ],
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].product_id).toBe('b')
    expect(r.totals.total_items).toBe(2)
    expect(r.totals.total_value).toBe(10)
  })
})
