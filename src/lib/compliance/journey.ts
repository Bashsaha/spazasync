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
  JourneyStepKey,
  OwnerProfile,
  Shop,
} from '@/types'
import { qualifiesAsSaCitizenForFund } from './fund'

/**
 * Canonical step order — reflects the real-world dependency chain:
 *  0. Right to Trade        — foreign nationals only; everything depends on a valid visa/permit
 *  1. Food Safety Training  — prerequisite for the CoA (R638 Reg 10)
 *  2. CIPC                  — prerequisite for trading permit + funding
 *  3. SARS Tax              — prerequisite for trading permit
 *  4. Health Certificate    — needs food-safety training; can run with CIPC/SARS
 *  5. Trading Permit        — depends on 1+2+3 (CoA runs alongside)
 *  6. UIF                   — only if has_employees
 *  7. SMMESA                — only if SA citizen (incl. pre-1994 naturalised) + fund_interest; needs CIPC
 */
export const JOURNEY_STEP_ORDER: readonly JourneyStepKey[] = [
  'right_to_trade',
  'food_safety_training',
  'cipc',
  'sars_tax',
  'coa',
  'municipal_registration',
  'uif',
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
  // right_to_trade has no hard lock — it's positioned first and framed as the
  // foundation, but we don't lock the rest of the journey behind it (a foreign
  // owner can still read what the other steps need while sorting out a permit).
  right_to_trade: [],
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
 *
 * - right_to_trade: only true foreign nationals see it. A foreign-born owner
 *   naturalised as an SA citizen before 1994 is an SA citizen by law (no visa),
 *   so `qualifiesAsSaCitizenForFund` filters them out here too.
 * - UIF: only when the shop has employees.
 * - SMMESA: only when the owner counts as an SA citizen for the fund (incl.
 *   pre-1994 naturalised) AND ticked "interested in the fund" at onboarding.
 *   Previously this was a bare `=== 'sa_citizen'`, which wrongly hid the step
 *   from pre-1994 naturalised owners who DO qualify for the fund.
 */
function isStepVisible(
  key: JourneyStepKey,
  ownerProfile: OwnerProfile | null,
  shop: Pick<Shop, 'has_employees' | 'fund_interest'>,
): boolean {
  if (key === 'right_to_trade') {
    return (
      ownerProfile?.nationality_type === 'foreign_national' &&
      !qualifiesAsSaCitizenForFund(ownerProfile ?? { nationality_type: null })
    )
  }
  if (key === 'uif') return shop.has_employees
  if (key === 'smmesa') {
    return qualifiesAsSaCitizenForFund(ownerProfile ?? { nationality_type: null }) && shop.fund_interest
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
  // Compare as strings: JourneyStepKey now has one member (right_to_trade) that
  // is NOT a DocumentType, so a direct `as DocumentType` cast no longer holds.
  // right_to_trade has no document row anyway (its caller guards against it).
  return documents.find((d) => (d.document_type as string) === key) ?? null
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

  // Right to trade also lives on owner_profiles (visa_type), not
  // business_documents. It's "complete" once the owner has recorded a visa /
  // permit at onboarding; otherwise it's the first thing they need to sort out.
  // Expiry urgency is surfaced separately by VisaPermitWarning + visa reminders,
  // so we keep this status purely about whether a permit is on file (no clock
  // here — the engine stays pure/deterministic for tests).
  if (key === 'right_to_trade') {
    return ownerProfile?.visa_type ? 'complete' : 'not_started'
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
    // right_to_trade has no business_documents row — its status comes from
    // owner_profiles.visa_type (resolved in rawStepStatus).
    const doc = key === 'right_to_trade' ? null : findDocument(key, documents)
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
