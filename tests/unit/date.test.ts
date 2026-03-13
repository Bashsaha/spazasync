import { describe, it, expect } from 'vitest'
import { nowSAST, formatSAST, startOfTodaySAST, endOfTodaySAST, shortDate, shortTime, isToday } from '@/lib/utils/date'

// SAST = Africa/Johannesburg = UTC+2 (no DST, always UTC+2)

describe('nowSAST', () => {
  it('returns a valid Date object', () => {
    const d = nowSAST()
    expect(d).toBeInstanceOf(Date)
    expect(isNaN(d.getTime())).toBe(false)
  })
})

describe('formatSAST', () => {
  // 2026-03-12 20:00 UTC = 2026-03-12 22:00 SAST
  const UTC_8PM = new Date('2026-03-12T20:00:00Z')

  it('formats time correctly in SAST (UTC+2)', () => {
    const result = formatSAST(UTC_8PM, 'HH:mm')
    expect(result).toBe('22:00')
  })

  it('formats date correctly in SAST', () => {
    const result = formatSAST(UTC_8PM, 'dd MMM yyyy')
    expect(result).toBe('12 Mar 2026')
  })

  it('accepts ISO string input', () => {
    const result = formatSAST('2026-03-12T20:00:00Z', 'HH:mm')
    expect(result).toBe('22:00')
  })

  // 2026-03-12 22:00 UTC = 2026-03-13 00:00 SAST (midnight next day)
  it('crosses midnight correctly: 22:00 UTC = 00:00 SAST next day', () => {
    const UTC_10PM = new Date('2026-03-12T22:00:00Z')
    const result = formatSAST(UTC_10PM, 'dd MMM yyyy HH:mm')
    expect(result).toBe('13 Mar 2026 00:00')
  })
})

describe('startOfTodaySAST', () => {
  it('returns a Date', () => {
    const d = startOfTodaySAST()
    expect(d).toBeInstanceOf(Date)
    expect(isNaN(d.getTime())).toBe(false)
  })

  it('hour is 0 in SAST', () => {
    const d = startOfTodaySAST()
    const sastHour = parseInt(formatSAST(d, 'HH'), 10)
    expect(sastHour).toBe(0)
  })

  it('minute is 0 in SAST', () => {
    const d = startOfTodaySAST()
    const sastMinute = parseInt(formatSAST(d, 'mm'), 10)
    expect(sastMinute).toBe(0)
  })
})

describe('endOfTodaySAST', () => {
  it('returns a Date', () => {
    const d = endOfTodaySAST()
    expect(d).toBeInstanceOf(Date)
  })

  it('hour is 23 in SAST', () => {
    const d = endOfTodaySAST()
    const sastHour = parseInt(formatSAST(d, 'HH'), 10)
    expect(sastHour).toBe(23)
  })

  it('is after startOfTodaySAST', () => {
    expect(endOfTodaySAST().getTime()).toBeGreaterThan(startOfTodaySAST().getTime())
  })
})

describe('shortDate', () => {
  it('formats as "Day, dd Mon"', () => {
    const result = shortDate(new Date('2026-03-12T20:00:00Z')) // Thu 22:00 SAST
    expect(result).toBe('Thu, 12 Mar')
  })

  it('accepts a string input', () => {
    const result = shortDate('2026-03-12T20:00:00Z')
    expect(result).toBe('Thu, 12 Mar')
  })
})

describe('shortTime', () => {
  it('formats as HH:mm in SAST', () => {
    const result = shortTime(new Date('2026-03-12T20:00:00Z'))
    expect(result).toBe('22:00')
  })
})

describe('isToday', () => {
  it('returns true for a timestamp in the current SAST day', () => {
    // Use a recent known-good ISO string that matches "today" relative to test run.
    // We test the logic: if we format now() and create a new Date from it, isToday should be true.
    const nowIso = new Date().toISOString()
    expect(isToday(nowIso)).toBe(true)
  })

  it('returns false for a timestamp clearly in the past', () => {
    expect(isToday('2020-01-01T00:00:00Z')).toBe(false)
  })

  it('returns false for a timestamp in the future', () => {
    expect(isToday('2099-12-31T23:59:59Z')).toBe(false)
  })
})
