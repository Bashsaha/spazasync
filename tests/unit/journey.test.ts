import { describe, it, expect } from 'vitest'
import {
  generateJourneySteps,
  getJourneyProgress,
  areDependenciesMet,
  resolveStepStatusForAction,
  JOURNEY_STEP_ORDER,
} from '@/lib/compliance/journey'
import { generateGoodsDescription } from '@/lib/compliance/goods-description'
import {
  journeyStepActionSchema,
  tellerTrainingSchema,
  DOCUMENT_STATUSES,
} from '@/lib/validation/schemas'
import type {
  BusinessDocument,
  DocumentStatus,
  DocumentType,
  OwnerProfile,
} from '@/types'

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeOwner(over: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    user_id: 'user-1',
    nationality_type: 'sa_citizen',
    food_safety_training_completed: false,
    food_safety_training_date: null,
    food_safety_training_provider: null,
    has_disability: false,
    visa_type: null,
    visa_expiry_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }
}

function makeDoc(type: DocumentType, status: DocumentStatus): BusinessDocument {
  return {
    id: `doc-${type}`,
    shop_id: 'shop-1',
    document_type: type,
    status,
    reference_number: null,
    date_issued: null,
    expiry_date: null,
    notes: null,
    applied_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

const SHOP_BASE = { has_employees: false, fund_interest: false }

// ── generateJourneySteps — visibility ────────────────────────────────────────

describe('generateJourneySteps — step visibility', () => {
  it('SA citizen, employees, fund_interest → all 7 steps', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'sa_citizen' }),
      { has_employees: true, fund_interest: true },
      [],
    )
    expect(steps.map((s) => s.key)).toEqual([
      'municipal_registration',
      'coa',
      'cipc',
      'sars_tax',
      'uif',
      'food_safety_training',
      'smmesa',
    ])
    expect(steps.length).toBe(7)
  })

  it('Foreign national, no employees → 5 steps (no UIF, no SMMESA)', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'foreign_national' }),
      { has_employees: false, fund_interest: true }, // fund_interest forced false server-side normally
      [],
    )
    expect(steps.map((s) => s.key)).toEqual([
      'municipal_registration',
      'coa',
      'cipc',
      'sars_tax',
      'food_safety_training',
    ])
  })

  it('SA citizen without fund_interest → 6 steps (no SMMESA)', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'sa_citizen' }),
      { has_employees: true, fund_interest: false },
      [],
    )
    expect(steps.find((s) => s.key === 'smmesa')).toBeUndefined()
    expect(steps.find((s) => s.key === 'uif')).toBeDefined()
    expect(steps.length).toBe(6)
  })

  it('SA citizen, has_employees=false → no UIF', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'sa_citizen' }),
      { has_employees: false, fund_interest: true },
      [],
    )
    expect(steps.find((s) => s.key === 'uif')).toBeUndefined()
    expect(steps.find((s) => s.key === 'smmesa')).toBeDefined()
  })

  it('null owner profile → assumes SA-citizen visibility (still no SMMESA without fund_interest)', () => {
    const steps = generateJourneySteps(null, SHOP_BASE, [])
    expect(steps.find((s) => s.key === 'smmesa')).toBeUndefined()
  })

  // Phase 37f — defence-in-depth regression: even if a misbehaving call site
  // sets fund_interest=true on a foreign-national shop, SMMESA must stay
  // hidden because that step (and the underlying fund) is SA-only.
  it('Foreign national + fund_interest=true → SMMESA still hidden (37f regression guard)', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'foreign_national' }),
      { has_employees: true, fund_interest: true },
      [],
    )
    expect(steps.find((s) => s.key === 'smmesa')).toBeUndefined()
  })

  it('Foreign national, has_employees=true → 6 steps (UIF in, SMMESA out)', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'foreign_national' }),
      { has_employees: true, fund_interest: false },
      [],
    )
    expect(steps.length).toBe(6)
    expect(steps.find((s) => s.key === 'smmesa')).toBeUndefined()
    expect(steps.find((s) => s.key === 'uif')).toBeDefined()
  })

  it('stepNumber is 1-based and matches array index', () => {
    const steps = generateJourneySteps(
      makeOwner(),
      { has_employees: true, fund_interest: true },
      [],
    )
    steps.forEach((s, i) => expect(s.stepNumber).toBe(i + 1))
  })
})

// ── generateJourneySteps — status resolution ─────────────────────────────────

describe('generateJourneySteps — status from documents', () => {
  it('no document → not_started (when no deps blocking)', () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [])
    const cipc = steps.find((s) => s.key === 'cipc')!
    expect(cipc.status).toBe('not_started')
  })

  it("doc.status='valid' → complete", () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('cipc', 'valid'),
    ])
    expect(steps.find((s) => s.key === 'cipc')!.status).toBe('complete')
  })

  it("doc.status='on_file' → complete", () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('cipc', 'on_file'),
    ])
    expect(steps.find((s) => s.key === 'cipc')!.status).toBe('complete')
  })

  it("doc.status='in_progress' → in_progress", () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('cipc', 'in_progress'),
    ])
    expect(steps.find((s) => s.key === 'cipc')!.status).toBe('in_progress')
  })

  it("doc.status='pending' → in_progress (treated like applied-but-waiting)", () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('cipc', 'pending'),
    ])
    expect(steps.find((s) => s.key === 'cipc')!.status).toBe('in_progress')
  })

  it("doc.status='not_registered' → not_started", () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('cipc', 'not_registered'),
    ])
    expect(steps.find((s) => s.key === 'cipc')!.status).toBe('not_started')
  })

  it('food_safety_training pulls from owner_profile, not business_documents', () => {
    const steps = generateJourneySteps(
      makeOwner({ food_safety_training_completed: true }),
      SHOP_BASE,
      [],
    )
    const food = steps.find((s) => s.key === 'food_safety_training')!
    expect(food.status).toBe('complete')
  })
})

// ── Dependency locking ──────────────────────────────────────────────────────

describe('generateJourneySteps — dependency locking', () => {
  it('Trading Permit locked until CIPC + SARS + food-safety done', () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [])
    const permit = steps.find((s) => s.key === 'municipal_registration')!
    expect(permit.status).toBe('locked')
    expect(permit.blockedBy).toContain('cipc')
    expect(permit.blockedBy).toContain('sars_tax')
    expect(permit.blockedBy).toContain('food_safety_training')
  })

  it('Trading Permit unlocks once CIPC + SARS + food-safety are complete', () => {
    const steps = generateJourneySteps(
      makeOwner({ food_safety_training_completed: true }),
      SHOP_BASE,
      [makeDoc('cipc', 'valid'), makeDoc('sars_tax', 'valid')],
    )
    const permit = steps.find((s) => s.key === 'municipal_registration')!
    expect(permit.status).toBe('not_started')
    expect(permit.blockedBy).toEqual([])
  })

  it('CoA locked until food-safety training done', () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [])
    const coa = steps.find((s) => s.key === 'coa')!
    expect(coa.status).toBe('locked')
    expect(coa.blockedBy).toEqual(['food_safety_training'])
  })

  it('SMMESA locked until CIPC done', () => {
    const steps = generateJourneySteps(
      makeOwner({ nationality_type: 'sa_citizen' }),
      { has_employees: false, fund_interest: true },
      [],
    )
    const smmesa = steps.find((s) => s.key === 'smmesa')!
    expect(smmesa.status).toBe('locked')
    expect(smmesa.blockedBy).toEqual(['cipc'])
  })

  it('CIPC, SARS, UIF, food_safety have no dependencies', () => {
    const steps = generateJourneySteps(
      makeOwner(),
      { has_employees: true, fund_interest: false },
      [],
    )
    for (const key of ['cipc', 'sars_tax', 'uif', 'food_safety_training'] as const) {
      const step = steps.find((s) => s.key === key)!
      expect(step.dependencies).toEqual([])
      expect(step.status).not.toBe('locked')
    }
  })

  it('does not re-lock a step that is already complete', () => {
    // If owner somehow completed the trading permit before its deps (e.g. via
    // direct /documents page), we should keep it 'complete' rather than
    // erasing progress with a 'locked' state.
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('municipal_registration', 'valid'),
    ])
    const permit = steps.find((s) => s.key === 'municipal_registration')!
    expect(permit.status).toBe('complete')
  })

  it('does not re-lock a step that is already in_progress', () => {
    const steps = generateJourneySteps(makeOwner(), SHOP_BASE, [
      makeDoc('coa', 'in_progress'),
    ])
    const coa = steps.find((s) => s.key === 'coa')!
    expect(coa.status).toBe('in_progress')
  })
})

// ── areDependenciesMet ──────────────────────────────────────────────────────

describe('areDependenciesMet', () => {
  it('returns true when dependencies array is empty', () => {
    expect(
      areDependenciesMet({ dependencies: [] }, makeOwner(), []),
    ).toBe(true)
  })

  it('returns false when any dep is missing/incomplete', () => {
    expect(
      areDependenciesMet(
        { dependencies: ['cipc', 'sars_tax'] },
        makeOwner(),
        [makeDoc('cipc', 'valid')],
      ),
    ).toBe(false)
  })

  it('returns true when all deps are complete', () => {
    expect(
      areDependenciesMet(
        { dependencies: ['cipc', 'sars_tax'] },
        makeOwner(),
        [makeDoc('cipc', 'valid'), makeDoc('sars_tax', 'on_file')],
      ),
    ).toBe(true)
  })

  it('treats food_safety from owner_profile as a complete dep', () => {
    expect(
      areDependenciesMet(
        { dependencies: ['food_safety_training'] },
        makeOwner({ food_safety_training_completed: true }),
        [],
      ),
    ).toBe(true)
  })
})

// ── getJourneyProgress ──────────────────────────────────────────────────────

describe('getJourneyProgress', () => {
  it('counts complete steps and returns first non-complete as currentStep', () => {
    const steps = generateJourneySteps(
      makeOwner({ food_safety_training_completed: true }),
      SHOP_BASE,
      [makeDoc('cipc', 'valid'), makeDoc('sars_tax', 'valid')],
    )
    const progress = getJourneyProgress(steps)
    expect(progress.completed).toBe(3) // cipc + sars_tax + food_safety
    expect(progress.total).toBe(steps.length)
    expect(progress.currentStep?.status).not.toBe('complete')
  })

  it('returns currentStep=null when everything is complete', () => {
    const steps = generateJourneySteps(
      makeOwner({ food_safety_training_completed: true }),
      SHOP_BASE,
      [
        makeDoc('cipc', 'valid'),
        makeDoc('sars_tax', 'valid'),
        makeDoc('coa', 'valid'),
        makeDoc('municipal_registration', 'valid'),
      ],
    )
    const progress = getJourneyProgress(steps)
    expect(progress.completed).toBe(progress.total)
    expect(progress.currentStep).toBeNull()
  })
})

// ── resolveStepStatusForAction ──────────────────────────────────────────────

describe('resolveStepStatusForAction', () => {
  it("mark_applied → in_progress + sets applied_at", () => {
    const r = resolveStepStatusForAction('mark_applied')
    expect(r.status).toBe('in_progress')
    expect(r.setAppliedAt).toBe(true)
    expect(r.clearAppliedAt).toBe(false)
  })

  it("mark_received → valid", () => {
    expect(resolveStepStatusForAction('mark_received').status).toBe('valid')
  })

  it("mark_done → valid", () => {
    expect(resolveStepStatusForAction('mark_done').status).toBe('valid')
  })

  it("reset → not_registered + clears applied_at", () => {
    const r = resolveStepStatusForAction('reset')
    expect(r.status).toBe('not_registered')
    expect(r.clearAppliedAt).toBe(true)
  })
})

// ── Schema constants ────────────────────────────────────────────────────────

describe('schema enums (Phase 37c)', () => {
  it("DOCUMENT_STATUSES includes 'in_progress'", () => {
    expect(DOCUMENT_STATUSES).toContain('in_progress')
  })

  it('JOURNEY_STEP_ORDER has all 7 keys in dependency order', () => {
    expect(JOURNEY_STEP_ORDER.length).toBe(7)
    expect(JOURNEY_STEP_ORDER[0]).toBe('municipal_registration')
  })
})

// ── journeyStepActionSchema ─────────────────────────────────────────────────

describe('journeyStepActionSchema', () => {
  it('accepts mark_done with no extras', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'cipc',
      action: 'mark_done',
    })
    expect(r.success).toBe(true)
  })

  it('accepts mark_applied with reference_number', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'municipal_registration',
      action: 'mark_applied',
      reference_number: 'APP-001',
    })
    expect(r.success).toBe(true)
  })

  it('rejects mark_received without reference_number', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'cipc',
      action: 'mark_received',
    })
    expect(r.success).toBe(false)
  })

  it('accepts mark_received with reference_number', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'cipc',
      action: 'mark_received',
      reference_number: '2026/123456/07',
      date_issued: '2026-05-01',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown action', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'cipc',
      action: 'mark_orange',
    })
    expect(r.success).toBe(false)
  })

  it('rejects unknown document_type', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'fake_doc',
      action: 'mark_done',
    })
    expect(r.success).toBe(false)
  })

  it('rejects bad date format', () => {
    const r = journeyStepActionSchema.safeParse({
      document_type: 'cipc',
      action: 'mark_received',
      reference_number: 'X',
      date_issued: '01/05/2026',
    })
    expect(r.success).toBe(false)
  })
})

// ── tellerTrainingSchema ────────────────────────────────────────────────────

describe('tellerTrainingSchema', () => {
  it('accepts { trained: true }', () => {
    expect(tellerTrainingSchema.safeParse({ trained: true }).success).toBe(true)
  })

  it('accepts { trained: false }', () => {
    expect(tellerTrainingSchema.safeParse({ trained: false }).success).toBe(true)
  })

  it('accepts a trained_at ISO timestamp', () => {
    expect(
      tellerTrainingSchema.safeParse({
        trained: true,
        trained_at: '2026-05-03T10:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects malformed trained_at', () => {
    expect(
      tellerTrainingSchema.safeParse({
        trained: true,
        trained_at: '2026-05-03',
      }).success,
    ).toBe(false)
  })

  it('rejects missing `trained`', () => {
    expect(tellerTrainingSchema.safeParse({}).success).toBe(false)
  })
})

// ── generateGoodsDescription ────────────────────────────────────────────────

describe('generateGoodsDescription', () => {
  it('empty list → fallback string', () => {
    const out = generateGoodsDescription([])
    expect(out.length).toBeGreaterThan(0)
    expect(out.toLowerCase()).toContain('groceries')
  })

  it('three cold-drink products → "Cold drinks"', () => {
    expect(generateGoodsDescription(['Coke 330ml', 'Fanta Orange', 'Sprite 500ml'])).toBe(
      'Cold drinks',
    )
  })

  it('mix of bread + snacks → joins with " and "', () => {
    const out = generateGoodsDescription(['White bread loaf', 'Simba chips'])
    expect(out).toContain('Bread and dairy')
    expect(out).toContain('Snacks')
    expect(out).toContain(' and ')
  })

  it('three or more buckets → comma-separated with "and" before last', () => {
    const out = generateGoodsDescription([
      'White bread',
      'Simba chips',
      'Coke 330ml',
      'Sunlight soap',
    ])
    expect(out.split(', ').length).toBeGreaterThanOrEqual(2)
    expect(out).toMatch(/, and /)
  })

  it('unrecognised products → fallback', () => {
    const out = generateGoodsDescription(['xxxx', 'yyyy'])
    expect(out.toLowerCase()).toContain('groceries')
  })

  it('case-insensitive matching', () => {
    expect(generateGoodsDescription(['COCA-COLA'])).toBe('Cold drinks')
  })
})
