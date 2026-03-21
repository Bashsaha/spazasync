import { describe, it, expect } from 'vitest'
import { formatDailySummary } from '@/lib/whatsapp/format'
import type { DailySummaryData, LowStockItem, ExpiringProductAlert } from '@/types'

const FIXED_DATE = new Date('2026-03-12T20:00:00Z') // 22:00 SAST

const noSales: DailySummaryData = {
  salesCount: 0,
  totalRevenue: 0,
  topItems: [],
  tellerCount: 0,
}

const withSales: DailySummaryData = {
  salesCount: 23,
  totalRevenue: 1245.5,
  topItems: [
    { name: 'Coca Cola 330ml', totalQty: 48 },
    { name: 'Simba Chips', totalQty: 36 },
    { name: 'Bread', totalQty: 24 },
  ],
  tellerCount: 2,
}

const noLowStock: LowStockItem[] = []
const withLowStock: LowStockItem[] = [
  { name: 'Milk', stock_qty: 2 },
  { name: 'Eggs', stock_qty: 0 },
]

const noExpiring: ExpiringProductAlert[] = []

describe('formatDailySummary', () => {
  it('includes shop name and date', () => {
    const msg = formatDailySummary('Cape Town Store', noSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('Cape Town Store')
    expect(msg).toContain('2026')
  })

  it('shows "No sales" when salesCount is 0', () => {
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('No sales recorded today')
  })

  it('shows revenue and sale count when sales exist', () => {
    const msg = formatDailySummary('Test Shop', withSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('1 245.50')
    expect(msg).toContain('23 transactions')
    expect(msg).toContain('Tellers active: 2')
  })

  it('lists top items', () => {
    const msg = formatDailySummary('Test Shop', withSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('Coca Cola 330ml')
    expect(msg).toContain('48 units')
    expect(msg).toContain('Simba Chips')
  })

  it('omits low stock section when none', () => {
    const msg = formatDailySummary('Test Shop', withSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).not.toContain('Low stock')
    expect(msg).not.toContain('⚠️')
  })

  it('shows low stock section when items are low', () => {
    const msg = formatDailySummary('Test Shop', withSales, withLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('⚠️ Low stock')
    expect(msg).toContain('Milk')
    expect(msg).toContain('2 left')
  })

  it('marks out-of-stock items distinctly', () => {
    const msg = formatDailySummary('Test Shop', withSales, withLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('Eggs')
    expect(msg).toContain('OUT OF STOCK')
  })

  it('shows low stock even with no sales', () => {
    const msg = formatDailySummary('Test Shop', noSales, withLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('No sales recorded today')
    expect(msg).toContain('⚠️ Low stock')
  })

  it('includes "Powered by SpazaSync" footer', () => {
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).toContain('Powered by SpazaSync')
  })

  // --- Expiry alert tests ---

  it('omits expiry section when no expiring products', () => {
    const msg = formatDailySummary('Test Shop', withSales, noLowStock, noExpiring, FIXED_DATE)
    expect(msg).not.toContain('⏰')
    expect(msg).not.toContain('Expiry alert')
  })

  it('shows expired-only items', () => {
    const expiring: ExpiringProductAlert[] = [
      { name: 'Yoghurt', expired_qty: 5, expiring_soon_qty: 0, earliest_expiry: '2026-03-10' },
    ]
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, expiring, FIXED_DATE)
    expect(msg).toContain('⏰ Expiry alert (1 item):')
    expect(msg).toContain('Yoghurt')
    expect(msg).toContain('5 expired')
    expect(msg).not.toContain('expiring')
  })

  it('shows expiring-soon-only items with date', () => {
    const expiring: ExpiringProductAlert[] = [
      { name: 'Fresh Milk', expired_qty: 0, expiring_soon_qty: 8, earliest_expiry: '2026-03-15' },
    ]
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, expiring, FIXED_DATE)
    expect(msg).toContain('⏰ Expiry alert (1 item):')
    expect(msg).toContain('Fresh Milk')
    expect(msg).toContain('8 expiring (earliest: 15 Mar)')
    expect(msg).not.toContain('expired')
  })

  it('shows both expired and expiring-soon for same item', () => {
    const expiring: ExpiringProductAlert[] = [
      { name: 'Bread', expired_qty: 3, expiring_soon_qty: 12, earliest_expiry: '2026-03-11' },
    ]
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, expiring, FIXED_DATE)
    expect(msg).toContain('3 expired')
    expect(msg).toContain('12 expiring (earliest: 11 Mar)')
  })

  it('lists multiple expiring items with plural heading', () => {
    const expiring: ExpiringProductAlert[] = [
      { name: 'Yoghurt', expired_qty: 2, expiring_soon_qty: 0, earliest_expiry: '2026-03-09' },
      { name: 'Cheese', expired_qty: 0, expiring_soon_qty: 4, earliest_expiry: '2026-03-18' },
      { name: 'Milk', expired_qty: 1, expiring_soon_qty: 6, earliest_expiry: '2026-03-10' },
    ]
    const msg = formatDailySummary('Test Shop', noSales, noLowStock, expiring, FIXED_DATE)
    expect(msg).toContain('⏰ Expiry alert (3 items):')
    expect(msg).toContain('Yoghurt')
    expect(msg).toContain('Cheese')
    expect(msg).toContain('Milk')
  })
})
