import { describe, it, expect } from 'vitest'
import {
  listPageTips,
  groupPageTips,
  hasActiveTip,
  type SelectInput,
} from '@/lib/guide/select-tip'
import { isTriggerActive } from '@/lib/guide/triggers'
import { CATALOG } from '@/lib/guide/catalog'
import {
  GUIDE_ROUTES,
  GUIDE_GROUP_ORDER,
  matchGuideRoute,
  type GuideSignals,
} from '@/lib/guide/types'
import enGuide from '@/lib/i18n/translations/en/guide.json'

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

// ── matchGuideRoute ──────────────────────────────────────────────────────────

describe('matchGuideRoute', () => {
  it('maps each exact guide route to itself', () => {
    for (const r of GUIDE_ROUTES) {
      if (r.includes('[')) continue // dynamic keys aren't live paths
      expect(matchGuideRoute(r)).toBe(r)
    }
  })

  it('resolves a live stock-detail path to the /stock/[id] key', () => {
    expect(matchGuideRoute('/stock/abc123')).toBe('/stock/[id]')
    expect(matchGuideRoute('/stock/9f8e-uuid-1234')).toBe('/stock/[id]')
  })

  it('keeps the bare /stock list distinct from the detail key', () => {
    expect(matchGuideRoute('/stock')).toBe('/stock')
  })

  it('does not match deeper or unrelated paths', () => {
    expect(matchGuideRoute('/stock/abc/extra')).toBeNull()
    expect(matchGuideRoute('/settings')).toBeNull()
    expect(matchGuideRoute('/sale')).toBeNull()
  })
})

// ── listPageTips ────────────────────────────────────────────────────────────

describe('listPageTips', () => {
  it('lists the dashboard tips in curriculum order (no active trigger)', () => {
    expect(ids(listPageTips(input()))).toEqual([
      'start-sale',
      'today-summary',
      'dash-latest-sales',
      'dash-compliance',
      'dash-journey',
    ])
  })

  it('shows each guide route its own first route tip', () => {
    const first = (pathname: string) => ids(listPageTips(input({ pathname })))[0]
    expect(first('/stock')).toBe('stock-scan')
    expect(first('/products')).toBe('product-add')
    expect(first('/sales')).toBe('sales-start')
    expect(first('/manage')).toBe('manage-staff')
    expect(first('/inventory')).toBe('inventory-stock')
  })

  it('lists tips for a dynamic stock-detail path', () => {
    const tips = ids(listPageTips(input({ pathname: '/stock/abc123' })))
    expect(tips).toEqual(['sd-adjust', 'sd-quick', 'sd-batches'])
  })

  it('never returns an empty list on a guide route (route tip always present)', () => {
    for (const r of GUIDE_ROUTES) {
      const path = r.includes('[') ? '/stock/some-id' : r
      expect(listPageTips(input({ pathname: path })).length).toBeGreaterThan(0)
    }
  })

  it('floats an active contextual tip to the top', () => {
    const tips = listPageTips(
      input({ pathname: '/stock', signals: { ...noSignals, lowStockCount: 4 } }),
    )
    expect(tips[0].tip.id).toBe('low-stock')
    expect(tips[0].active).toBe(true)
    expect(ids(tips)).toContain('stock-scan')
  })

  it('keeps a contextual tip hidden while its trigger is inactive', () => {
    const tips = listPageTips(input({ pathname: '/stock', signals: noSignals }))
    expect(ids(tips)).not.toContain('low-stock')
  })

  it('sorts a seen tip last and flags it', () => {
    const tips = listPageTips(input({ pathname: '/dashboard', seen: ['start-sale'] }))
    // start-sale (seen) sinks below every unseen dashboard tip
    expect(ids(tips)[ids(tips).length - 1]).toBe('start-sale')
    expect(tips.find((p) => p.tip.id === 'start-sale')?.seen).toBe(true)
  })

  it('surfaces ambient contextual tips on any guide route', () => {
    const onProducts = listPageTips(
      input({ pathname: '/products', signals: { ...noSignals, expiringCount: 2 } }),
    )
    expect(ids(onProducts)).toContain('expiring-soon')
  })
})

// ── groupPageTips (the sheet sections) ───────────────────────────────────────

describe('groupPageTips', () => {
  it('returns sections in fixed group order, omitting empty ones', () => {
    const sections = groupPageTips(input({ pathname: '/dashboard' }))
    const groups = sections.map((s) => s.group)
    // dashboard has basics + reports + setup, no active attention
    expect(groups).toEqual(['basics', 'reports', 'setup'])
    // order is a subsequence of the canonical order
    const idx = groups.map((g) => GUIDE_GROUP_ORDER.indexOf(g))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('pins an active contextual tip into a leading "attention" section', () => {
    const sections = groupPageTips(
      input({ pathname: '/stock', signals: { ...noSignals, lowStockCount: 3 } }),
    )
    expect(sections[0].group).toBe('attention')
    expect(sections[0].tips.map((p) => p.tip.id)).toContain('low-stock')
  })

  it('places every listed tip in exactly one section', () => {
    const inp = input({ pathname: '/sales' })
    const flat = listPageTips(inp).length
    const grouped = groupPageTips(inp).reduce((n, s) => n + s.tips.length, 0)
    expect(grouped).toBe(flat)
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

// ── catalog integrity ────────────────────────────────────────────────────────

describe('CATALOG integrity', () => {
  const en = enGuide as Record<string, string>

  it('has unique tip ids', () => {
    const seen = new Set<string>()
    for (const tip of CATALOG) {
      expect(seen.has(tip.id), `duplicate id ${tip.id}`).toBe(false)
      seen.add(tip.id)
    }
  })

  it('routes every routed tip to a real guide-route key', () => {
    for (const tip of CATALOG) {
      if (tip.route) expect(GUIDE_ROUTES).toContain(tip.route)
    }
  })

  it('gives every routed tip a group; every contextual tip a trigger', () => {
    for (const tip of CATALOG) {
      if (tip.route) expect(tip.group, `${tip.id} needs a group`).toBeTruthy()
      else expect(tip.trigger, `${tip.id} (ambient) needs a trigger`).toBeTruthy()
    }
  })

  it('has an English title + body for every tip', () => {
    for (const tip of CATALOG) {
      expect(en[tip.titleKey], `missing ${tip.titleKey}`).toBeTruthy()
      expect(en[tip.bodyKey], `missing ${tip.bodyKey}`).toBeTruthy()
    }
  })
})
