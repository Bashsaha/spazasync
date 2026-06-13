import { describe, it, expect } from 'vitest'
import { progressPct } from '@/components/ui/ProgressMeter'

describe('progressPct', () => {
  it('returns an integer 0–100 percentage', () => {
    expect(progressPct(0, 6)).toBe(0)
    expect(progressPct(3, 6)).toBe(50)
    expect(progressPct(6, 6)).toBe(100)
    expect(progressPct(1, 3)).toBe(33)
    expect(progressPct(2, 3)).toBe(67)
  })

  it('clamps out-of-range values', () => {
    expect(progressPct(-1, 6)).toBe(0)
    expect(progressPct(9, 6)).toBe(100)
  })

  it('guards against a zero / negative / non-finite max', () => {
    expect(progressPct(3, 0)).toBe(0)
    expect(progressPct(3, -6)).toBe(0)
    expect(progressPct(3, Number.NaN)).toBe(0)
    expect(progressPct(Number.POSITIVE_INFINITY, 6)).toBe(0)
  })
})
