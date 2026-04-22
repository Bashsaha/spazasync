/**
 * Phase 33 — Pure date math for the waste & pest reminders.
 * No Supabase imports: callers pass already-resolved ISO dates (YYYY-MM-DD)
 * so these helpers stay trivially testable.
 */

export const PEST_REMIND_DAYS = 90
export const WASTE_STALE_DAYS = 30

/**
 * Days between two YYYY-MM-DD strings. `lastIso` before `today` → positive.
 * Returns null if `lastIso` is null/undefined/empty.
 */
export function daysSince(lastIso: string | null | undefined, today: string): number | null {
  if (!lastIso) return null
  const last = Date.parse(`${lastIso}T00:00:00Z`)
  const now = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(last) || Number.isNaN(now)) return null
  return Math.floor((now - last) / 86_400_000)
}

/**
 * Pest control is overdue when the most recent visit was ≥90 days ago,
 * or when there has never been a visit.
 */
export function isPestOverdue(lastVisit: string | null | undefined, today: string): boolean {
  const d = daysSince(lastVisit, today)
  if (d === null) return true
  return d >= PEST_REMIND_DAYS
}

/**
 * The monthly waste confirmation is stale when it was ≥30 days ago
 * or when it has never been recorded.
 */
export function isWasteConfirmationStale(
  lastConfirmed: string | null | undefined,
  today: string,
): boolean {
  const d = daysSince(lastConfirmed, today)
  if (d === null) return true
  return d >= WASTE_STALE_DAYS
}
