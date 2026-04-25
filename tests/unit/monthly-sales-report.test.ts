import { describe, it, expect } from 'vitest'
import { aggregateMonthlyReport } from '@/lib/db/monthly-sales-report'
import type { SaleWithDetails } from '@/types'

const shop = {
  id: 'shop-1',
  name: 'Test Spaza',
  code: 'TEST01',
  profit_tracking_enabled: true,
}

function mkSale(
  id: string,
  completed_at: string,
  teller_id: string | null,
  teller_name: string | null,
  items: Array<{ unit_price: number; unit_cost: number | null; quantity: number }>,
): SaleWithDetails {
  const mapped = items.map((i, idx) => ({
    id: `${id}-i${idx}`,
    product_id: `p${idx}`,
    product_name: `Product ${idx}`,
    product_barcode: null,
    quantity: i.quantity,
    unit_price: i.unit_price,
    unit_cost: i.unit_cost,
    subtotal: i.unit_price * i.quantity,
    line_profit: i.unit_cost === null ? null : (i.unit_price - i.unit_cost) * i.quantity,
  }))
  const total = mapped.reduce((s, m) => s + m.subtotal, 0)
  const hasNullCost = mapped.some((m) => m.line_profit === null)
  return {
    id,
    total,
    completed_at,
    teller_id,
    teller_name,
    items: mapped,
    profit: hasNullCost ? null : mapped.reduce((s, m) => s + (m.line_profit ?? 0), 0),
  }
}

describe('aggregateMonthlyReport', () => {
  it('empty month returns zero totals and empty roll-ups', () => {
    const r = aggregateMonthlyReport([], shop, 2026, 4)
    expect(r.totals.total_sales).toBe(0)
    expect(r.totals.total_revenue).toBe(0)
    expect(r.totals.total_profit).toBe(0)
    expect(r.totals.days_with_sales).toBe(0)
    expect(r.perDay).toHaveLength(0)
    expect(r.perTeller).toHaveLength(0)
    expect(r.shop.code).toBe('TEST01')
    expect(r.year).toBe(2026)
    expect(r.month).toBe(4)
  })

  it('rolls up per-day and per-teller when all costs are present', () => {
    const sales = [
      mkSale('s1', '2026-04-01T08:00:00+00:00', 't1', 'Ayesha', [{ unit_price: 10, unit_cost: 6, quantity: 2 }]), // revenue 20, profit 8
      mkSale('s2', '2026-04-01T12:00:00+00:00', 't1', 'Ayesha', [{ unit_price: 5, unit_cost: 3, quantity: 1 }]),  // revenue 5, profit 2
      mkSale('s3', '2026-04-02T09:00:00+00:00', 't2', 'Bongani', [{ unit_price: 20, unit_cost: 12, quantity: 1 }]), // revenue 20, profit 8
    ]
    const r = aggregateMonthlyReport(sales, shop, 2026, 4)
    expect(r.totals.total_sales).toBe(3)
    expect(r.totals.total_revenue).toBe(45)
    expect(r.totals.total_profit).toBe(18)
    expect(r.totals.days_with_sales).toBe(2)

    expect(r.perDay).toHaveLength(2)
    expect(r.perDay[0]).toMatchObject({ date: '2026-04-01', sale_count: 2, revenue: 25, profit: 10 })
    expect(r.perDay[1]).toMatchObject({ date: '2026-04-02', sale_count: 1, revenue: 20, profit: 8 })

    expect(r.perTeller).toHaveLength(2)
    // Sorted by revenue desc — Ayesha (25) before Bongani (20)
    expect(r.perTeller[0]).toMatchObject({ teller_name: 'Ayesha', sale_count: 2, revenue: 25, profit: 10 })
    expect(r.perTeller[1]).toMatchObject({ teller_name: 'Bongani', sale_count: 1, revenue: 20, profit: 8 })
  })

  it('propagates null profit when any line has null unit_cost', () => {
    const sales = [
      mkSale('s1', '2026-04-05T10:00:00+00:00', 't1', 'Ayesha', [
        { unit_price: 10, unit_cost: 6, quantity: 1 },
        { unit_price: 5, unit_cost: null, quantity: 2 }, // missing cost → sale.profit = null
      ]),
      mkSale('s2', '2026-04-05T11:00:00+00:00', 't1', 'Ayesha', [{ unit_price: 8, unit_cost: 5, quantity: 1 }]),
    ]
    const r = aggregateMonthlyReport(sales, shop, 2026, 4)
    // Per-day for the day with the null-cost sale → null
    expect(r.perDay[0].profit).toBeNull()
    // Per-teller — Ayesha has one null sale → null
    expect(r.perTeller[0].profit).toBeNull()
    // Totals — any null contaminates totals.total_profit
    expect(r.totals.total_profit).toBeNull()
    // Revenue still accurate regardless of cost data (20 + 8 = 28)
    expect(r.totals.total_revenue).toBe(28)
    expect(r.totals.total_sales).toBe(2)
  })

  it('null-teller sales bucket under "No teller recorded"', () => {
    const sales = [
      mkSale('s1', '2026-04-10T10:00:00+00:00', null, null, [{ unit_price: 10, unit_cost: 6, quantity: 1 }]),
      mkSale('s2', '2026-04-10T11:00:00+00:00', null, null, [{ unit_price: 5, unit_cost: 3, quantity: 1 }]),
      mkSale('s3', '2026-04-10T12:00:00+00:00', 't1', 'Ayesha', [{ unit_price: 8, unit_cost: 5, quantity: 1 }]),
    ]
    const r = aggregateMonthlyReport(sales, shop, 2026, 4)
    expect(r.perTeller).toHaveLength(2)
    const noTeller = r.perTeller.find((t) => t.teller_id === null)
    expect(noTeller).toBeDefined()
    expect(noTeller?.teller_name).toBe('No teller recorded')
    expect(noTeller?.sale_count).toBe(2)
    expect(noTeller?.revenue).toBe(15)
    expect(noTeller?.profit).toBe(6)
  })

  it('hides profit when profit tracking is off on the shop', () => {
    const shopOff = { ...shop, profit_tracking_enabled: false }
    const sales = [mkSale('s1', '2026-04-01T08:00:00+00:00', 't1', 'Ayesha', [{ unit_price: 10, unit_cost: 6, quantity: 1 }])]
    const r = aggregateMonthlyReport(sales, shopOff, 2026, 4)
    expect(r.totals.total_profit).toBeNull()
    expect(r.perDay[0].profit).toBeNull()
    expect(r.perTeller[0].profit).toBeNull()
    // Revenue + counts still populated
    expect(r.totals.total_revenue).toBe(10)
    expect(r.totals.total_sales).toBe(1)
  })
})
