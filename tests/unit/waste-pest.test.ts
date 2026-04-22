import { describe, it, expect } from 'vitest'
import {
  daysSince,
  isPestOverdue,
  isWasteConfirmationStale,
  PEST_REMIND_DAYS,
  WASTE_STALE_DAYS,
} from '@/lib/compliance/waste-pest-status'

const TODAY = '2026-04-22'

function daysAgo(n: number, base = TODAY): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

describe('daysSince', () => {
  it('returns null when lastIso is null', () => {
    expect(daysSince(null, TODAY)).toBeNull()
  })

  it('returns null when lastIso is undefined', () => {
    expect(daysSince(undefined, TODAY)).toBeNull()
  })

  it('returns null when lastIso is empty string', () => {
    expect(daysSince('', TODAY)).toBeNull()
  })

  it('returns 0 when lastIso equals today', () => {
    expect(daysSince(TODAY, TODAY)).toBe(0)
  })

  it('returns 7 when lastIso is 7 days before today', () => {
    expect(daysSince(daysAgo(7), TODAY)).toBe(7)
  })

  it('returns 90 when lastIso is 90 days before today', () => {
    expect(daysSince(daysAgo(90), TODAY)).toBe(90)
  })

  it('returns null for invalid date strings', () => {
    expect(daysSince('not-a-date', TODAY)).toBeNull()
  })
})

describe('isPestOverdue', () => {
  it('is overdue when there is no prior visit', () => {
    expect(isPestOverdue(null, TODAY)).toBe(true)
  })

  it('is not overdue when the last visit was today', () => {
    expect(isPestOverdue(TODAY, TODAY)).toBe(false)
  })

  it('is not overdue when the last visit was 89 days ago', () => {
    expect(isPestOverdue(daysAgo(89), TODAY)).toBe(false)
  })

  it('is overdue exactly at the 90-day threshold', () => {
    expect(isPestOverdue(daysAgo(PEST_REMIND_DAYS), TODAY)).toBe(true)
  })

  it('is overdue for a visit 120 days ago', () => {
    expect(isPestOverdue(daysAgo(120), TODAY)).toBe(true)
  })
})

describe('isWasteConfirmationStale', () => {
  it('is stale when never confirmed', () => {
    expect(isWasteConfirmationStale(null, TODAY)).toBe(true)
  })

  it('is not stale when confirmed today', () => {
    expect(isWasteConfirmationStale(TODAY, TODAY)).toBe(false)
  })

  it('is not stale at 29 days old', () => {
    expect(isWasteConfirmationStale(daysAgo(29), TODAY)).toBe(false)
  })

  it('is stale exactly at the 30-day threshold', () => {
    expect(isWasteConfirmationStale(daysAgo(WASTE_STALE_DAYS), TODAY)).toBe(true)
  })

  it('is stale at 31 days old', () => {
    expect(isWasteConfirmationStale(daysAgo(31), TODAY)).toBe(true)
  })
})

describe('SAST date-boundary behavior', () => {
  // When a last-visit date is anchored to a SAST local day and compared against a
  // SAST-local `today`, the helper treats both as midnight-UTC of the given day —
  // so a visit captured yesterday-SAST is exactly 1 day ago, not 0 or 2.
  it('treats same-day SAST strings as 0 days apart regardless of the clock', () => {
    expect(daysSince('2026-04-22', '2026-04-22')).toBe(0)
  })

  it('treats yesterday-SAST as 1 day apart', () => {
    expect(daysSince('2026-04-21', '2026-04-22')).toBe(1)
  })
})

describe('reminder constants are sensible', () => {
  it('pest threshold is 90', () => {
    expect(PEST_REMIND_DAYS).toBe(90)
  })

  it('waste stale threshold is 30', () => {
    expect(WASTE_STALE_DAYS).toBe(30)
  })
})
