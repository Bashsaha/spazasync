import { describe, it, expect } from 'vitest'
import {
  fridgeInRange,
  freezerInRange,
  computeChecklistStats,
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
    expired_items_action: 'none_found',
    completed_by: 'u',
    completed_at: '2026-04-19T06:00:00Z',
    updated_at: '2026-04-19T06:00:00Z',
    ...overrides,
  }
}

describe('fridgeInRange (R638 1–5°C)', () => {
  it('accepts 1°C (lower bound)', () => {
    expect(fridgeInRange(1)).toBe(true)
  })
  it('accepts 5°C (upper bound)', () => {
    expect(fridgeInRange(5)).toBe(true)
  })
  it('rejects 0.9°C', () => {
    expect(fridgeInRange(0.9)).toBe(false)
  })
  it('rejects 5.1°C', () => {
    expect(fridgeInRange(5.1)).toBe(false)
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
