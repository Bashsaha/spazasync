import { describe, it, expect } from 'vitest'
import { createProductSchema, updateProductSchema, updateShopSettingsSchema } from '@/lib/validation/schemas'

// Mirrors the reducer used inside getDailySalesForShop in src/lib/db/reports.ts.
// Kept here as a pure function so the profit arithmetic can be tested without
// a Supabase mock — if the formula changes in one place it must change here too.
type SaleItem = {
  quantity: number
  unit_price: number | string
  unit_cost: number | string | null
}

function computeProfit(items: SaleItem[]): { totalProfit: number; hasProfitData: boolean } {
  let totalProfit = 0
  let hasProfitData = false
  for (const item of items) {
    if (item.unit_cost === null || item.unit_cost === undefined) continue
    hasProfitData = true
    totalProfit += (Number(item.unit_price) - Number(item.unit_cost)) * item.quantity
  }
  return { totalProfit: Math.round(totalProfit * 100) / 100, hasProfitData }
}

describe('computeProfit()', () => {
  it('returns zero profit and no data when there are no items', () => {
    expect(computeProfit([])).toEqual({ totalProfit: 0, hasProfitData: false })
  })

  it('returns zero profit and no data when no item has a cost', () => {
    const items: SaleItem[] = [
      { quantity: 1, unit_price: 10, unit_cost: null },
      { quantity: 2, unit_price: 5, unit_cost: null },
    ]
    expect(computeProfit(items)).toEqual({ totalProfit: 0, hasProfitData: false })
  })

  it('computes profit for a single item with a cost', () => {
    const items: SaleItem[] = [{ quantity: 3, unit_price: 10, unit_cost: 6 }]
    // (10 - 6) * 3 = 12
    expect(computeProfit(items)).toEqual({ totalProfit: 12, hasProfitData: true })
  })

  it('sums profit across multiple priced items', () => {
    const items: SaleItem[] = [
      { quantity: 2, unit_price: 10, unit_cost: 7 }, // 6
      { quantity: 5, unit_price: 4, unit_cost: 2.5 }, // 7.5
    ]
    expect(computeProfit(items)).toEqual({ totalProfit: 13.5, hasProfitData: true })
  })

  it('skips items with null unit_cost but includes priced ones', () => {
    const items: SaleItem[] = [
      { quantity: 10, unit_price: 20, unit_cost: null }, // skipped
      { quantity: 1, unit_price: 50, unit_cost: 30 }, // 20
    ]
    expect(computeProfit(items)).toEqual({ totalProfit: 20, hasProfitData: true })
  })

  it('handles negative profit when cost exceeds price (selling at a loss)', () => {
    const items: SaleItem[] = [{ quantity: 2, unit_price: 5, unit_cost: 7 }]
    // (5 - 7) * 2 = -4
    expect(computeProfit(items)).toEqual({ totalProfit: -4, hasProfitData: true })
  })

  it('coerces string numerics from Supabase to numbers', () => {
    const items: SaleItem[] = [{ quantity: 2, unit_price: '9.99', unit_cost: '5.50' }]
    // (9.99 - 5.50) * 2 = 8.98
    expect(computeProfit(items)).toEqual({ totalProfit: 8.98, hasProfitData: true })
  })

  it('rounds totalProfit to 2 decimal places', () => {
    const items: SaleItem[] = [
      { quantity: 3, unit_price: 1.01, unit_cost: 0.33 }, // (0.68) * 3 = 2.04
      { quantity: 7, unit_price: 2.22, unit_cost: 1.11 }, // (1.11) * 7 = 7.77
    ]
    expect(computeProfit(items).totalProfit).toBeCloseTo(9.81, 2)
  })
})

// ---------------------------------------------------------------------------
// Schema extensions for cost_price + profit_tracking_enabled
// ---------------------------------------------------------------------------

describe('createProductSchema — cost_price', () => {
  it('accepts omitted cost_price (optional)', () => {
    const result = createProductSchema.safeParse({
      name: 'Test',
      price: 5,
      stock_qty: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts null cost_price', () => {
    const result = createProductSchema.safeParse({
      name: 'Test',
      price: 5,
      stock_qty: 0,
      cost_price: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts cost_price of zero (free goods are valid)', () => {
    const result = createProductSchema.safeParse({
      name: 'Test',
      price: 5,
      stock_qty: 0,
      cost_price: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a positive cost_price', () => {
    const result = createProductSchema.safeParse({
      name: 'Test',
      price: 10,
      stock_qty: 0,
      cost_price: 6.5,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.cost_price).toBe(6.5)
  })

  it('rejects a negative cost_price', () => {
    const result = createProductSchema.safeParse({
      name: 'Test',
      price: 10,
      stock_qty: 0,
      cost_price: -1,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Cost price cannot be negative')
  })
})

describe('updateProductSchema — cost_price', () => {
  it('accepts cost_price updates', () => {
    const result = updateProductSchema.safeParse({ cost_price: 7.25 })
    expect(result.success).toBe(true)
  })

  it('rejects negative cost_price on update', () => {
    const result = updateProductSchema.safeParse({ cost_price: -3 })
    expect(result.success).toBe(false)
  })
})

describe('updateShopSettingsSchema — profit_tracking_enabled', () => {
  const baseSettings = { name: 'Cape Corner', low_stock_threshold: 5 }

  it('accepts profit_tracking_enabled=true alongside required fields', () => {
    const result = updateShopSettingsSchema.safeParse({
      ...baseSettings,
      profit_tracking_enabled: true,
    })
    expect(result.success).toBe(true)
  })

  it('accepts profit_tracking_enabled=false alongside required fields', () => {
    const result = updateShopSettingsSchema.safeParse({
      ...baseSettings,
      profit_tracking_enabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('accepts omitted profit_tracking_enabled (optional field)', () => {
    const result = updateShopSettingsSchema.safeParse(baseSettings)
    expect(result.success).toBe(true)
  })

  it('rejects non-boolean profit_tracking_enabled', () => {
    const result = updateShopSettingsSchema.safeParse({
      ...baseSettings,
      profit_tracking_enabled: 'yes',
    })
    expect(result.success).toBe(false)
  })
})
