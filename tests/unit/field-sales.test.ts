import { describe, it, expect } from 'vitest'
import {
  isFollowUpDue,
  dueFollowUps,
  groupByArea,
  UNSPECIFIED_AREA,
} from '@/lib/field-sales/logic'
import type { LeadListItem, LeadStatus } from '@/types'

// Minimal lead factory for the pure helpers.
function lead(over: Partial<LeadListItem> = {}): LeadListItem {
  return {
    id: over.id ?? 'l1',
    business_name: over.business_name ?? 'Shop',
    owner_name: null,
    phone: null,
    whatsapp_number: null,
    address: null,
    area: over.area ?? null,
    status: over.status ?? 'prospect',
    notes: null,
    shop_id: over.shop_id ?? null,
    next_follow_up_at: over.next_follow_up_at ?? null,
    next_follow_up_note: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    visit_count: over.visit_count ?? 0,
    last_visited_at: over.last_visited_at ?? null,
  }
}

const TODAY = '2026-06-17'

describe('isFollowUpDue', () => {
  it('is false when no follow-up date is set', () => {
    expect(isFollowUpDue(lead({ next_follow_up_at: null }), TODAY)).toBe(false)
  })

  it('is true when the follow-up is today or earlier', () => {
    expect(isFollowUpDue(lead({ next_follow_up_at: '2026-06-17' }), TODAY)).toBe(true)
    expect(isFollowUpDue(lead({ next_follow_up_at: '2026-06-01' }), TODAY)).toBe(true)
  })

  it('is false when the follow-up is in the future', () => {
    expect(isFollowUpDue(lead({ next_follow_up_at: '2026-06-18' }), TODAY)).toBe(false)
  })

  it.each(['signed', 'not_interested'] as LeadStatus[])(
    'excludes closed leads even when overdue (%s)',
    (status) => {
      expect(isFollowUpDue(lead({ next_follow_up_at: '2026-01-01', status }), TODAY)).toBe(false)
    },
  )
})

describe('dueFollowUps', () => {
  it('returns only due leads, soonest-overdue first', () => {
    const leads = [
      lead({ id: 'a', next_follow_up_at: '2026-06-10' }),
      lead({ id: 'b', next_follow_up_at: '2026-06-20' }), // future → out
      lead({ id: 'c', next_follow_up_at: '2026-06-01' }),
      lead({ id: 'd', next_follow_up_at: null }), // none → out
      lead({ id: 'e', next_follow_up_at: '2026-06-05', status: 'signed' }), // closed → out
    ]
    const due = dueFollowUps(leads, TODAY)
    expect(due.map((l) => l.id)).toEqual(['c', 'a'])
  })
})

describe('groupByArea', () => {
  it('buckets leads, counts visited + signed, and pins Unspecified last', () => {
    const leads = [
      lead({ id: '1', area: 'Khayelitsha', visit_count: 2, status: 'signed' }),
      lead({ id: '2', area: 'Khayelitsha', visit_count: 0, status: 'prospect' }),
      lead({ id: '3', area: 'Gugulethu', visit_count: 1, status: 'interested' }),
      lead({ id: '4', area: null, visit_count: 1 }),
    ]
    const groups = groupByArea(leads)

    expect(groups.map((g) => g.area)).toEqual(['Khayelitsha', 'Gugulethu', UNSPECIFIED_AREA])

    const khaya = groups.find((g) => g.area === 'Khayelitsha')!
    expect(khaya.total).toBe(2)
    expect(khaya.visited).toBe(1) // only lead 1 has visits
    expect(khaya.signed).toBe(1)

    const unspecified = groups.find((g) => g.area === UNSPECIFIED_AREA)!
    expect(unspecified.total).toBe(1)
    expect(unspecified.visited).toBe(1)
  })

  it('treats blank/whitespace area as Unspecified', () => {
    const groups = groupByArea([lead({ id: '1', area: '   ' })])
    expect(groups[0].area).toBe(UNSPECIFIED_AREA)
  })

  it('returns an empty array for no leads', () => {
    expect(groupByArea([])).toEqual([])
  })
})
