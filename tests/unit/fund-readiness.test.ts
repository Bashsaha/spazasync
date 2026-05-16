import { describe, it, expect } from 'vitest'
import {
  computeFundReadiness,
  FUND_CIPC_UNLOCK_AMOUNT_ZAR,
  FUND_REQUIRED_DOC_TYPES,
  qualifiesAsSaCitizenForFund,
  type FundReadinessInput,
} from '@/lib/compliance/fund'
import type { BusinessDocument, DocumentType, DocumentStatus } from '@/types'

function doc(type: DocumentType, status: DocumentStatus): Pick<BusinessDocument, 'document_type' | 'status'> {
  return { document_type: type, status }
}

/** All 6 required docs marked valid — used as the happy-path baseline. */
const allValid = FUND_REQUIRED_DOC_TYPES.map((t) => doc(t, 'valid'))

/** All 5 non-CIPC required docs valid (CIPC absent). */
const allValidExceptCipc = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc').map((t) =>
  doc(t, 'valid'),
)

function baseInput(over: Partial<FundReadinessInput> = {}): FundReadinessInput {
  return {
    nationality_type: 'sa_citizen',
    fund_interest: true,
    fund_township_rural: true,
    fund_owner_managed: true,
    documents: allValid,
    complianceScore: 90,
    ...over,
  }
}

describe('computeFundReadiness — RED status', () => {
  it('returns red when fewer than 3 required docs are ok', () => {
    const result = computeFundReadiness(
      baseInput({ documents: [doc('coa', 'valid'), doc('uif', 'on_file')] }),
    )
    expect(result.status).toBe('red')
  })

  it('returns red when township_rural is explicitly false', () => {
    const result = computeFundReadiness(baseInput({ fund_township_rural: false }))
    expect(result.status).toBe('red')
    expect(result.eligibilityBlocked).toBe(true)
  })

  it('returns red when owner_managed is explicitly false', () => {
    const result = computeFundReadiness(baseInput({ fund_owner_managed: false }))
    expect(result.status).toBe('red')
    expect(result.eligibilityBlocked).toBe(true)
  })
})

describe('computeFundReadiness — AMBER status', () => {
  it('returns amber when 4 of 5 non-CIPC docs are valid + score 75', () => {
    const docs = [
      doc('municipal_registration', 'valid'),
      doc('sars_tax', 'valid'),
      doc('smmesa', 'valid'),
      doc('coa', 'valid'),
      // uif missing
    ]
    const result = computeFundReadiness(baseInput({ documents: docs, complianceScore: 75 }))
    expect(result.status).toBe('amber')
    expect(result.missingDocCount).toBe(1)
  })

  it('returns amber when all docs valid but compliance score is below 80', () => {
    const result = computeFundReadiness(baseInput({ complianceScore: 79 }))
    expect(result.status).toBe('amber')
  })

  it('returns amber when eligibility toggles are still null (not answered)', () => {
    const result = computeFundReadiness(
      baseInput({ fund_township_rural: null, fund_owner_managed: null }),
    )
    expect(result.status).toBe('amber')
    expect(result.eligibilityBlocked).toBe(false)
  })
})

describe('computeFundReadiness — GREEN status', () => {
  it('returns green at Tier 1 (no CIPC, all 5 non-CIPC docs valid, score 82)', () => {
    const result = computeFundReadiness(
      baseInput({ documents: allValidExceptCipc, complianceScore: 82 }),
    )
    expect(result.status).toBe('green')
    expect(result.cipcRegistered).toBe(false)
  })

  it('returns green at Tier 2 (all 6 docs including CIPC valid)', () => {
    const result = computeFundReadiness(baseInput())
    expect(result.status).toBe('green')
    expect(result.cipcRegistered).toBe(true)
  })
})

describe('computeFundReadiness — document status mapping', () => {
  it('counts on_file as ok', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc').map((t) =>
      doc(t, 'on_file'),
    )
    const result = computeFundReadiness(baseInput({ documents: docs }))
    expect(result.missingDocCount).toBe(0)
    expect(result.status).toBe('green')
  })

  it('counts expired CoA as missing', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'coa').map((t) =>
      doc(t, 'valid'),
    )
    docs.push(doc('coa', 'expired'))
    const result = computeFundReadiness(baseInput({ documents: docs }))
    const coaRow = result.requiredDocs.find((r) => r.document_type === 'coa')!
    expect(coaRow.ok).toBe(false)
    expect(result.missingDocCount).toBe(1)
  })

  it('counts pending SARS as missing', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'sars_tax').map(
      (t) => doc(t, 'valid'),
    )
    docs.push(doc('sars_tax', 'pending'))
    const result = computeFundReadiness(baseInput({ documents: docs }))
    expect(result.missingDocCount).toBe(1)
    expect(result.status).toBe('amber')
  })

  it('counts in_progress as missing', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'smmesa').map(
      (t) => doc(t, 'valid'),
    )
    docs.push(doc('smmesa', 'in_progress'))
    const result = computeFundReadiness(baseInput({ documents: docs }))
    expect(result.missingDocCount).toBe(1)
  })
})

describe('computeFundReadiness — CIPC tier gating', () => {
  it('Tier 1 cap: missing CIPC is amber/green-eligible but cipcRegistered=false', () => {
    const result = computeFundReadiness(
      baseInput({ documents: allValidExceptCipc, complianceScore: 90 }),
    )
    expect(result.cipcRegistered).toBe(false)
    expect(result.missingDocCount).toBe(0)
    expect(result.status).toBe('green')
  })

  it('CIPC alone missing should not push status to red on its own', () => {
    const result = computeFundReadiness(
      baseInput({ documents: allValidExceptCipc, complianceScore: 75 }),
    )
    expect(result.status).toBe('amber')
  })
})

// ── Phase 41a additions ─────────────────────────────────────────────────────

describe('Phase 41a — CIPC unlock threshold (per SEFA / SAnews guideline)', () => {
  it('unlock threshold constant matches the official R80,000 cap', () => {
    // Source: https://www.sanews.gov.za/south-africa/guideline-apply-r500-million-spaza-support-fund
    expect(FUND_CIPC_UNLOCK_AMOUNT_ZAR).toBe(80_000)
  })
})

describe('Phase 41a — SARS six-month grace period', () => {
  it('treats sars_tax as ok when grace is active and SARS is not_registered', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'sars_tax').map(
      (t) => doc(t, 'valid'),
    )
    docs.push(doc('sars_tax', 'not_registered'))
    const result = computeFundReadiness(baseInput({ documents: docs, sarsGraceActive: true }))
    expect(result.missingDocCount).toBe(0)
    expect(result.sarsInGracePeriod).toBe(true)
    // amber because GREEN requires real SARS registration (not just grace)
    expect(result.status).toBe('amber')
  })

  it('does NOT count SARS as ok when grace is inactive', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'sars_tax').map(
      (t) => doc(t, 'valid'),
    )
    docs.push(doc('sars_tax', 'not_registered'))
    const result = computeFundReadiness(
      baseInput({ documents: docs, sarsGraceActive: false }),
    )
    expect(result.missingDocCount).toBe(1)
    expect(result.sarsInGracePeriod).toBe(false)
  })

  it('GREEN requires real SARS registration even with grace active', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'sars_tax').map((t) =>
      doc(t, 'valid'),
    )
    docs.push(doc('sars_tax', 'not_registered'))
    const result = computeFundReadiness(
      baseInput({ documents: docs, sarsGraceActive: true, complianceScore: 95 }),
    )
    expect(result.status).toBe('amber')
  })

  it('grace does not affect non-SARS document counting', () => {
    const docs = FUND_REQUIRED_DOC_TYPES.filter((t) => t !== 'cipc' && t !== 'coa').map(
      (t) => doc(t, 'valid'),
    )
    docs.push(doc('coa', 'expired'))
    const result = computeFundReadiness(baseInput({ documents: docs, sarsGraceActive: true }))
    expect(result.missingDocCount).toBe(1)
  })
})

describe('Phase 41a — qualifiesAsSaCitizenForFund (naturalised pre-1994)', () => {
  it('returns true for SA citizens regardless of pre-1994 flag', () => {
    expect(
      qualifiesAsSaCitizenForFund({ nationality_type: 'sa_citizen', naturalised_pre_1994: null }),
    ).toBe(true)
    expect(
      qualifiesAsSaCitizenForFund({ nationality_type: 'sa_citizen', naturalised_pre_1994: false }),
    ).toBe(true)
  })

  it('returns true for foreign nationals naturalised before 1994', () => {
    expect(
      qualifiesAsSaCitizenForFund({
        nationality_type: 'foreign_national',
        naturalised_pre_1994: true,
      }),
    ).toBe(true)
  })

  it('returns false for foreign nationals not naturalised before 1994', () => {
    expect(
      qualifiesAsSaCitizenForFund({
        nationality_type: 'foreign_national',
        naturalised_pre_1994: false,
      }),
    ).toBe(false)
    expect(
      qualifiesAsSaCitizenForFund({
        nationality_type: 'foreign_national',
        naturalised_pre_1994: null,
      }),
    ).toBe(false)
  })
})
