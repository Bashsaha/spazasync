import { describe, it, expect } from 'vitest'
import { listPageTips, hasActiveTip, type SelectInput } from '@/lib/guide/select-tip'
import { isTriggerActive } from '@/lib/guide/triggers'
import type { GuideSignals } from '@/lib/guide/types'

const noSignals: GuideSignals = {
  salesTodayCount: 3,
  lowStockCount: 0,
  expiringCount: 0,
  productsMissingCost: 0,
  hourOfDay: 10,
}

function input(over: Partial<SelectInput> = {}): SelectInput {
  return {
    pathname: '/dashboard',
    seen: [],
    signals: noSignals,
    ...over,
  }
}

const ids = (tips: ReturnType<typeof listPageTips>) => tips.map((p) => p.tip.id)

// ── triggers ──────────────────────────────────────────────────────────────

describe('isTriggerActive', () => {
  it('is false for an undefined trigger', () => {
    expect(isTriggerActive(undefined, noSignals)).toBe(false)
  })

  it('is false when signals are unavailable (offline)', () => {
    expect(isTriggerActive('low_stock', null)).toBe(false)
  })

  it('fires low_stock only when something is low', () => {
    expect(isTriggerActive('low_stock', { ...noSignals, lowStockCount: 2 })).toBe(true)
    expect(isTriggerActive('low_stock', { ...noSignals, lowStockCount: 0 })).toBe(false)
  })

  it('fires no_sale_today only late in the day with zero sales', () => {
    expect(isTriggerActive('no_sale_today', { ...noSignals, salesTodayCount: 0, hourOfDay: 18 })).toBe(true)
    expect(isTriggerActive('no_sale_today', { ...noSignals, salesTodayCount: 0, hourOfDay: 9 })).toBe(false)
    expect(isTriggerActive('no_sale_today', { ...noSignals, salesTodayCount: 5, hourOfDay: 18 })).toBe(false)
  })
})

// ── listPageTips ────────────────────────────────────────────────────────────

describe('listPageTips', () => {
  it('lists a route tip + ambient FAB tip on the dashboard, in curriculum order', () => {
    // /dashboard has start-sale (order 10) and today-summary (order 20); the
    // contextual no-sale-today tip is ambient but its trigger is off here.
    expect(ids(listPageTips(input()))).toEqual(['start-sale', 'today-summary'])
  })

  it('shows each guide route its own route tip', () => {
    expect(ids(listPageTips(input({ pathname: '/stock' })))).toEqual(['stock-scan'])
    expect(ids(listPageTips(input({ pathname: '/products' })))).toEqual(['product-add'])
    expect(ids(listPageTips(input({ pathname: '/sales' })))).toEqual(['sales-history'])
    expect(ids(listPageTips(input({ pathname: '/manage' })))).toEqual(['manage-journey'])
    expect(ids(listPageTips(input({ pathname: '/inventory' })))).toEqual(['inventory-stock'])
  })

  it('never returns an empty list on a guide route (route tip always present)', () => {
    expect(listPageTips(input({ pathname: '/inventory' })).length).toBeGreaterThan(0)
  })

  it('floats an active contextual tip to the top', () => {
    const tips = listPageTips(
      input({ pathname: '/stock', signals: { ...noSignals, lowStockCount: 4 } }),
    )
    expect(tips[0].tip.id).toBe('low-stock')
    expect(tips[0].active).toBe(true)
    // the page's own route tip is still listed, after the contextual one
    expect(ids(tips)).toContain('stock-scan')
  })

  it('keeps a contextual tip hidden while its trigger is inactive', () => {
    const tips = listPageTips(input({ pathname: '/stock', signals: noSignals }))
    expect(ids(tips)).not.toContain('low-stock')
  })

  it('sorts a seen tip last and flags it', () => {
    const tips = listPageTips(
      input({ pathname: '/dashboard', seen: ['start-sale'] }),
    )
    // today-summary (unseen) before start-sale (seen)
    expect(ids(tips)).toEqual(['today-summary', 'start-sale'])
    expect(tips.find((p) => p.tip.id === 'start-sale')?.seen).toBe(true)
  })

  it('surfaces ambient contextual tips on any guide route', () => {
    const onProducts = listPageTips(
      input({ pathname: '/products', signals: { ...noSignals, expiringCount: 2 } }),
    )
    expect(ids(onProducts)).toContain('expiring-soon')
  })
})

// ── hasActiveTip (the dot) ───────────────────────────────────────────────────

describe('hasActiveTip', () => {
  it('is false with no contextual condition', () => {
    expect(hasActiveTip(input({ pathname: '/dashboard' }))).toBe(false)
  })

  it('is true when something is low', () => {
    expect(
      hasActiveTip(input({ pathname: '/dashboard', signals: { ...noSignals, lowStockCount: 1 } })),
    ).toBe(true)
  })

  it('is false when signals are unavailable (offline)', () => {
    expect(hasActiveTip(input({ pathname: '/dashboard', signals: null }))).toBe(false)
  })
})
