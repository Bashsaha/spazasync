/**
 * Phase 37e — Fund Readiness pure status engine.
 *
 * Synthesises onboarding answers + document statuses + compliance score
 * into a single green / amber / red verdict for the R500M Spaza Shop
 * Support Fund. Mirrors the shape of computeComplianceScore: pure function,
 * no Supabase imports — caller resolves the inputs.
 *
 * Required documents for fund eligibility:
 *   - municipal_registration (trading permit)
 *   - sars_tax
 *   - cipc                   ← conditional: missing only caps the tier at R100k,
 *                              does not push status to RED
 *   - smmesa
 *   - coa                    (Certificate of Acceptability / Health Certificate)
 *   - uif
 *
 * "Ok" means status === 'valid' OR 'on_file'. Everything else (pending,
 * not_registered, in_progress, expired, missing row) counts as not done.
 */
import type { BusinessDocument, DocumentType } from '@/types'

export type FundReadinessStatus = 'green' | 'amber' | 'red'

/** All 6 documents the fund cares about. Order is the order shown in the UI. */
export const FUND_REQUIRED_DOC_TYPES: DocumentType[] = [
  'municipal_registration',
  'sars_tax',
  'cipc',
  'smmesa',
  'coa',
  'uif',
]

/** CIPC is conditional — its absence caps the tier but doesn't gate status. */
export const FUND_CONDITIONAL_DOC_TYPES: DocumentType[] = ['cipc']

/** Compliance score floor for GREEN. Mirrors BAND_GREEN_MIN in score.ts. */
export const FUND_GREEN_SCORE_MIN = 80

/** RED if fewer than this many required docs are ok. */
export const FUND_RED_DOC_THRESHOLD = 3

export interface FundReadinessInput {
  nationality_type: 'sa_citizen' | 'foreign_national' | null
  fund_interest: boolean
  fund_township_rural: boolean | null
  fund_owner_managed: boolean | null
  documents: Pick<BusinessDocument, 'document_type' | 'status'>[]
  complianceScore: number
}

export interface FundReadinessDocRow {
  document_type: DocumentType
  ok: boolean
  cipcConditional: boolean
}

export interface FundReadinessResult {
  status: FundReadinessStatus
  requiredDocs: FundReadinessDocRow[]
  /** Count of NON-conditional required docs that are not ok (the ones that matter for status). */
  missingDocCount: number
  /** Whether CIPC is registered — drives Tier 1 vs Tier 2 funding tier display. */
  cipcRegistered: boolean
  /** True when the owner explicitly answered "no" to township_rural or owner_managed. */
  eligibilityBlocked: boolean
}

function docOk(
  type: DocumentType,
  documents: Pick<BusinessDocument, 'document_type' | 'status'>[],
): boolean {
  const row = documents.find((d) => d.document_type === type)
  if (!row) return false
  return row.status === 'valid' || row.status === 'on_file'
}

export function computeFundReadiness(
  input: FundReadinessInput,
): FundReadinessResult {
  const requiredDocs: FundReadinessDocRow[] = FUND_REQUIRED_DOC_TYPES.map(
    (type) => ({
      document_type: type,
      ok: docOk(type, input.documents),
      cipcConditional: FUND_CONDITIONAL_DOC_TYPES.includes(type),
    }),
  )

  const cipcRegistered = requiredDocs.find((r) => r.document_type === 'cipc')!.ok
  const nonConditionalMissing = requiredDocs.filter(
    (r) => !r.cipcConditional && !r.ok,
  ).length
  const missingDocCount = nonConditionalMissing
  const okCountAllRequired = requiredDocs.filter((r) => r.ok).length

  const eligibilityBlocked =
    input.fund_township_rural === false || input.fund_owner_managed === false

  let status: FundReadinessStatus
  if (eligibilityBlocked) {
    status = 'red'
  } else if (okCountAllRequired < FUND_RED_DOC_THRESHOLD) {
    status = 'red'
  } else if (
    nonConditionalMissing === 0 &&
    input.complianceScore >= FUND_GREEN_SCORE_MIN &&
    input.fund_township_rural === true &&
    input.fund_owner_managed === true
  ) {
    status = 'green'
  } else {
    status = 'amber'
  }

  return {
    status,
    requiredDocs,
    missingDocCount,
    cipcRegistered,
    eligibilityBlocked,
  }
}
