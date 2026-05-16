import { describe, it, expect } from 'vitest'
import {
  evaluateReminders,
  pickTopReminder,
  sortByPriority,
  daysBetweenISO,
  isoMonday,
  isoBiweekStart,
} from '@/lib/compliance/reminders'
import type {
  AdminAlert,
  BusinessDocument,
  ComplianceJourneyStep,
  ComplianceReminderRow,
  DocumentStatus,
  DocumentType,
  OwnerProfile,
  Reminder,
  ReminderEvaluatorInputs,
} from '@/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const TODAY = '2026-05-07' // Thursday

function makeOwner(over: Partial<OwnerProfile> = {}): OwnerProfile {
  return {
    user_id: 'u1',
    nationality_type: 'sa_citizen',
    food_safety_training_completed: false,
    food_safety_training_date: null,
    food_safety_training_provider: null,
    has_disability: false,
    visa_type: null,
    visa_expiry_date: null,
    naturalised_pre_1994: null,
    created_at: TODAY,
    updated_at: TODAY,
    ...over,
  }
}

function makeDoc(
  type: DocumentType,
  status: DocumentStatus,
  expiry: string | null = null,
  id = `doc-${type}`,
): BusinessDocument {
  return {
    id,
    shop_id: 'shop-1',
    document_type: type,
    status,
    reference_number: null,
    date_issued: null,
    expiry_date: expiry,
    notes: null,
    applied_at: null,
    created_at: TODAY,
    updated_at: TODAY,
  }
}

function makeStep(
  key: ComplianceJourneyStep['key'],
  status: ComplianceJourneyStep['status'],
  stepNumber = 1,
): ComplianceJourneyStep {
  return {
    key,
    stepNumber,
    status,
    dependencies: [],
    blockedBy: [],
    document: null,
  }
}

function makeInputs(over: Partial<ReminderEvaluatorInputs> = {}): ReminderEvaluatorInputs {
  return {
    todayISO: TODAY,
    ownerProfile: makeOwner(),
    shop: { has_employees: false, fund_interest: false },
    documents: [],
    journeySteps: [],
    lastJourneyActivity: null,
    complianceScore: 90,
    scoreBand: 'green',
    daysSinceChecklist: 0,
    checklistCompletedToday: true,
    adminAlerts: [],
    ledger: [],
    fundQualified: false,
    productsMissingCost: 0,
    productsMissingSupplier: 0,
    suppliersCount: 0,
    ...over,
  }
}

function dismissed(key: string, type: ComplianceReminderRow['reminder_type']): ComplianceReminderRow {
  return {
    id: `lr-${key}`,
    shop_id: 'shop-1',
    reminder_type: type,
    reminder_key: key,
    shown_at: TODAY,
    dismissed_at: TODAY,
    created_at: TODAY,
  }
}

// Helper: add N days to an ISO date.
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Date helpers ─────────────────────────────────────────────────────────────

describe('date helpers', () => {
  it('daysBetweenISO is symmetric and signed', () => {
    expect(daysBetweenISO('2026-05-01', '2026-05-08')).toBe(7)
    expect(daysBetweenISO('2026-05-08', '2026-05-01')).toBe(-7)
  })

  it('isoMonday rounds back to the Monday of the week', () => {
    // 2026-05-07 is Thursday; Monday of that week is 2026-05-04.
    expect(isoMonday('2026-05-07')).toBe('2026-05-04')
    expect(isoMonday('2026-05-04')).toBe('2026-05-04')
    // Sunday rolls back to the *previous* Monday.
    expect(isoMonday('2026-05-10')).toBe('2026-05-04')
  })

  it('isoBiweekStart alternates every two ISO weeks', () => {
    const a = isoBiweekStart('2026-05-07')
    const b = isoBiweekStart(addDays(a, 7))   // next week
    const c = isoBiweekStart(addDays(a, 14))  // two weeks later
    expect(a).toBe(b)
    expect(c).not.toBe(a)
  })
})

// ── Document expiry ──────────────────────────────────────────────────────────

describe('CoA expiry reminders', () => {
  it('fires at 60d, 30d, and on expiry — 3 distinct keys', () => {
    const sixty = makeDoc('coa', 'valid', addDays(TODAY, 55), 'coa-1')
    const thirty = makeDoc('coa', 'valid', addDays(TODAY, 20), 'coa-2')
    const expired = makeDoc('coa', 'valid', addDays(TODAY, -5), 'coa-3')
    const out = evaluateReminders(makeInputs({ documents: [sixty, thirty, expired] }))
    const coaReminders = out.filter((r) => r.type === 'coa_expiry')
    expect(coaReminders).toHaveLength(3)
    const keys = new Set(coaReminders.map((r) => r.key))
    expect(keys.size).toBe(3)
  })

  it('does not fire when expiry is more than 60 days away', () => {
    const doc = makeDoc('coa', 'valid', addDays(TODAY, 120))
    const out = evaluateReminders(makeInputs({ documents: [doc] }))
    expect(out.filter((r) => r.type === 'coa_expiry')).toHaveLength(0)
  })

  it('expired CoA gets urgent priority', () => {
    const doc = makeDoc('coa', 'valid', addDays(TODAY, -1))
    const top = pickTopReminder(makeInputs({ documents: [doc] }))
    expect(top?.priority).toBe('urgent')
    expect(top?.type).toBe('coa_expiry')
  })
})

describe('Trading permit expiry reminders', () => {
  it('fires identically to CoA but with permit_expiry type', () => {
    const doc = makeDoc('municipal_registration', 'valid', addDays(TODAY, 25))
    const out = evaluateReminders(makeInputs({ documents: [doc] }))
    const permit = out.filter((r) => r.type === 'permit_expiry')
    expect(permit).toHaveLength(1)
    expect(permit[0].priority).toBe('high')
  })
})

// ── CIPC annual ──────────────────────────────────────────────────────────────

describe('CIPC annual return reminder', () => {
  it('fires once per year when CIPC is registered', () => {
    const cipc = makeDoc('cipc', 'valid')
    const out = evaluateReminders(makeInputs({ documents: [cipc] }))
    const cipcRem = out.filter((r) => r.type === 'cipc_annual')
    expect(cipcRem).toHaveLength(1)
    expect(cipcRem[0].key).toBe('cipc_annual_2026')
  })

  it('does not fire when CIPC is not registered', () => {
    const cipc = makeDoc('cipc', 'not_registered')
    const out = evaluateReminders(makeInputs({ documents: [cipc] }))
    expect(out.filter((r) => r.type === 'cipc_annual')).toHaveLength(0)
  })
})

// ── Visa expiry ──────────────────────────────────────────────────────────────

describe('Visa expiry reminders', () => {
  it('fires at 90/60/30 days for foreign nationals with visa_expiry_date', () => {
    const cases = [
      { days: 85, bucket: '90d' as const },
      { days: 55, bucket: '60d' as const },
      { days: 25, bucket: '30d' as const },
    ]
    for (const c of cases) {
      const owner = makeOwner({
        nationality_type: 'foreign_national',
        visa_type: 'business_visa',
        visa_expiry_date: addDays(TODAY, c.days),
      })
      const out = evaluateReminders(makeInputs({ ownerProfile: owner }))
      const visa = out.filter((r) => r.type === 'visa_expiry')
      expect(visa).toHaveLength(1)
      expect(visa[0].key).toContain(c.bucket)
    }
  })

  it('does NOT fire for SA citizens even with visa_expiry_date set (regression)', () => {
    const owner = makeOwner({
      nationality_type: 'sa_citizen',
      visa_expiry_date: addDays(TODAY, 25),
    })
    const out = evaluateReminders(makeInputs({ ownerProfile: owner }))
    expect(out.filter((r) => r.type === 'visa_expiry')).toHaveLength(0)
  })

  it('expired visa is urgent', () => {
    const owner = makeOwner({
      nationality_type: 'foreign_national',
      visa_type: 'business_visa',
      visa_expiry_date: addDays(TODAY, -3),
    })
    const top = pickTopReminder(makeInputs({ ownerProfile: owner }))
    expect(top?.type).toBe('visa_expiry')
    expect(top?.priority).toBe('urgent')
  })
})

// ── Journey nudge ────────────────────────────────────────────────────────────

describe('Journey nudges', () => {
  it('fires once per ISO week when there are incomplete steps and idle ≥ 7 days', () => {
    const steps = [makeStep('cipc', 'not_started', 1)]
    const out = evaluateReminders(
      makeInputs({
        journeySteps: steps,
        lastJourneyActivity: addDays(TODAY, -10),
      }),
    )
    const nudges = out.filter((r) => r.type === 'journey_nudge')
    expect(nudges).toHaveLength(1)
    expect(nudges[0].key).toBe(`journey_nudge_${isoMonday(TODAY)}`)
  })

  it('does not fire when all steps are complete', () => {
    const steps = [makeStep('cipc', 'complete', 1)]
    const out = evaluateReminders(makeInputs({ journeySteps: steps }))
    expect(out.filter((r) => r.type === 'journey_nudge')).toHaveLength(0)
  })

  it('does not fire when journey was active in the last 7 days', () => {
    const steps = [makeStep('cipc', 'not_started', 1)]
    const out = evaluateReminders(
      makeInputs({
        journeySteps: steps,
        lastJourneyActivity: addDays(TODAY, -2),
      }),
    )
    expect(out.filter((r) => r.type === 'journey_nudge')).toHaveLength(0)
  })

  it('switches to monthly bucket after 4 prior dismissals', () => {
    const steps = [makeStep('cipc', 'not_started', 1)]
    const ledger: ComplianceReminderRow[] = Array.from({ length: 4 }).map((_, i) =>
      dismissed(`journey_nudge_2026-04-0${i + 1}`, 'journey_nudge'),
    )
    const out = evaluateReminders(
      makeInputs({ journeySteps: steps, lastJourneyActivity: null, ledger }),
    )
    const nudge = out.find((r) => r.type === 'journey_nudge')
    expect(nudge?.key).toBe('journey_nudge_2026-05')
  })
})

// ── Fund nudges ──────────────────────────────────────────────────────────────

describe('Fund nudges', () => {
  it('fires biweekly for SA citizen + fund_interest + amber score', () => {
    const out = evaluateReminders(
      makeInputs({
        ownerProfile: makeOwner({ nationality_type: 'sa_citizen' }),
        shop: { has_employees: false, fund_interest: true },
        complianceScore: 65,
        scoreBand: 'amber',
      }),
    )
    const nudge = out.find((r) => r.type === 'fund_nudge')
    expect(nudge).toBeTruthy()
    expect(nudge?.priority).toBe('normal')
  })

  it('does NOT fire for foreign nationals (regression)', () => {
    const out = evaluateReminders(
      makeInputs({
        ownerProfile: makeOwner({ nationality_type: 'foreign_national' }),
        shop: { has_employees: false, fund_interest: true },
        scoreBand: 'amber',
        complianceScore: 65,
      }),
    )
    expect(out.filter((r) => r.type === 'fund_nudge')).toHaveLength(0)
  })

  it('does NOT fire when fund_interest is false', () => {
    const out = evaluateReminders(
      makeInputs({
        shop: { has_employees: false, fund_interest: false },
        scoreBand: 'amber',
        complianceScore: 65,
      }),
    )
    expect(out.filter((r) => r.type === 'fund_nudge')).toHaveLength(0)
  })

  it('fund_qualified fires once with stable key', () => {
    const out = evaluateReminders(
      makeInputs({
        shop: { has_employees: false, fund_interest: true },
        fundQualified: true,
        scoreBand: 'green',
        complianceScore: 90,
      }),
    )
    const q = out.find((r) => r.type === 'fund_qualified')
    expect(q?.key).toBe('fund_qualified_v1')
    expect(q?.priority).toBe('high')
  })
})

// ── Score drop ───────────────────────────────────────────────────────────────

describe('Score drop alerts', () => {
  it('fires high priority when red', () => {
    const out = evaluateReminders(
      makeInputs({ scoreBand: 'red', complianceScore: 40 }),
    )
    const drop = out.find((r) => r.type === 'score_drop')
    expect(drop?.priority).toBe('high')
  })

  it('fires normal priority when amber', () => {
    const out = evaluateReminders(
      makeInputs({ scoreBand: 'amber', complianceScore: 65 }),
    )
    const drop = out.find((r) => r.type === 'score_drop')
    expect(drop?.priority).toBe('normal')
  })

  it('does not fire when green', () => {
    const out = evaluateReminders(
      makeInputs({ scoreBand: 'green', complianceScore: 90 }),
    )
    expect(out.filter((r) => r.type === 'score_drop')).toHaveLength(0)
  })
})

// ── Checklist streak ─────────────────────────────────────────────────────────

describe('Checklist streak break', () => {
  it('fires after 3+ consecutive missed days', () => {
    const out = evaluateReminders(
      makeInputs({ daysSinceChecklist: 4, checklistCompletedToday: false }),
    )
    expect(out.filter((r) => r.type === 'checklist_streak')).toHaveLength(1)
  })

  it('does not fire if completed today', () => {
    const out = evaluateReminders(
      makeInputs({ daysSinceChecklist: 0, checklistCompletedToday: true }),
    )
    expect(out.filter((r) => r.type === 'checklist_streak')).toHaveLength(0)
  })
})

// ── Admin alerts ─────────────────────────────────────────────────────────────

function makeAlert(over: Partial<AdminAlert> = {}): AdminAlert {
  return {
    id: 'al-1',
    title: 'Inspection campaign',
    message: 'Make sure your shop is ready.',
    link_text: null,
    link_url: null,
    priority: 'normal',
    target_audience: 'all',
    starts_at: TODAY,
    expires_at: null,
    created_at: TODAY,
    ...over,
  }
}

describe('Admin alerts', () => {
  it('respects target_audience — sa_citizen alert hidden from foreign_national', () => {
    const out = evaluateReminders(
      makeInputs({
        ownerProfile: makeOwner({ nationality_type: 'foreign_national' }),
        adminAlerts: [makeAlert({ target_audience: 'sa_citizen' })],
      }),
    )
    expect(out.filter((r) => r.type === 'admin_alert')).toHaveLength(0)
  })

  it('urgent admin alert beats high-priority reminders', () => {
    const top = pickTopReminder(
      makeInputs({
        adminAlerts: [makeAlert({ priority: 'urgent' })],
        documents: [makeDoc('coa', 'valid', addDays(TODAY, 25))], // high
      }),
    )
    expect(top?.type).toBe('admin_alert')
  })
})

// ── Dismissal & priority ─────────────────────────────────────────────────────

describe('Dismissal filtering', () => {
  it('dismissed key never returns this cycle', () => {
    const doc = makeDoc('coa', 'valid', addDays(TODAY, 20), 'd1')
    const inputs = makeInputs({ documents: [doc] })
    const top1 = pickTopReminder(inputs)!
    const inputs2 = makeInputs({
      documents: [doc],
      ledger: [dismissed(top1.key, 'coa_expiry')],
    })
    const top2 = pickTopReminder(inputs2)
    expect(top2).toBeNull()
  })
})

describe('Priority ordering', () => {
  it('urgent > high > normal > low; ties broken alphabetically by type', () => {
    const reminders: Reminder[] = [
      { key: 'a', type: 'admin_alert', priority: 'normal', titleKey: 'a', bodyKey: 'a' },
      { key: 'b', type: 'coa_expiry', priority: 'urgent', titleKey: 'b', bodyKey: 'b' },
      { key: 'c', type: 'fund_nudge', priority: 'high', titleKey: 'c', bodyKey: 'c' },
      { key: 'd', type: 'permit_expiry', priority: 'urgent', titleKey: 'd', bodyKey: 'd' },
    ]
    const sorted = sortByPriority(reminders)
    expect(sorted.map((r) => r.type)).toEqual([
      'coa_expiry',     // urgent, type < permit_expiry
      'permit_expiry',  // urgent
      'fund_nudge',     // high
      'admin_alert',    // normal
    ])
  })

  it('returns null when nothing eligible', () => {
    expect(pickTopReminder(makeInputs())).toBeNull()
  })
})

describe('products_missing_cost reminder', () => {
  it('fires when count >= 1', () => {
    const out = evaluateReminders(makeInputs({ productsMissingCost: 3 }))
    const r = out.find((x) => x.type === 'products_missing_cost')
    expect(r).toBeDefined()
    expect(r?.priority).toBe('normal')
    expect(r?.params?.count).toBe(3)
    expect(r?.ctaHref).toBe('/products/missing-cost')
    expect(r?.key.startsWith('products_missing_cost_')).toBe(true)
  })
  it('does not fire when count = 0', () => {
    const out = evaluateReminders(makeInputs({ productsMissingCost: 0 }))
    expect(out.find((x) => x.type === 'products_missing_cost')).toBeUndefined()
  })
})

describe('products_missing_supplier reminder', () => {
  it('fires when count >= 1 AND suppliersCount >= 1', () => {
    const out = evaluateReminders(
      makeInputs({ productsMissingSupplier: 5, suppliersCount: 2 }),
    )
    const r = out.find((x) => x.type === 'products_missing_supplier')
    expect(r).toBeDefined()
    expect(r?.priority).toBe('low')
    expect(r?.params?.count).toBe(5)
    expect(r?.ctaHref).toBe('/suppliers/assign')
  })
  it('suppressed when shop has zero suppliers', () => {
    const out = evaluateReminders(
      makeInputs({ productsMissingSupplier: 5, suppliersCount: 0 }),
    )
    expect(out.find((x) => x.type === 'products_missing_supplier')).toBeUndefined()
  })
  it('does not fire when count = 0', () => {
    const out = evaluateReminders(
      makeInputs({ productsMissingSupplier: 0, suppliersCount: 3 }),
    )
    expect(out.find((x) => x.type === 'products_missing_supplier')).toBeUndefined()
  })
  it('two reminders are independent (both can fire)', () => {
    const out = evaluateReminders(
      makeInputs({
        productsMissingCost: 2,
        productsMissingSupplier: 3,
        suppliersCount: 1,
      }),
    )
    expect(out.find((x) => x.type === 'products_missing_cost')).toBeDefined()
    expect(out.find((x) => x.type === 'products_missing_supplier')).toBeDefined()
  })
})
