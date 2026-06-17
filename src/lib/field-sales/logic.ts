/**
 * Field Sales — pure helpers (no DB, no DOM, fully unit-testable).
 *
 * Used by the DB layer + pages to group leads by area and decide which
 * follow-ups are due. Kept side-effect-free so tests/unit/field-sales.test.ts
 * can exercise them without a Supabase connection.
 */

import type { AreaGroup, LeadListItem, LeadStatus } from '@/types'

export const UNSPECIFIED_AREA = 'Unspecified'

/** Statuses that close a lead — they drop out of the "follow-ups due" list. */
const CLOSED_STATUSES: ReadonlySet<LeadStatus> = new Set(['signed', 'not_interested'])

/**
 * Is this lead's follow-up due on or before `today` (YYYY-MM-DD, SAST)?
 * Closed leads (signed / not interested) never count as due.
 */
export function isFollowUpDue(
  lead: Pick<LeadListItem, 'next_follow_up_at' | 'status'>,
  today: string,
): boolean {
  if (!lead.next_follow_up_at) return false
  if (CLOSED_STATUSES.has(lead.status)) return false
  return lead.next_follow_up_at <= today
}

/**
 * Filter + sort the leads whose follow-up is due (soonest-overdue first).
 */
export function dueFollowUps<T extends Pick<LeadListItem, 'next_follow_up_at' | 'status'>>(
  leads: T[],
  today: string,
): T[] {
  return leads
    .filter((l) => isFollowUpDue(l, today))
    .sort((a, b) => (a.next_follow_up_at ?? '').localeCompare(b.next_follow_up_at ?? ''))
}

/**
 * Group leads by area for the area / map view. A lead counts as "visited" when
 * it has at least one logged visit. Areas are sorted by total descending, with
 * the "Unspecified" bucket pinned last.
 */
export function groupByArea(leads: LeadListItem[]): AreaGroup[] {
  const buckets = new Map<string, AreaGroup>()

  for (const lead of leads) {
    const area = lead.area?.trim() || UNSPECIFIED_AREA
    let g = buckets.get(area)
    if (!g) {
      g = { area, total: 0, visited: 0, signed: 0 }
      buckets.set(area, g)
    }
    g.total += 1
    if (lead.visit_count > 0) g.visited += 1
    if (lead.status === 'signed') g.signed += 1
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.area === UNSPECIFIED_AREA) return 1
    if (b.area === UNSPECIFIED_AREA) return -1
    return b.total - a.total || a.area.localeCompare(b.area)
  })
}
