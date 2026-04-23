/**
 * Phase 34a — Compliance score pure function.
 *
 * Composes over existing helpers (computeChecklistStats, computeDocumentStatus,
 * isPestOverdue, isWasteConfirmationStale) to produce a single 0–100 number plus
 * a per-category breakdown. Used on the dashboard, the /inspection page,
 * the compliance PDF, and the monthly in-app summary — always through this
 * function so the number is identical everywhere.
 *
 * No Supabase imports: callers resolve the inputs first, then pass them in.
 */

import type {
  ComplianceScoreBand,
  ComplianceScoreCategory,
  ComplianceScoreInputs,
  ComplianceScoreResult,
} from '@/types'

export const WEIGHT_CHECKLIST = 25
export const WEIGHT_EXPIRY = 20
export const WEIGHT_SUPPLIERS = 20
export const WEIGHT_DOCUMENTS = 20
export const WEIGHT_WASTE_PEST = 15

export const BAND_GREEN_MIN = 80
export const BAND_AMBER_MIN = 50

export function bandFor(score: number): ComplianceScoreBand {
  if (score >= BAND_GREEN_MIN) return 'green'
  if (score >= BAND_AMBER_MIN) return 'amber'
  return 'red'
}

function scoreChecklist(inputs: ComplianceScoreInputs): ComplianceScoreCategory {
  const score = Math.max(0, Math.min(100, Math.round(inputs.checklistCompliancePct)))
  const weighted = (score * WEIGHT_CHECKLIST) / 100
  return {
    key: 'checklist',
    weight: WEIGHT_CHECKLIST,
    score,
    weighted,
    tipKey: score < 100 ? 'tip_checklist' : null,
    tipParams: score < 100 ? { pct: score } : undefined,
  }
}

function scoreExpiry(inputs: ComplianceScoreInputs): ComplianceScoreCategory {
  const score = inputs.expiredBatchCount === 0 ? 100 : 0
  const weighted = (score * WEIGHT_EXPIRY) / 100
  return {
    key: 'expiry',
    weight: WEIGHT_EXPIRY,
    score,
    weighted,
    tipKey: score < 100 ? 'tip_expiry' : null,
    tipParams: score < 100 ? { count: inputs.expiredBatchCount } : undefined,
  }
}

function scoreSuppliers(inputs: ComplianceScoreInputs): ComplianceScoreCategory {
  let score: number
  if (inputs.productCount === 0) {
    // No products yet — treat as 100 so an empty shop isn't penalised for supplier coverage.
    score = 100
  } else {
    score = Math.round((inputs.productsWithSupplier / inputs.productCount) * 100)
  }
  const missing = Math.max(0, inputs.productCount - inputs.productsWithSupplier)
  const weighted = (score * WEIGHT_SUPPLIERS) / 100
  return {
    key: 'suppliers',
    weight: WEIGHT_SUPPLIERS,
    score,
    weighted,
    tipKey: score < 100 ? 'tip_suppliers' : null,
    tipParams: score < 100 ? { count: missing } : undefined,
  }
}

function scoreDocuments(inputs: ComplianceScoreInputs): ComplianceScoreCategory {
  let score: number
  switch (inputs.documentOverall) {
    case 'green':
      score = 100
      break
    case 'amber':
      score = 50
      break
    case 'red':
    case 'grey':
      score = 0
      break
  }
  const weighted = (score * WEIGHT_DOCUMENTS) / 100
  return {
    key: 'documents',
    weight: WEIGHT_DOCUMENTS,
    score,
    weighted,
    tipKey: score < 100 ? 'tip_documents' : null,
  }
}

function scoreWastePest(inputs: ComplianceScoreInputs): ComplianceScoreCategory {
  const pestOk = !inputs.pestOverdue
  const wasteOk = !inputs.wasteStale
  let score: number
  if (pestOk && wasteOk) score = 100
  else if (pestOk || wasteOk) score = 50
  else score = 0
  const weighted = (score * WEIGHT_WASTE_PEST) / 100
  return {
    key: 'waste_pest',
    weight: WEIGHT_WASTE_PEST,
    score,
    weighted,
    tipKey: score < 100 ? 'tip_waste_pest' : null,
  }
}

/**
 * Compute the compliance score from pre-resolved inputs.
 * All weights sum to 100, so the overall is a direct weighted mean on a 0–100 scale.
 */
export function computeComplianceScore(inputs: ComplianceScoreInputs): ComplianceScoreResult {
  const categories: ComplianceScoreCategory[] = [
    scoreChecklist(inputs),
    scoreExpiry(inputs),
    scoreSuppliers(inputs),
    scoreDocuments(inputs),
    scoreWastePest(inputs),
  ]
  const overall = Math.round(categories.reduce((sum, c) => sum + c.weighted, 0))
  return {
    overall,
    band: bandFor(overall),
    categories,
  }
}
