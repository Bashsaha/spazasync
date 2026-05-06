import { describe, it, expect } from 'vitest'
import {
  toggleStateToDocumentStatus,
  documentStatusToToggleState,
  buildJourneySteps,
  shouldShowComplianceBanner,
  shouldAutoOpenComplianceModal,
} from '@/lib/compliance/onboarding'
import {
  complianceOnboardingSchema,
  onboardingSchema,
  ownerProfileSchema,
  ONBOARDING_DOCUMENT_TYPES,
  DOCUMENT_TOGGLE_STATES,
} from '@/lib/validation/schemas'
import type { Shop } from '@/types'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

const SHOP_DEFAULTS: Shop = {
  id: 'shop-id',
  name: 'Test',
  code: 'TEST01',
  whatsapp_number: null,
  low_stock_threshold: 5,
  registration_number: null,
  location: null,
  subscription_status: 'trialing',
  trial_ends_at: null,
  subscription_ends_at: null,
  language: 'en',
  access_granted: false,
  admin_notes: null,
  profit_tracking_enabled: false,
  has_fridge: false,
  has_freezer: false,
  municipality_id: null,
  municipality_area_text: null,
  has_employees: false,
  fund_interest: false,
  onboarding_compliance_completed: false,
  onboarding_compliance_dismissed_at: null,
  onboarding_compliance_dismiss_count: 0,
  fund_township_rural: null,
  fund_owner_managed: null,
  created_at: new Date().toISOString(),
}

// ── Toggle <-> status mapping ───────────────────────────────────────────────

describe('toggleStateToDocumentStatus', () => {
  it('maps each toggle state to the documented status', () => {
    expect(toggleStateToDocumentStatus('have')).toBe('on_file')
    expect(toggleStateToDocumentStatus('unsure')).toBe('pending')
    expect(toggleStateToDocumentStatus('unselected')).toBe('not_registered')
  })
})

describe('documentStatusToToggleState', () => {
  it('treats valid + on_file as "have"', () => {
    expect(documentStatusToToggleState('valid')).toBe('have')
    expect(documentStatusToToggleState('on_file')).toBe('have')
  })

  it('treats pending as "unsure"', () => {
    expect(documentStatusToToggleState('pending')).toBe('unsure')
  })

  it('treats anything else as "unselected"', () => {
    expect(documentStatusToToggleState('not_registered')).toBe('unselected')
    expect(documentStatusToToggleState('expired')).toBe('unselected')
    expect(documentStatusToToggleState('not_required')).toBe('unselected')
    expect(documentStatusToToggleState(null)).toBe('unselected')
    expect(documentStatusToToggleState(undefined)).toBe('unselected')
  })
})

// ── Journey step ordering ───────────────────────────────────────────────────

describe('buildJourneySteps', () => {
  it('marks "have" toggles as done, others as todo with sequential numbers', () => {
    const steps = buildJourneySteps({
      has_employees: false,
      document_states: {
        coa: 'have',
        municipal_registration: 'unselected',
        cipc: 'unsure',
        sars_tax: 'unselected',
      },
      food_safety_training_completed: false,
    })

    const coa = steps.find((s) => s.document_type === 'coa')
    expect(coa?.status).toBe('done')
    expect(coa?.stepNumber).toBeNull()

    // Remaining items get 1, 2, 3… in declared order.
    const todoNumbers = steps
      .filter((s) => s.status === 'todo')
      .map((s) => s.stepNumber)
    expect(todoNumbers).toEqual([1, 2, 3, 4])
  })

  it('omits UIF when has_employees is false', () => {
    const steps = buildJourneySteps({
      has_employees: false,
      document_states: {},
      food_safety_training_completed: true,
    })
    expect(steps.find((s) => s.document_type === 'uif')).toBeUndefined()
    // food safety = done, others = todo
    expect(steps.find((s) => s.document_type === 'food_safety_training')?.status).toBe('done')
  })

  it('includes UIF when has_employees is true', () => {
    const steps = buildJourneySteps({
      has_employees: true,
      document_states: {},
      food_safety_training_completed: false,
    })
    expect(steps.find((s) => s.document_type === 'uif')).toBeDefined()
  })

  it('uses food-safety boolean for the food-safety step', () => {
    const completed = buildJourneySteps({
      has_employees: false,
      document_states: {},
      food_safety_training_completed: true,
    })
    expect(completed.find((s) => s.document_type === 'food_safety_training')?.status).toBe('done')

    const incomplete = buildJourneySteps({
      has_employees: false,
      document_states: {},
      food_safety_training_completed: false,
    })
    expect(incomplete.find((s) => s.document_type === 'food_safety_training')?.status).toBe('todo')
  })
})

// ── Banner snooze logic ─────────────────────────────────────────────────────

describe('shouldShowComplianceBanner', () => {
  const NOW = new Date('2026-05-02T12:00:00Z')

  it('returns false when onboarding is complete', () => {
    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: true,
          onboarding_compliance_dismissed_at: null,
          onboarding_compliance_dismiss_count: 0,
        },
        NOW,
      ),
    ).toBe(false)
  })

  it('returns true when never dismissed', () => {
    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: false,
          onboarding_compliance_dismissed_at: null,
          onboarding_compliance_dismiss_count: 0,
        },
        NOW,
      ),
    ).toBe(true)
  })

  it('first/second dismissal: false within 7 days, true after 7 days', () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString()

    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: false,
          onboarding_compliance_dismissed_at: fiveDaysAgo,
          onboarding_compliance_dismiss_count: 2,
        },
        NOW,
      ),
    ).toBe(false)

    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: false,
          onboarding_compliance_dismissed_at: eightDaysAgo,
          onboarding_compliance_dismiss_count: 2,
        },
        NOW,
      ),
    ).toBe(true)
  })

  it('after 3 dismissals: false within 30 days, true after 30 days', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyOneDaysAgo = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()

    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: false,
          onboarding_compliance_dismissed_at: tenDaysAgo,
          onboarding_compliance_dismiss_count: 3,
        },
        NOW,
      ),
    ).toBe(false)

    expect(
      shouldShowComplianceBanner(
        {
          onboarding_compliance_completed: false,
          onboarding_compliance_dismissed_at: thirtyOneDaysAgo,
          onboarding_compliance_dismiss_count: 4,
        },
        NOW,
      ),
    ).toBe(true)
  })
})

describe('shouldAutoOpenComplianceModal', () => {
  it('opens for fresh, never-dismissed shops', () => {
    expect(shouldAutoOpenComplianceModal(SHOP_DEFAULTS)).toBe(true)
  })

  it('does not open once completed', () => {
    expect(
      shouldAutoOpenComplianceModal({
        ...SHOP_DEFAULTS,
        onboarding_compliance_completed: true,
      }),
    ).toBe(false)
  })

  it('does not open once dismissed at least once', () => {
    expect(
      shouldAutoOpenComplianceModal({
        ...SHOP_DEFAULTS,
        onboarding_compliance_dismiss_count: 1,
        onboarding_compliance_dismissed_at: new Date().toISOString(),
      }),
    ).toBe(false)
  })
})

// ── Schema enums ────────────────────────────────────────────────────────────

describe('schema enums', () => {
  it('ONBOARDING_DOCUMENT_TYPES has the 5 expected values (UIF included)', () => {
    expect(ONBOARDING_DOCUMENT_TYPES).toEqual([
      'municipal_registration',
      'coa',
      'cipc',
      'sars_tax',
      'uif',
    ])
  })

  it('DOCUMENT_TOGGLE_STATES covers the 3-state cycle', () => {
    expect(DOCUMENT_TOGGLE_STATES).toEqual(['have', 'unsure', 'unselected'])
  })
})

// ── Schema validation ───────────────────────────────────────────────────────

describe('complianceOnboardingSchema', () => {
  const base = {
    nationality_type: 'sa_citizen',
    has_employees: false,
    document_states: {},
    food_safety_training_completed: false,
    fund_interest: false,
  }

  it('accepts a valid payload with municipality_id', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_id: VALID_UUID,
    })
    expect(r.success).toBe(true)
  })

  it('accepts a valid payload with area-text fallback', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_area_text: 'Soweto',
    })
    expect(r.success).toBe(true)
  })

  it('rejects when neither municipality_id nor area_text is set', () => {
    const r = complianceOnboardingSchema.safeParse(base)
    expect(r.success).toBe(false)
  })

  it('rejects when both municipality_id and area_text are set', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_id: VALID_UUID,
      municipality_area_text: 'Soweto',
    })
    expect(r.success).toBe(false)
  })

  it('rejects when food_safety_training_completed=true but no date', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_id: VALID_UUID,
      food_safety_training_completed: true,
    })
    expect(r.success).toBe(false)
  })

  it('accepts when food_safety_training_completed=true with a date', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_id: VALID_UUID,
      food_safety_training_completed: true,
      food_safety_training_date: '2025-06-01',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid nationality enum', () => {
    const r = complianceOnboardingSchema.safeParse({
      ...base,
      municipality_id: VALID_UUID,
      nationality_type: 'martian',
    })
    expect(r.success).toBe(false)
  })

  // Phase 37f — Foreign National Path: visa fields
  describe('visa fields (Phase 37f)', () => {
    it('accepts a foreign-national payload with a visa_type', () => {
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'foreign_national',
        municipality_id: VALID_UUID,
        visa_type: 'business_visa',
        visa_expiry_date: '2027-01-01',
      })
      expect(r.success).toBe(true)
    })

    it("accepts a foreign-national payload without an expiry date (the owner picked \"I don't know\")", () => {
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'foreign_national',
        municipality_id: VALID_UUID,
        visa_type: 'asylum_seeker_s22',
      })
      expect(r.success).toBe(true)
    })

    it('rejects a foreign-national payload missing visa_type', () => {
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'foreign_national',
        municipality_id: VALID_UUID,
      })
      expect(r.success).toBe(false)
    })

    it('rejects an unknown visa_type enum', () => {
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'foreign_national',
        municipality_id: VALID_UUID,
        visa_type: 'tourist_visa',
      })
      expect(r.success).toBe(false)
    })

    it('rejects malformed visa_expiry_date', () => {
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'foreign_national',
        municipality_id: VALID_UUID,
        visa_type: 'business_visa',
        visa_expiry_date: '01/01/2027',
      })
      expect(r.success).toBe(false)
    })

    it('SA-citizen payload may include visa fields (API force-nulls them) — schema accepts', () => {
      // The schema is permissive; the API in /api/compliance-onboarding is
      // responsible for force-nulling visa fields when nationality is SA.
      const r = complianceOnboardingSchema.safeParse({
        ...base,
        nationality_type: 'sa_citizen',
        municipality_id: VALID_UUID,
        visa_type: 'business_visa',
      })
      expect(r.success).toBe(true)
    })
  })
})

describe('ownerProfileSchema', () => {
  it('accepts minimal valid data', () => {
    const r = ownerProfileSchema.safeParse({
      nationality_type: 'foreign_national',
      food_safety_training_completed: false,
    })
    expect(r.success).toBe(true)
  })
})

describe('extended onboardingSchema (Phase 37b — area)', () => {
  const valid = {
    shopName: 'Test Shop',
    ownerName: 'Owner',
  }

  it('accepts municipality_id only', () => {
    const r = onboardingSchema.safeParse({ ...valid, municipality_id: VALID_UUID })
    expect(r.success).toBe(true)
  })

  it('accepts municipality_area_text only', () => {
    const r = onboardingSchema.safeParse({ ...valid, municipality_area_text: 'Soweto' })
    expect(r.success).toBe(true)
  })

  it('rejects when both are set', () => {
    const r = onboardingSchema.safeParse({
      ...valid,
      municipality_id: VALID_UUID,
      municipality_area_text: 'Soweto',
    })
    expect(r.success).toBe(false)
  })

  it('rejects when neither is set', () => {
    const r = onboardingSchema.safeParse(valid)
    expect(r.success).toBe(false)
  })
})
