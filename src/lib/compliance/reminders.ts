/**
 * Phase 37g — Smart Reminders & Nudges: pure evaluator.
 *
 * No Supabase imports. Composite reader resolves all inputs (shop, owner,
 * documents, journey steps, score, checklist streak, admin alerts, ledger
 * rows), then calls `evaluateReminders` here and `pickTopReminder` to choose
 * the single banner shown on the dashboard.
 *
 * Bucket keys:
 *   - Document expiry: `<type>_<docId>_<bucket>` where bucket ∈ {2m,1m,expired}
 *   - CIPC annual:    `cipc_annual_<YYYY>`
 *   - Visa expiry:    `visa_expiry_<bucket>_<isoDate>` bucket ∈ {90d,60d,30d,expired}
 *   - Journey nudge:  weekly `journey_nudge_<isoMondayDate>` until 4 dismissals
 *                     in this shop's history → switch to `journey_nudge_<YYYY-MM>`
 *   - Fund nudge:     `fund_nudge_<isoBiweekStart>` (Monday of biweek)
 *   - Fund qualified: `fund_qualified_v1` (once-ever)
 *   - Score drop:     `score_drop_<band>_<isoMondayDate>`
 *   - Checklist streak: `checklist_streak_<isoMondayDate>`
 *   - Admin alert:    `admin_alert_<id>`
 *
 * "Dismissed this cycle" = a ledger row with the exact same `reminder_key` and
 * a non-null `dismissed_at`. New cycle → different key → re-eligible.
 */

import type {
  AdminAlert,
  ComplianceJourneyStep,
  Reminder,
  ReminderEvaluatorInputs,
  ReminderPriority,
  ReminderType,
} from '@/types'

// ── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<ReminderPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

/** Switch journey-nudge bucketing from weekly → monthly after this many dismissals. */
const JOURNEY_NUDGE_MONTHLY_AFTER = 4

/** Days since last journey activity before we surface a journey nudge. */
const JOURNEY_IDLE_DAYS = 7

/** Streak break threshold — reminder fires after this many missed days in a row. */
const CHECKLIST_STREAK_BREAK_DAYS = 3

// ── Date helpers (pure, ISO YYYY-MM-DD math) ─────────────────────────────────

/** Days between two YYYY-MM-DD strings (b - a). Negative if `b` is before `a`. */
export function daysBetweenISO(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00Z`).getTime()
  const bd = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((bd - ad) / 86400000)
}

/** ISO YYYY-MM-DD of the Monday of the ISO week containing `iso`. */
export function isoMonday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  // getUTCDay: 0=Sun..6=Sat. Convert to 1=Mon..7=Sun, then offset back.
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

/** ISO YYYY-MM-DD of the Monday starting the bi-week containing `iso`.
 *  Bi-weeks anchor on the ISO-week index modulo 2 from the epoch reference Monday. */
export function isoBiweekStart(iso: string): string {
  const monday = isoMonday(iso)
  // Reference epoch Monday: 1970-01-05 (Mon). Compute weeks-since-epoch %2.
  const weeks = Math.floor(daysBetweenISO('1970-01-05', monday) / 7)
  if (weeks % 2 === 0) return monday
  // Step back one week.
  const d = new Date(`${monday}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
}

/** Year of an ISO YYYY-MM-DD. */
function yearOf(iso: string): string {
  return iso.slice(0, 4)
}

/** YYYY-MM of an ISO YYYY-MM-DD. */
function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

// ── Document-expiry bucket resolution ────────────────────────────────────────

type ExpiryBucket = 'expired' | '1m' | '2m' | null

function resolveExpiryBucket(daysRemaining: number): ExpiryBucket {
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 30) return '1m'
  if (daysRemaining <= 60) return '2m'
  return null
}

function expiryPriority(bucket: ExpiryBucket): ReminderPriority {
  if (bucket === 'expired') return 'urgent'
  if (bucket === '1m') return 'high'
  return 'normal'
}

// ── Visa-expiry bucket resolution ────────────────────────────────────────────

type VisaBucket = 'expired' | '30d' | '60d' | '90d' | null

function resolveVisaBucket(daysRemaining: number): VisaBucket {
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 30) return '30d'
  if (daysRemaining <= 60) return '60d'
  if (daysRemaining <= 90) return '90d'
  return null
}

function visaPriority(bucket: VisaBucket): ReminderPriority {
  if (bucket === 'expired') return 'urgent'
  if (bucket === '30d') return 'high'
  return 'normal'
}

// ── Ledger lookups ───────────────────────────────────────────────────────────

function isDismissed(
  ledger: ReminderEvaluatorInputs['ledger'],
  key: string,
): boolean {
  return ledger.some((row) => row.reminder_key === key && row.dismissed_at != null)
}

function hasShown(
  ledger: ReminderEvaluatorInputs['ledger'],
  key: string,
): boolean {
  return ledger.some((row) => row.reminder_key === key)
}

function countDismissed(
  ledger: ReminderEvaluatorInputs['ledger'],
  type: ReminderType,
): number {
  return ledger.filter(
    (row) => row.reminder_type === type && row.dismissed_at != null,
  ).length
}

// ── Per-type candidate generators ────────────────────────────────────────────

function documentExpiryCandidates(
  inputs: ReminderEvaluatorInputs,
): Reminder[] {
  const out: Reminder[] = []
  for (const doc of inputs.documents) {
    if (!doc.expiry_date) continue
    if (doc.document_type !== 'coa' && doc.document_type !== 'municipal_registration') {
      continue
    }
    const bucket = resolveExpiryBucket(daysBetweenISO(inputs.todayISO, doc.expiry_date))
    if (!bucket) continue
    const type: ReminderType =
      doc.document_type === 'coa' ? 'coa_expiry' : 'permit_expiry'
    const key = `${type}_${doc.id}_${bucket}`
    const docKey = doc.document_type === 'coa' ? 'coa' : 'permit'
    const titleKey =
      bucket === 'expired'
        ? `${docKey}_expiry_expired_title`
        : `${docKey}_expiry_${bucket}_title`
    const bodyKey =
      bucket === 'expired'
        ? `${docKey}_expiry_expired_body`
        : `${docKey}_expiry_${bucket}_body`
    out.push({
      key,
      type,
      priority: expiryPriority(bucket),
      titleKey,
      bodyKey,
      params: {
        date: doc.expiry_date,
        days: Math.max(0, daysBetweenISO(inputs.todayISO, doc.expiry_date)),
      },
      ctaKey:
        doc.document_type === 'coa'
          ? 'cta_generate_evidence_pack'
          : 'cta_view_step',
      ctaHref: '/compliance/journey',
    })
  }
  return out
}

function cipcAnnualCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  const cipc = inputs.documents.find((d) => d.document_type === 'cipc')
  // Only fire when CIPC is registered (valid/on_file/in_progress).
  if (!cipc) return []
  if (
    cipc.status !== 'valid' &&
    cipc.status !== 'on_file' &&
    cipc.status !== 'in_progress'
  ) {
    return []
  }
  const year = yearOf(inputs.todayISO)
  const key = `cipc_annual_${year}`
  return [
    {
      key,
      type: 'cipc_annual',
      priority: 'normal',
      titleKey: 'cipc_annual_title',
      bodyKey: 'cipc_annual_body',
      params: { year },
      ctaKey: 'cta_open_bizportal',
      ctaHref: 'https://bizportal.gov.za',
    },
  ]
}

function visaExpiryCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  const owner = inputs.ownerProfile
  if (!owner) return []
  if (owner.nationality_type !== 'foreign_national') return []
  if (!owner.visa_expiry_date) return []
  const days = daysBetweenISO(inputs.todayISO, owner.visa_expiry_date)
  const bucket = resolveVisaBucket(days)
  if (!bucket) return []
  const key = `visa_expiry_${bucket}_${owner.visa_expiry_date}`
  const titleKey =
    bucket === 'expired' ? 'visa_expired_title' : `visa_${bucket}_title`
  const bodyKey =
    bucket === 'expired' ? 'visa_expired_body' : `visa_${bucket}_body`
  return [
    {
      key,
      type: 'visa_expiry',
      priority: visaPriority(bucket),
      titleKey,
      bodyKey,
      params: {
        date: owner.visa_expiry_date,
        days: Math.max(0, days),
        visa_type: owner.visa_type ?? 'visa',
      },
      ctaKey: 'cta_view_step',
      ctaHref: '/compliance/journey',
    },
  ]
}

function journeyNudgeCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  const incomplete = inputs.journeySteps.filter((s) => s.status !== 'complete')
  if (incomplete.length === 0) return []
  // Idle gate — show only if the owner hasn't touched the journey recently.
  if (inputs.lastJourneyActivity) {
    const lastISO = inputs.lastJourneyActivity.slice(0, 10)
    const idle = daysBetweenISO(lastISO, inputs.todayISO)
    if (idle < JOURNEY_IDLE_DAYS) return []
  }
  // Pick the first non-locked, non-complete step the owner can act on now.
  const next: ComplianceJourneyStep | undefined =
    incomplete.find((s) => s.status === 'in_progress') ??
    incomplete.find((s) => s.status === 'not_started') ??
    incomplete[0]
  if (!next) return []
  const dismissed = countDismissed(inputs.ledger, 'journey_nudge')
  const useMonthlyBucket = dismissed >= JOURNEY_NUDGE_MONTHLY_AFTER
  const bucket = useMonthlyBucket ? monthOf(inputs.todayISO) : isoMonday(inputs.todayISO)
  const key = `journey_nudge_${bucket}`
  return [
    {
      key,
      type: 'journey_nudge',
      priority: 'normal',
      titleKey: 'journey_nudge_title',
      bodyKey: `journey_nudge_body_${next.key}`,
      params: { step: next.stepNumber },
      ctaKey: 'cta_continue_journey',
      ctaHref: '/compliance/journey',
    },
  ]
}

function fundNudgeCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  const owner = inputs.ownerProfile
  if (!owner || owner.nationality_type !== 'sa_citizen') return []
  if (!inputs.shop.fund_interest) return []
  if (inputs.fundQualified) {
    // Once-ever celebration. Use a stable key so it can't re-fire after dismissal.
    const key = 'fund_qualified_v1'
    return [
      {
        key,
        type: 'fund_qualified',
        priority: 'high',
        titleKey: 'fund_qualified_title',
        bodyKey: 'fund_qualified_body',
        ctaKey: 'cta_apply_fund',
        ctaHref: '/compliance/fund',
      },
    ]
  }
  // Bi-weekly nudge while amber — we approximate "amber" as score in
  // [50,79] and at least one missing required document.
  if (inputs.scoreBand !== 'amber') return []
  const bucket = isoBiweekStart(inputs.todayISO)
  const key = `fund_nudge_${bucket}`
  return [
    {
      key,
      type: 'fund_nudge',
      priority: 'normal',
      titleKey: 'fund_nudge_title',
      bodyKey: 'fund_nudge_body',
      params: { score: inputs.complianceScore },
      ctaKey: 'cta_check_fund',
      ctaHref: '/compliance/fund',
    },
  ]
}

function scoreDropCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  if (inputs.scoreBand === 'green') return []
  const bucket = isoMonday(inputs.todayISO)
  const key = `score_drop_${inputs.scoreBand}_${bucket}`
  return [
    {
      key,
      type: 'score_drop',
      priority: inputs.scoreBand === 'red' ? 'high' : 'normal',
      titleKey:
        inputs.scoreBand === 'red' ? 'score_drop_red_title' : 'score_drop_amber_title',
      bodyKey:
        inputs.scoreBand === 'red' ? 'score_drop_red_body' : 'score_drop_amber_body',
      params: { score: inputs.complianceScore },
      ctaKey: 'cta_view_inspection',
      ctaHref: '/inspection',
    },
  ]
}

function checklistStreakCandidates(
  inputs: ReminderEvaluatorInputs,
): Reminder[] {
  if (inputs.checklistCompletedToday) return []
  if (inputs.daysSinceChecklist < CHECKLIST_STREAK_BREAK_DAYS) return []
  const bucket = isoMonday(inputs.todayISO)
  const key = `checklist_streak_${bucket}`
  return [
    {
      key,
      type: 'checklist_streak',
      priority: 'normal',
      titleKey: 'checklist_streak_title',
      bodyKey: 'checklist_streak_body',
      params: { days: inputs.daysSinceChecklist },
      ctaKey: 'cta_open_checklist',
      ctaHref: '/checklist',
    },
  ]
}

function productsMissingCostCandidates(
  inputs: ReminderEvaluatorInputs,
): Reminder[] {
  if (inputs.productsMissingCost <= 0) return []
  const bucket = isoMonday(inputs.todayISO)
  const key = `products_missing_cost_${bucket}`
  return [
    {
      key,
      type: 'products_missing_cost',
      priority: 'normal',
      titleKey: 'products_missing_cost_title',
      bodyKey: 'products_missing_cost_body',
      params: { count: inputs.productsMissingCost },
      ctaKey: 'cta_set_cost_prices',
      ctaHref: '/products?missing_cost=1',
    },
  ]
}

function productsMissingSupplierCandidates(
  inputs: ReminderEvaluatorInputs,
): Reminder[] {
  if (inputs.productsMissingSupplier <= 0) return []
  // Suppress when the shop has zero suppliers — same rule as BUG-028: day-one
  // shops shouldn't be nudged to "assign suppliers" before they've added any.
  if (inputs.suppliersCount <= 0) return []
  const bucket = isoMonday(inputs.todayISO)
  const key = `products_missing_supplier_${bucket}`
  return [
    {
      key,
      type: 'products_missing_supplier',
      priority: 'low',
      titleKey: 'products_missing_supplier_title',
      bodyKey: 'products_missing_supplier_body',
      params: { count: inputs.productsMissingSupplier },
      ctaKey: 'cta_assign_suppliers',
      ctaHref: '/suppliers/assign',
    },
  ]
}

function adminAlertCandidates(inputs: ReminderEvaluatorInputs): Reminder[] {
  const nationality = inputs.ownerProfile?.nationality_type ?? null
  return inputs.adminAlerts
    .filter((a) => audienceMatches(a, nationality))
    .map((a) => adminAlertToReminder(a))
}

function audienceMatches(
  alert: AdminAlert,
  nationality: 'sa_citizen' | 'foreign_national' | null,
): boolean {
  if (alert.target_audience === 'all') return true
  return alert.target_audience === nationality
}

function adminAlertToReminder(alert: AdminAlert): Reminder {
  const priority: ReminderPriority =
    alert.priority === 'urgent'
      ? 'urgent'
      : alert.priority === 'high'
      ? 'high'
      : 'normal'
  // Admin alerts ship pre-translated free-text — stash directly in params and
  // use the literal-pass-through copy keys (`admin_alert_title` / `_body`),
  // which simply render `{title}` / `{message}`.
  return {
    key: `admin_alert_${alert.id}`,
    type: 'admin_alert',
    priority,
    titleKey: 'admin_alert_title',
    bodyKey: 'admin_alert_body',
    params: { title: alert.title, message: alert.message },
    ctaKey: alert.link_text && alert.link_url ? 'admin_alert_cta' : undefined,
    ctaHref: alert.link_url ?? undefined,
  }
}

// ── Top-level evaluator + picker ─────────────────────────────────────────────

/**
 * Pure evaluator. Generates every eligible reminder candidate (no filtering by
 * dismissal yet — that's `pickTopReminder`'s job, so callers can still inspect
 * dismissed candidates if they want analytics).
 */
export function evaluateReminders(
  inputs: ReminderEvaluatorInputs,
): Reminder[] {
  return [
    ...documentExpiryCandidates(inputs),
    ...cipcAnnualCandidates(inputs),
    ...visaExpiryCandidates(inputs),
    ...journeyNudgeCandidates(inputs),
    ...fundNudgeCandidates(inputs),
    ...scoreDropCandidates(inputs),
    ...checklistStreakCandidates(inputs),
    ...productsMissingCostCandidates(inputs),
    ...productsMissingSupplierCandidates(inputs),
    ...adminAlertCandidates(inputs),
  ]
}

/**
 * Sort highest-priority first; tie-break alphabetically by reminder type for
 * deterministic ordering, then by key (so the same shop sees the same banner
 * every refresh until it's dismissed).
 */
export function sortByPriority(candidates: Reminder[]): Reminder[] {
  return [...candidates].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority]
    const pb = PRIORITY_RANK[b.priority]
    if (pa !== pb) return pa - pb
    if (a.type !== b.type) return a.type < b.type ? -1 : 1
    return a.key < b.key ? -1 : 1
  })
}

/**
 * Resolve the single banner the dashboard should render.
 * Returns null when nothing eligible remains after dismissal filtering.
 */
export function pickTopReminder(
  inputs: ReminderEvaluatorInputs,
): Reminder | null {
  const candidates = evaluateReminders(inputs).filter(
    (r) => !isDismissed(inputs.ledger, r.key),
  )
  if (candidates.length === 0) return null
  return sortByPriority(candidates)[0]
}

// Re-exports useful for tests.
export const __test__ = {
  hasShown,
  countDismissed,
  resolveExpiryBucket,
  resolveVisaBucket,
  PRIORITY_RANK,
}
