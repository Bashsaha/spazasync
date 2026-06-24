import { describe, it, expect } from 'vitest'
import {
  fridgeInRange,
  freezerInRange,
  computeChecklistStats,
  computeChecklistStreak,
} from '@/lib/checklist/stats'
import type { DailyChecklist } from '@/types'

function row(overrides: Partial<DailyChecklist> = {}): DailyChecklist {
  return {
    id: 'r',
    shop_id: 's',
    date: '2026-04-19',
    fridge_ok: true,
    fridge_temp: null,
    freezer_ok: true,
    freezer_temp: null,
    surfaces_cleaned: true,
    floor_cleaned: true,
    storage_clean: true,
    waste_bins_ok: null,
    expired_items_action: 'none_found',
    completed_by: 'u',
    completed_at: '2026-04-19T06:00:00Z',
    updated_at: '2026-04-19T06:00:00Z',
    ...overrides,
  }
}

describe('fridgeInRange (R638 ≤5°C upper limit only — no lower bound in regulation)', () => {
  it('accepts -5°C (very cold fridge — not a violation)', () => {
    expect(fridgeInRange(-5)).toBe(true)
  })
  it('accepts 0°C (near-freezing fridge — not a violation)', () => {
    expect(fridgeInRange(0)).toBe(true)
  })
  it('accepts 1°C', () => {
    expect(fridgeInRange(1)).toBe(true)
  })
  it('accepts 5°C (upper bound)', () => {
    expect(fridgeInRange(5)).toBe(true)
  })
  it('rejects 5.1°C (above limit)', () => {
    expect(fridgeInRange(5.1)).toBe(false)
  })
  it('rejects 8°C', () => {
    expect(fridgeInRange(8)).toBe(false)
  })
  it('treats null as not-flagged (true)', () => {
    expect(fridgeInRange(null)).toBe(true)
  })
})

describe('freezerInRange (R638 ≤ -18°C)', () => {
  it('accepts -18°C (boundary)', () => {
    expect(freezerInRange(-18)).toBe(true)
  })
  it('accepts -25°C', () => {
    expect(freezerInRange(-25)).toBe(true)
  })
  it('rejects -17.9°C', () => {
    expect(freezerInRange(-17.9)).toBe(false)
  })
  it('rejects 0°C', () => {
    expect(freezerInRange(0)).toBe(false)
  })
  it('treats null as not-flagged (true)', () => {
    expect(freezerInRange(null)).toBe(true)
  })
})

describe('computeChecklistStats', () => {
  it('returns zeroes when rows is empty', () => {
    const s = computeChecklistStats([], 30)
    expect(s.completedDays).toBe(0)
    expect(s.totalDays).toBe(30)
    expect(s.compliancePct).toBe(0)
    expect(s.cleaningRate).toBe(0)
    expect(s.avgFridgeTemp).toBeNull()
    expect(s.avgFreezerTemp).toBeNull()
    expect(s.outOfRangeDays).toBe(0)
  })

  it('computes compliance % across window', () => {
    const rows = [row({ date: '2026-04-19' }), row({ date: '2026-04-18' }), row({ date: '2026-04-17' })]
    const s = computeChecklistStats(rows, 30)
    expect(s.completedDays).toBe(3)
    expect(s.compliancePct).toBe(10) // 3/30 = 10%
  })

  it('counts cleaning rate only when all 3 booleans are true', () => {
    const rows = [
      row({ surfaces_cleaned: true, floor_cleaned: true, storage_clean: true }),
      row({ surfaces_cleaned: true, floor_cleaned: true, storage_clean: false }),
      row({ surfaces_cleaned: false, floor_cleaned: false, storage_clean: false }),
      row({ surfaces_cleaned: true, floor_cleaned: true, storage_clean: true }),
    ]
    const s = computeChecklistStats(rows, 30)
    expect(s.cleaningRate).toBe(50) // 2 of 4 completed days
  })

  it('averages fridge and freezer temps (ignoring nulls), rounded to 1 decimal', () => {
    const rows = [
      row({ fridge_temp: 4.0, freezer_temp: -20.0 }),
      row({ fridge_temp: 6.0, freezer_temp: -18.0 }),
      row({ fridge_temp: null, freezer_temp: null }),
    ]
    const s = computeChecklistStats(rows, 30)
    expect(s.avgFridgeTemp).toBe(5.0)
    expect(s.avgFreezerTemp).toBe(-19.0)
  })

  it('counts out-of-range days for fridge outside 1–5 or freezer above -18', () => {
    const rows = [
      row({ fridge_temp: 4, freezer_temp: -20 }),  // fine
      row({ fridge_temp: 7, freezer_temp: -20 }),  // fridge too warm
      row({ fridge_temp: 3, freezer_temp: -15 }),  // freezer too warm
      row({ fridge_temp: 9, freezer_temp: -10 }),  // both bad, counted once
    ]
    const s = computeChecklistStats(rows, 30)
    expect(s.outOfRangeDays).toBe(3)
  })

  it('ignores null temps in out-of-range tally', () => {
    const rows = [
      row({ fridge_temp: null, freezer_temp: null }),
      row({ fridge_temp: null, freezer_temp: null }),
    ]
    const s = computeChecklistStats(rows, 30)
    expect(s.outOfRangeDays).toBe(0)
  })
})

describe('computeChecklistStreak', () => {
  const today = '2026-06-24'

  it('returns 0 with no dates', () => {
    expect(computeChecklistStreak([], today)).toEqual({ streak: 0, completedToday: false })
  })

  it('counts a run ending today', () => {
    const r = computeChecklistStreak(['2026-06-24', '2026-06-23', '2026-06-22'], today)
    expect(r).toEqual({ streak: 3, completedToday: true })
  })

  it('keeps the streak alive when today is not done but yesterday was', () => {
    const r = computeChecklistStreak(['2026-06-23', '2026-06-22'], today)
    expect(r).toEqual({ streak: 2, completedToday: false })
  })

  it('breaks to 0 when the most recent day is two days ago (a full day missed)', () => {
    const r = computeChecklistStreak(['2026-06-22', '2026-06-21'], today)
    expect(r).toEqual({ streak: 0, completedToday: false })
  })

  it('stops at the first gap', () => {
    // today, yesterday, then a gap (skips the 22nd) — older days don't count
    const r = computeChecklistStreak(['2026-06-24', '2026-06-23', '2026-06-21', '2026-06-20'], today)
    expect(r).toEqual({ streak: 2, completedToday: true })
  })

  it('is robust to duplicates and unsorted input', () => {
    const r = computeChecklistStreak(['2026-06-23', '2026-06-24', '2026-06-24', '2026-06-22'], today)
    expect(r).toEqual({ streak: 3, completedToday: true })
  })

  it('handles a single day done today', () => {
    expect(computeChecklistStreak(['2026-06-24'], today)).toEqual({ streak: 1, completedToday: true })
  })

  it('crosses a month boundary correctly', () => {
    const r = computeChecklistStreak(['2026-07-01', '2026-06-30', '2026-06-29'], '2026-07-01')
    expect(r).toEqual({ streak: 3, completedToday: true })
  })
})
