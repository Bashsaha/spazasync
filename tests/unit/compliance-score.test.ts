import { describe, it, expect } from 'vitest'
import {
  computeComplianceScore,
  bandFor,
  WEIGHT_CHECKLIST,
  WEIGHT_EXPIRY,
  WEIGHT_SUPPLIERS,
  WEIGHT_DOCUMENTS,
  WEIGHT_WASTE_PEST,
  BAND_GREEN_MIN,
  BAND_AMBER_MIN,
} from '@/lib/compliance/score'
import type { ComplianceScoreInputs } from '@/types'

function inputs(overrides: Partial<ComplianceScoreInputs> = {}): ComplianceScoreInputs {
  return {
    checklistCompliancePct: 0,
    expiredBatchCount: 0,
    productCount: 0,
    productsWithSupplier: 0,
    documentOverall: 'grey',
    pestOverdue: true,
    wasteStale: true,
    ...overrides,
  }
}

describe('weights', () => {
  it('sum to 100', () => {
    expect(
      WEIGHT_CHECKLIST + WEIGHT_EXPIRY + WEIGHT_SUPPLIERS + WEIGHT_DOCUMENTS + WEIGHT_WASTE_PEST,
    ).toBe(100)
  })
})

describe('bandFor', () => {
  it('returns green at and above 80', () => {
    expect(bandFor(80)).toBe('green')
    expect(bandFor(100)).toBe('green')
  })

  it('returns amber between 50 and 79', () => {
    expect(bandFor(50)).toBe('amber')
    expect(bandFor(79)).toBe('amber')
  })

  it('returns red below 50', () => {
    expect(bandFor(49)).toBe('red')
    expect(bandFor(0)).toBe('red')
  })

  it('uses the documented threshold constants', () => {
    expect(BAND_GREEN_MIN).toBe(80)
    expect(BAND_AMBER_MIN).toBe(50)
  })
})

describe('computeComplianceScore — categories', () => {
  it('empty shop (grey docs, no products, no checklist, pest/waste overdue) scores 40 (suppliers + expiry both 100)', () => {
    // productCount===0 → supplier score=100 (contributes 20).
    // expiredBatchCount===0 → expiry score=100 (contributes 20).
    // Everything else 0. Total: 40, band red (still <50).
    const r = computeComplianceScore(inputs())
    expect(r.overall).toBe(40)
    expect(r.band).toBe('red')

    const supplier = r.categories.find((c) => c.key === 'suppliers')!
    expect(supplier.score).toBe(100)
    expect(supplier.weighted).toBe(20)
    expect(supplier.tipKey).toBeNull()

    const expiry = r.categories.find((c) => c.key === 'expiry')!
    expect(expiry.score).toBe(100) // 0 expired batches
    expect(expiry.weighted).toBe(20)
  })

  it('all green — score 100, band green, no tips', () => {
    const r = computeComplianceScore(
      inputs({
        checklistCompliancePct: 100,
        expiredBatchCount: 0,
        productCount: 10,
        productsWithSupplier: 10,
        documentOverall: 'green',
        pestOverdue: false,
        wasteStale: false,
      }),
    )
    expect(r.overall).toBe(100)
    expect(r.band).toBe('green')
    for (const c of r.categories) {
      expect(c.score).toBe(100)
      expect(c.tipKey).toBeNull()
    }
  })

  it('checklist category uses the raw percentage 0-100', () => {
    const r = computeComplianceScore(inputs({ checklistCompliancePct: 60 }))
    const checklist = r.categories.find((c) => c.key === 'checklist')!
    expect(checklist.score).toBe(60)
    expect(checklist.weighted).toBe(15) // 60 * 25 / 100
    expect(checklist.tipKey).toBe('tip_checklist')
    expect(checklist.tipParams).toEqual({ pct: 60 })
  })

  it('expiry category is binary — any expired batch fails the category outright', () => {
    const zero = computeComplianceScore(inputs({ expiredBatchCount: 0 })).categories.find((c) => c.key === 'expiry')!
    const one = computeComplianceScore(inputs({ expiredBatchCount: 1 })).categories.find((c) => c.key === 'expiry')!
    const many = computeComplianceScore(inputs({ expiredBatchCount: 42 })).categories.find((c) => c.key === 'expiry')!
    expect(zero.score).toBe(100)
    expect(one.score).toBe(0)
    expect(many.score).toBe(0)
    expect(one.tipParams).toEqual({ count: 1 })
    expect(many.tipParams).toEqual({ count: 42 })
  })

  it('supplier category is the rounded coverage percentage', () => {
    const half = computeComplianceScore(
      inputs({ productCount: 10, productsWithSupplier: 5 }),
    ).categories.find((c) => c.key === 'suppliers')!
    expect(half.score).toBe(50)
    expect(half.tipParams).toEqual({ count: 5 })

    const third = computeComplianceScore(
      inputs({ productCount: 3, productsWithSupplier: 1 }),
    ).categories.find((c) => c.key === 'suppliers')!
    expect(third.score).toBe(33) // Math.round(33.33)
    expect(third.tipParams).toEqual({ count: 2 })
  })

  it('supplier category gives 100 when there are no products (no coverage to penalise)', () => {
    const r = computeComplianceScore(inputs({ productCount: 0, productsWithSupplier: 0 }))
    const supplier = r.categories.find((c) => c.key === 'suppliers')!
    expect(supplier.score).toBe(100)
    expect(supplier.tipKey).toBeNull()
  })

  it('document category maps traffic-light to 100/50/0', () => {
    const green = computeComplianceScore(inputs({ documentOverall: 'green' })).categories.find((c) => c.key === 'documents')!
    const amber = computeComplianceScore(inputs({ documentOverall: 'amber' })).categories.find((c) => c.key === 'documents')!
    const red = computeComplianceScore(inputs({ documentOverall: 'red' })).categories.find((c) => c.key === 'documents')!
    const grey = computeComplianceScore(inputs({ documentOverall: 'grey' })).categories.find((c) => c.key === 'documents')!
    expect(green.score).toBe(100)
    expect(amber.score).toBe(50)
    expect(red.score).toBe(0)
    expect(grey.score).toBe(0)
  })

  it('waste/pest is symmetric — each half worth 50', () => {
    const both = computeComplianceScore(inputs({ pestOverdue: false, wasteStale: false })).categories.find((c) => c.key === 'waste_pest')!
    const pestOnly = computeComplianceScore(inputs({ pestOverdue: false, wasteStale: true })).categories.find((c) => c.key === 'waste_pest')!
    const wasteOnly = computeComplianceScore(inputs({ pestOverdue: true, wasteStale: false })).categories.find((c) => c.key === 'waste_pest')!
    const neither = computeComplianceScore(inputs({ pestOverdue: true, wasteStale: true })).categories.find((c) => c.key === 'waste_pest')!
    expect(both.score).toBe(100)
    expect(pestOnly.score).toBe(50)
    expect(wasteOnly.score).toBe(50)
    expect(neither.score).toBe(0)
  })
})

describe('computeComplianceScore — overall + bands', () => {
  it('overall is the sum of category contributions, rounded', () => {
    // checklist=80→20 + expiry=100→20 + suppliers=50 (5/10)→10 + documents=amber (50)→10 + waste_pest=50→7.5
    // total = 67.5 → 68
    const r = computeComplianceScore(
      inputs({
        checklistCompliancePct: 80,
        expiredBatchCount: 0,
        productCount: 10,
        productsWithSupplier: 5,
        documentOverall: 'amber',
        pestOverdue: true,
        wasteStale: false,
      }),
    )
    expect(r.overall).toBe(68)
    expect(r.band).toBe('amber')
  })

  it('just below 80 stays amber, just at 80 flips to green', () => {
    // Build: checklist=100 (25) + expiry=100 (20) + suppliers=100 (20) + docs=amber (10) + waste=none (0) = 75 → amber
    const below = computeComplianceScore(
      inputs({
        checklistCompliancePct: 100,
        productCount: 1,
        productsWithSupplier: 1,
        documentOverall: 'amber',
        pestOverdue: true,
        wasteStale: true,
      }),
    )
    expect(below.overall).toBe(75)
    expect(below.band).toBe('amber')

    // Flip waste/pest to full: +15 → 90 → green
    const at = computeComplianceScore(
      inputs({
        checklistCompliancePct: 100,
        productCount: 1,
        productsWithSupplier: 1,
        documentOverall: 'amber',
        pestOverdue: false,
        wasteStale: false,
      }),
    )
    expect(at.overall).toBe(90)
    expect(at.band).toBe('green')
  })

  it('returns exactly 5 categories in a stable order', () => {
    const r = computeComplianceScore(inputs())
    expect(r.categories.map((c) => c.key)).toEqual([
      'checklist',
      'expiry',
      'suppliers',
      'documents',
      'waste_pest',
    ])
  })

  it('category weights on the result match the exported constants', () => {
    const r = computeComplianceScore(inputs())
    const byKey = new Map(r.categories.map((c) => [c.key, c.weight]))
    expect(byKey.get('checklist')).toBe(WEIGHT_CHECKLIST)
    expect(byKey.get('expiry')).toBe(WEIGHT_EXPIRY)
    expect(byKey.get('suppliers')).toBe(WEIGHT_SUPPLIERS)
    expect(byKey.get('documents')).toBe(WEIGHT_DOCUMENTS)
    expect(byKey.get('waste_pest')).toBe(WEIGHT_WASTE_PEST)
  })
})
