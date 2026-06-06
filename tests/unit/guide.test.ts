import { describe, it, expect } from 'vitest'
import { selectTip, canAutoShow, type SelectInput } from '@/lib/guide/select-tip'
import { isTriggerActive } from '@/lib/guide/triggers'
import { COOLDOWN_MS, type GuideSignals } from '@/lib/guide/types'

const NOW = 1_700_000_000_000

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
    dismissedAll: false,
    lastShownAt: 0,
    sessionNudged: false,
    now: NOW,
    signals: noSignals,
    ...over,
  }
}

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

// ── selectTip ───────────────────────────────────────────────────────────────

describe('selectTip', () => {
  it('teaches the money-making core first (start-sale)', () => {
    expect(selectTip(input())?.id).toBe('start-sale')
  })

  it('advances to the next curriculum tip once one is acknowledged', () => {
    expect(selectTip(input({ seen: ['start-sale'] }))?.id).toBe('today-summary')
  })

  it('skips a routed tip when restricted to another screen', () => {
    // today-summary lives on /dashboard; on /sales only ambient tips qualify.
    const tip = selectTip(input({ pathname: '/sales', seen: ['start-sale'] }), true)
    expect(tip?.id).not.toBe('today-summary')
    expect(tip?.route === undefined || tip?.route === '/sales').toBe(true)
  })

  it('lets an active contextual tip jump the queue', () => {
    const tip = selectTip(
      input({ pathname: '/inventory', signals: { ...noSignals, lowStockCount: 4 } }),
    )
    expect(tip?.id).toBe('low-stock')
  })

  it('keeps a contextual tip hidden while its trigger is inactive', () => {
    // Curriculum tips ahead of inventory-hub are already seen, so it's next in
    // line; the contextual low-stock tip must stay hidden (its trigger is off).
    const tip = selectTip(
      input({
        pathname: '/inventory',
        seen: ['start-sale', 'today-summary', 'sales-hub', 'manage-hub'],
        signals: noSignals,
      }),
    )
    expect(tip?.trigger).toBeUndefined()
    expect(tip?.id).toBe('inventory-hub')
  })

  it('returns null once every tip is seen', () => {
    const allIds = [
      'start-sale', 'today-summary', 'inventory-hub', 'sales-hub', 'manage-hub',
      'low-stock', 'expiring-soon', 'missing-cost', 'no-sale-today',
    ]
    expect(selectTip(input({ seen: allIds, signals: noSignals }))).toBeNull()
  })
})

// ── canAutoShow (cadence gate) ───────────────────────────────────────────────

describe('canAutoShow', () => {
  it('allows a calm first nudge on a home screen', () => {
    expect(canAutoShow(input())).toBe(true)
  })

  it('blocks when tips are turned off', () => {
    expect(canAutoShow(input({ dismissedAll: true }))).toBe(false)
  })

  it('blocks a second nudge in the same session', () => {
    expect(canAutoShow(input({ sessionNudged: true }))).toBe(false)
  })

  it('blocks off the home screens', () => {
    expect(canAutoShow(input({ pathname: '/stock' }))).toBe(false)
  })

  it('respects the 48h cooldown', () => {
    expect(canAutoShow(input({ lastShownAt: NOW - COOLDOWN_MS + 1000 }))).toBe(false)
    expect(canAutoShow(input({ lastShownAt: NOW - COOLDOWN_MS - 1000 }))).toBe(true)
  })

  it('blocks when there is nothing left to teach', () => {
    const allIds = [
      'start-sale', 'today-summary', 'inventory-hub', 'sales-hub', 'manage-hub',
      'low-stock', 'expiring-soon', 'missing-cost', 'no-sale-today',
    ]
    expect(canAutoShow(input({ seen: allIds }))).toBe(false)
  })
})
