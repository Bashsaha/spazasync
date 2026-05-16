/**
 * Phase 37e — Fund Readiness pure status engine.
 * Phase 41a — accuracy fixes against the SEFA / SAnews official guideline:
 *   - CIPC unlock threshold corrected to R80,000 (was R100,000)
 *   - SARS satisfies fund eligibility during the official 6-month grace window
 *   - "Naturalised before 1994" foreign-born owners are treated as SA citizens
 *     for fund eligibility (see [[user_role]] — this is for the spaza fund only,
 *     visa screens still apply to true foreign nationals)
 *
 * Synthesises onboarding answers + document statuses + compliance score
 * into a single green / amber / red verdict for the R500M Spaza Shop
 * Support Fund. Mirrors the shape of computeComplianceScore: pure function,
 * no Supabase imports — caller resolves the inputs.
 *
 * Required documents for fund eligibility:
 *   - municipal_registration (trading permit)
 *   - sars_tax               ← satisfied during grace period (see SARS_GRACE rule)
 *   - cipc                   ← conditional: missing only caps the tier at R80,000,
 *                              does not push status to RED
 *   - smmesa
 *   - coa                    (Certificate of Acceptability / Health Certificate)
 *   - uif
 *
 * "Ok" means status === 'valid' OR 'on_file'. Everything else (pending,
 * not_registered, in_progress, expired, missing row) counts as not done —
 * EXCEPT sars_tax, which is treated as ok while sarsGraceActive=true.
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

/** CIPC unlock — funding above this rand value requires CIPC registration. */
export const FUND_CIPC_UNLOCK_AMOUNT_ZAR = 80_000

export interface FundReadinessInput {
  nationality_type: 'sa_citizen' | 'foreign_national' | null
  /** Phase 41a — foreign-born owners who naturalised before 1994 qualify. */
  naturalised_pre_1994?: boolean | null
  fund_interest: boolean
  fund_township_rural: boolean | null
  fund_owner_managed: boolean | null
  documents: Pick<BusinessDocument, 'document_type' | 'status'>[]
  complianceScore: number
  /** Phase 41a — true while shops.sars_grace_period_until is still in the future. */
  sarsGraceActive?: boolean
}

export interface FundReadinessDocRow {
  document_type: DocumentType
  ok: boolean
  cipcConditional: boolean
  /** Phase 41a — true when sars_tax is "ok" only because the grace window is active. */
  inGracePeriod?: boolean
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
  /** True when SARS is being treated as ok only because the grace window is active. */
  sarsInGracePeriod: boolean
}

function docOk(
  type: DocumentType,
  documents: Pick<BusinessDocument, 'document_type' | 'status'>[],
): boolean {
  const row = documents.find((d) => d.document_type === type)
  if (!row) return false
  return row.status === 'valid' || row.status === 'on_file'
}

/**
 * Phase 41a — combines the SA-citizen flag with the pre-1994 naturalisation
 * clause. Used by the engine + by the page-level eligibility gate.
 */
export function qualifiesAsSaCitizenForFund(input: {
  nationality_type: 'sa_citizen' | 'foreign_national' | null
  naturalised_pre_1994?: boolean | null
}): boolean {
  if (input.nationality_type === 'sa_citizen') return true
  return input.naturalised_pre_1994 === true
}

export function computeFundReadiness(
  input: FundReadinessInput,
): FundReadinessResult {
  const sarsActuallyOk = docOk('sars_tax', input.documents)
  const sarsInGracePeriod = !sarsActuallyOk && input.sarsGraceActive === true

  const requiredDocs: FundReadinessDocRow[] = FUND_REQUIRED_DOC_TYPES.map(
    (type) => {
      const baseOk = docOk(type, input.documents)
      if (type === 'sars_tax') {
        return {
          document_type: type,
          ok: baseOk || sarsInGracePeriod,
          cipcConditional: false,
          inGracePeriod: sarsInGracePeriod,
        }
      }
      return {
        document_type: type,
        ok: baseOk,
        cipcConditional: FUND_CONDITIONAL_DOC_TYPES.includes(type),
      }
    },
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
    !sarsInGracePeriod && // GREEN requires real SARS registration, not just grace
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
    sarsInGracePeriod,
  }
}
