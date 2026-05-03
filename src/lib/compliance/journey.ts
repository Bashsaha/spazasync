/**
 * Phase 37c — Compliance Journey Hub: pure step / status / dependency engine.
 *
 * No Supabase imports. Callers resolve owner_profile + shop + business_documents
 * first, then pass them in. Mirrors the design of [src/lib/compliance/score.ts]
 * and [src/lib/compliance/onboarding.ts] so unit tests stay pure (see
 * tests/unit/journey.test.ts).
 *
 * Distinct from the Phase 37b summary engine (`buildJourneySteps`): that one
 * powers the onboarding-modal recap with a 2-state status. The journey hub
 * needs a 4-state status (not_started | in_progress | complete | locked) plus
 * dependency tracking, so we model it separately rather than overloading
 * `JourneyStep`.
 */

import type {
  BusinessDocument,
  ComplianceJourneyStep,
  ComplianceJourneyStepStatus,
  DocumentType,
  JourneyStepKey,
  OwnerProfile,
  Shop,
} from '@/types'

/**
 * Canonical step order shown on /compliance/journey. The trading permit is
 * Step 1 because it's what shop owners are asked for first when an inspector
 * walks in, but it's locked until CIPC + SARS + food-safety training are done.
 */
export const JOURNEY_STEP_ORDER: readonly JourneyStepKey[] = [
  'municipal_registration',
  'coa',
  'cipc',
  'sars_tax',
  'uif',
  'food_safety_training',
  'smmesa',
] as const

/**
 * Dependency graph. A step is `locked` until every key it lists here has
 * `status === 'complete'`. Keep this conservative — locking is a UX promise:
 * "you can't do this until X is done."
 *
 * - Trading Permit needs CIPC, SARS, and food-safety training (CoA can run
 *   in parallel — many municipalities accept the permit + CoA together).
 * - CoA needs food-safety training (inspector won't issue without it).
 * - SMMESA needs CIPC (the registry asks for the company number).
 */
const STEP_DEPENDENCIES: Record<JourneyStepKey, JourneyStepKey[]> = {
  municipal_registration: ['cipc', 'sars_tax', 'food_safety_training'],
  coa: ['food_safety_training'],
  cipc: [],
  sars_tax: [],
  uif: [],
  food_safety_training: [],
  smmesa: ['cipc'],
}

/** business_documents.status values that count as "this step is done". */
const COMPLETE_DOC_STATUSES = new Set(['valid', 'on_file'])

/** business_documents.status values that count as "owner has applied, not received yet". */
const IN_PROGRESS_DOC_STATUSES = new Set(['in_progress', 'pending'])

/**
 * Decide whether a single step is visible for this owner.
 * UIF only matters when the shop has employees. SMMESA only matters when the
 * owner is an SA citizen and ticked "interested in the fund" during onboarding.
 */
function isStepVisible(
  key: JourneyStepKey,
  ownerProfile: OwnerProfile | null,
  shop: Pick<Shop, 'has_employees' | 'fund_interest'>,
): boolean {
  if (key === 'uif') return shop.has_employees
  if (key === 'smmesa') {
    return ownerProfile?.nationality_type === 'sa_citizen' && shop.fund_interest
  }
  return true
}

/**
 * Pick the right business_documents row for a journey step. The DocumentType
 * union and JourneyStepKey union overlap exactly for the 7 steps, so this is
 * just a typed lookup.
 */
function findDocument(
  key: JourneyStepKey,
  documents: BusinessDocument[],
): BusinessDocument | null {
  return documents.find((d) => d.document_type === (key as DocumentType)) ?? null
}

/**
 * Resolve a step's raw status from its document row, ignoring dependencies.
 * Dependency resolution happens in `applyDependencyLocks` below.
 */
function rawStepStatus(
  key: JourneyStepKey,
  ownerProfile: OwnerProfile | null,
  doc: BusinessDocument | null,
): ComplianceJourneyStepStatus {
  // Special case: food-safety lives on owner_profiles, not business_documents,
  // because it's per-person (one owner, multiple shops). Treat the profile flag
  // as the source of truth, but fall back to the document row if a future flow
  // ever writes there.
  if (key === 'food_safety_training') {
    if (ownerProfile?.food_safety_training_completed) return 'complete'
  }

  if (!doc) return 'not_started'
  if (COMPLETE_DOC_STATUSES.has(doc.status)) return 'complete'
  if (IN_PROGRESS_DOC_STATUSES.has(doc.status)) return 'in_progress'
  return 'not_started'
}

/**
 * Generate the visible, ordered journey for an owner.
 * Returns 5–7 steps depending on visibility rules (UIF + SMMESA gates).
 * Statuses returned here are pre-dependency — call `applyDependencyLocks`
 * (or use `generateJourneySteps` which does both) for the final state.
 */
export function buildVisibleSteps(
  ownerProfile: OwnerProfile | null,
  shop: Pick<Shop, 'has_employees' | 'fund_interest'>,
  documents: BusinessDocument[],
): ComplianceJourneyStep[] {
  const visible = JOURNEY_STEP_ORDER.filter((k) => isStepVisible(k, ownerProfile, shop))

  return visible.map((key, index) => {
    const doc = findDocument(key, documents)
    return {
      key,
      stepNumber: index + 1,
      status: rawStepStatus(key, ownerProfile, doc),
      dependencies: STEP_DEPENDENCIES[key],
      blockedBy: [],
      document: doc,
    }
  })
}

/**
 * Walk the dependency graph and convert any step whose prerequisites aren't
 * complete into `locked`, recording which step(s) are blocking it. We DON'T
 * lock steps that are already `complete` or `in_progress` — those represent
 * actions the owner has already taken; locking after the fact would erase
 * progress and confuse them.
 */
export function applyDependencyLocks(
  steps: ComplianceJourneyStep[],
): ComplianceJourneyStep[] {
  const completeSet = new Set(
    steps.filter((s) => s.status === 'complete').map((s) => s.key),
  )
  return steps.map((step) => {
    if (step.status === 'complete' || step.status === 'in_progress') return step
    const blocked = step.dependencies.filter((dep) => !completeSet.has(dep))
    if (blocked.length === 0) return step
    return { ...step, status: 'locked', blockedBy: blocked }
  })
}

/**
 * One-shot helper: build visible steps and apply dependency locks. This is
 * what the API route + page should call.
 */
export function generateJourneySteps(
  ownerProfile: OwnerProfile | null,
  shop: Pick<Shop, 'has_employees' | 'fund_interest'>,
  documents: BusinessDocument[],
): ComplianceJourneyStep[] {
  return applyDependencyLocks(buildVisibleSteps(ownerProfile, shop, documents))
}

/** True iff every key in `step.dependencies` is also `complete` in `documents`. */
export function areDependenciesMet(
  step: Pick<ComplianceJourneyStep, 'dependencies'>,
  ownerProfile: OwnerProfile | null,
  documents: BusinessDocument[],
): boolean {
  return step.dependencies.every((dep) => {
    const doc = findDocument(dep, documents)
    return rawStepStatus(dep, ownerProfile, doc) === 'complete'
  })
}

export interface JourneyProgress {
  completed: number
  total: number
  /** First step that is not `complete` (could be in_progress or locked). null when all done. */
  currentStep: ComplianceJourneyStep | null
}

/** Aggregate stats for the dashboard ComplianceCard + the JourneyProgress header. */
export function getJourneyProgress(
  steps: ComplianceJourneyStep[],
): JourneyProgress {
  const completed = steps.filter((s) => s.status === 'complete').length
  const currentStep = steps.find((s) => s.status !== 'complete') ?? null
  return { completed, total: steps.length, currentStep }
}

/**
 * Decide which step a `business_documents` upsert should target for a given
 * journey action. Used by the /api/compliance/journey/step route to translate
 * an action verb into a `status` value that matches the existing 7-state
 * DocumentStatus enum.
 */
export function resolveStepStatusForAction(
  action: 'mark_done' | 'mark_applied' | 'mark_received' | 'reset',
): { status: BusinessDocument['status']; setAppliedAt: boolean; clearAppliedAt: boolean } {
  switch (action) {
    case 'mark_applied':
      return { status: 'in_progress', setAppliedAt: true, clearAppliedAt: false }
    case 'mark_received':
    case 'mark_done':
      return { status: 'valid', setAppliedAt: false, clearAppliedAt: false }
    case 'reset':
      return { status: 'not_registered', setAppliedAt: false, clearAppliedAt: true }
  }
}
