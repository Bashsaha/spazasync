import type {
  BusinessDocument,
  DocumentStatusSummary,
  DocumentType,
  DocumentExpiryWarning,
  DocumentOverallStatus,
} from '@/types'

/**
 * Document types that drive the dashboard compliance traffic-light.
 *
 * The full set of document types in the DB is broader (Phase 37b added
 * sars_tax, uif, food_safety_training, smmesa) but those are captured
 * by the new compliance-onboarding flow and feed the dedicated journey
 * hub in later phases. Keeping the dashboard score scoped to these five
 * preserves existing behaviour and avoids a sudden score regression for
 * shops that haven't yet completed the new onboarding.
 */
const CORE_COMPLIANCE_DOC_TYPES: DocumentType[] = [
  'municipal_registration',
  'coa',
  'cipc',
  'business_license',
  'owner_id',
]

/** Window (in days) at which non-permit documents trigger an amber warning. */
export const EXPIRY_WARNING_DAYS = 30

/** Window (in days) at which owner_id permits trigger an amber warning — longer because renewing a permit takes much longer. */
export const OWNER_ID_WARNING_DAYS = 60

/** Number of calendar days between two YYYY-MM-DD dates. Positive = future, negative = past. */
function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.UTC(
    Number(fromYmd.slice(0, 4)),
    Number(fromYmd.slice(5, 7)) - 1,
    Number(fromYmd.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(toYmd.slice(0, 4)),
    Number(toYmd.slice(5, 7)) - 1,
    Number(toYmd.slice(8, 10)),
  )
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function warningWindowFor(docType: DocumentType): number {
  return docType === 'owner_id' ? OWNER_ID_WARNING_DAYS : EXPIRY_WARNING_DAYS
}

/**
 * Compute the dashboard traffic-light status for a shop's business documents.
 *
 * Rules:
 *   - grey  → no documents have been logged yet
 *   - red   → any document has status 'expired' OR any expiry_date is in the past
 *   - amber → any expiry_date is within its warning window (30 days, 60 for owner_id)
 *             OR any status is 'pending' / 'not_registered'
 *   - green → all 5 document types are logged AND all resolved to 'valid' / 'on_file' / 'not_required'
 */
export function computeDocumentStatus(
  docs: BusinessDocument[],
  todayYmd: string,
): DocumentStatusSummary {
  // Only the core 5 doc types contribute to the dashboard score.
  const coreDocs = docs.filter((d) =>
    CORE_COMPLIANCE_DOC_TYPES.includes(d.document_type),
  )

  if (coreDocs.length === 0) {
    return {
      overall: 'grey',
      totalLogged: 0,
      validCount: 0,
      expiringSoon: [],
      expired: [],
      missing: [...CORE_COMPLIANCE_DOC_TYPES],
    }
  }

  const expiringSoon: DocumentExpiryWarning[] = []
  const expired: DocumentExpiryWarning[] = []
  let hasPendingOrMissingRegistration = false
  let validCount = 0

  for (const d of coreDocs) {
    const daysRemaining = d.expiry_date
      ? daysBetween(todayYmd, d.expiry_date)
      : null

    if (d.status === 'expired') {
      expired.push({
        document_type: d.document_type,
        expiry_date: d.expiry_date ?? todayYmd,
        days_remaining: daysRemaining ?? 0,
      })
      continue
    }

    if (d.status === 'pending' || d.status === 'not_registered') {
      hasPendingOrMissingRegistration = true
      continue
    }

    // From here the user has claimed the doc is valid / on_file / not_required.
    if (daysRemaining !== null) {
      if (daysRemaining < 0) {
        expired.push({
          document_type: d.document_type,
          expiry_date: d.expiry_date!,
          days_remaining: daysRemaining,
        })
        continue
      }
      if (daysRemaining <= warningWindowFor(d.document_type)) {
        expiringSoon.push({
          document_type: d.document_type,
          expiry_date: d.expiry_date!,
          days_remaining: daysRemaining,
        })
        continue
      }
    }

    if (
      d.status === 'valid' ||
      d.status === 'on_file' ||
      d.status === 'not_required'
    ) {
      validCount += 1
    }
  }

  const loggedTypes = new Set(coreDocs.map((d) => d.document_type))
  const missing = CORE_COMPLIANCE_DOC_TYPES.filter(
    (t) => !loggedTypes.has(t),
  )

  let overall: DocumentOverallStatus
  if (expired.length > 0) {
    overall = 'red'
  } else if (
    expiringSoon.length > 0 ||
    hasPendingOrMissingRegistration ||
    missing.length > 0
  ) {
    overall = 'amber'
  } else {
    overall = 'green'
  }

  return {
    overall,
    totalLogged: coreDocs.length,
    validCount,
    expiringSoon,
    expired,
    missing,
  }
}
