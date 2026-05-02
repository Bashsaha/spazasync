/**
 * Phase 37b — Compliance Onboarding pure helpers.
 *
 * No Supabase imports. Callers resolve any DB rows first, then pass them in.
 * Mirrors the design of [src/lib/compliance/score.ts] so unit tests stay
 * pure (see tests/unit/compliance-onboarding.test.ts).
 */

import type {
  DocumentStatus,
  DocumentToggleState,
  JourneyStep,
  OnboardingDocumentType,
  Shop,
} from '@/types'

/** Order journey steps appear on the Screen 8 summary and in nudges later. */
export const ONBOARDING_DOCUMENT_ORDER: ReadonlyArray<
  OnboardingDocumentType | 'food_safety_training'
> = [
  'coa',
  'food_safety_training',
  'municipal_registration',
  'cipc',
  'sars_tax',
  'uif',
]

/** Map a 3-state UI toggle to the persisted business_documents.status value. */
export function toggleStateToDocumentStatus(
  state: DocumentToggleState,
): DocumentStatus {
  switch (state) {
    case 'have':
      return 'on_file'
    case 'unsure':
      return 'pending'
    case 'unselected':
      return 'not_registered'
  }
}

/**
 * Pre-populate the toggle state from any existing business_documents row,
 * so a user redoing the check sees their previous answers.
 */
export function documentStatusToToggleState(
  status: DocumentStatus | null | undefined,
): DocumentToggleState {
  if (!status) return 'unselected'
  if (status === 'valid' || status === 'on_file') return 'have'
  if (status === 'pending') return 'unsure'
  return 'unselected'
}

interface JourneyInput {
  has_employees: boolean
  document_states: Partial<Record<OnboardingDocumentType, DocumentToggleState>>
  food_safety_training_completed: boolean
}

/**
 * Build the ordered step list shown on the summary screen.
 * Items the owner already has → status='done'; everything else → 'todo' with
 * a 1-based stepNumber. UIF is excluded entirely when has_employees=false.
 */
export function buildJourneySteps(input: JourneyInput): JourneyStep[] {
  const items: Array<OnboardingDocumentType | 'food_safety_training'> = []
  for (const key of ONBOARDING_DOCUMENT_ORDER) {
    if (key === 'uif' && !input.has_employees) continue
    items.push(key)
  }

  const steps: JourneyStep[] = items.map((document_type) => {
    const isDone =
      document_type === 'food_safety_training'
        ? input.food_safety_training_completed
        : input.document_states[document_type] === 'have'
    return {
      document_type,
      status: isDone ? 'done' : 'todo',
      stepNumber: null,
    }
  })

  let n = 1
  for (const step of steps) {
    if (step.status === 'todo') {
      step.stepNumber = n
      n += 1
    }
  }
  return steps
}

const DAY_MS = 24 * 60 * 60 * 1000
export const BANNER_FIRST_SNOOZE_DAYS = 7
export const BANNER_LATE_SNOOZE_DAYS = 30
export const BANNER_LATE_SNOOZE_THRESHOLD = 3

interface BannerInput {
  onboarding_compliance_completed: boolean
  onboarding_compliance_dismissed_at: string | null
  onboarding_compliance_dismiss_count: number
}

/**
 * Should the dashboard show the "Complete your compliance check" banner?
 *
 *  - completed → false
 *  - never dismissed → true
 *  - dismissed 1–2 times → true once 7 days have passed
 *  - dismissed ≥3 times → true once 30 days have passed
 */
export function shouldShowComplianceBanner(
  shop: BannerInput,
  now: Date = new Date(),
): boolean {
  if (shop.onboarding_compliance_completed) return false
  if (
    shop.onboarding_compliance_dismiss_count === 0 ||
    !shop.onboarding_compliance_dismissed_at
  ) {
    return true
  }
  const dismissedAt = new Date(shop.onboarding_compliance_dismissed_at).getTime()
  const elapsedDays = (now.getTime() - dismissedAt) / DAY_MS
  const requiredDays =
    shop.onboarding_compliance_dismiss_count >= BANNER_LATE_SNOOZE_THRESHOLD
      ? BANNER_LATE_SNOOZE_DAYS
      : BANNER_FIRST_SNOOZE_DAYS
  return elapsedDays >= requiredDays
}

/**
 * For brand-new owners (never dismissed, never completed), the modal opens
 * automatically on first dashboard visit instead of just showing the banner.
 */
export function shouldAutoOpenComplianceModal(shop: Shop): boolean {
  return (
    !shop.onboarding_compliance_completed &&
    shop.onboarding_compliance_dismiss_count === 0 &&
    !shop.onboarding_compliance_dismissed_at
  )
}
