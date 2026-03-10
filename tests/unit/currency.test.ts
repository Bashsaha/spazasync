import { describe, it, expect } from 'vitest'
import {
  formatZAR,
  parsePrice,
  calcSubtotal,
  calcTotal,
} from '@/lib/utils/currency'

describe('formatZAR', () => {
  it('formats a whole number', () => {
    expect(formatZAR(10)).toMatch(/10/)
  })

  it('formats cents correctly', () => {
    expect(formatZAR(12.5)).toMatch(/12/)
    expect(formatZAR(12.5)).toMatch(/50/)
  })

  it('formats zero', () => {
    expect(formatZAR(0)).toMatch(/0/)
  })
})

describe('parsePrice', () => {
  it('parses a valid decimal string', () => {
    expect(parsePrice('12.50')).toBe(12.5)
  })

  it('parses a comma decimal separator', () => {
    expect(parsePrice('12,50')).toBe(12.5)
  })

  it('parses whole numbers', () => {
    expect(parsePrice('5')).toBe(5)
  })

  it('returns null for non-numeric input', () => {
    expect(parsePrice('abc')).toBeNull()
  })

  it('returns null for negative values', () => {
    expect(parsePrice('-1')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parsePrice('')).toBeNull()
  })

  it('rounds to 2 decimal places', () => {
    expect(parsePrice('9.999')).toBe(10)
  })
})

describe('calcSubtotal', () => {
  it('multiplies quantity × price', () => {
    expect(calcSubtotal(3, 5)).toBe(15)
  })

  it('handles decimal prices without float drift', () => {
    expect(calcSubtotal(3, 1.1)).toBe(3.3)
  })

  it('handles single unit', () => {
    expect(calcSubtotal(1, 19.99)).toBe(19.99)
  })
})

describe('calcTotal', () => {
  it('sums an array of subtotals', () => {
    expect(calcTotal([10, 5, 2.5])).toBe(17.5)
  })

  it('handles an empty array', () => {
    expect(calcTotal([])).toBe(0)
  })

  it('avoids floating-point drift across multiple items', () => {
    // 0.1 + 0.2 = 0.30000000000000004 without integer arithmetic
    expect(calcTotal([0.1, 0.2])).toBe(0.3)
  })
})
