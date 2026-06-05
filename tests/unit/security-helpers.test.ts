import { describe, it, expect } from 'vitest'
import { sanitizeSearch } from '@/lib/utils/search'
import { safeEqual, bearerMatches } from '@/lib/utils/timing-safe'

describe('sanitizeSearch', () => {
  it('strips PostgREST .or() structural chars (comma, parens)', () => {
    // The injection vector: a comma breaks out of the intended ilike condition.
    expect(sanitizeSearch('x,stock_qty.gt.0')).toBe('x stock_qty.gt.0')
    expect(sanitizeSearch('a(b)c')).toBe('a b c')
  })

  it('preserves dots so realistic searches still match', () => {
    expect(sanitizeSearch('1.5L Coke')).toBe('1.5L Coke')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeSearch('  red   bull  ')).toBe('red bull')
    expect(sanitizeSearch('()')).toBe('') // nothing but structural chars -> empty
  })

  it('leaves a clean term untouched', () => {
    expect(sanitizeSearch('coke 500ml')).toBe('coke 500ml')
  })
})

describe('safeEqual', () => {
  it('is true for identical strings, false otherwise', () => {
    expect(safeEqual('s3cr3t', 's3cr3t')).toBe(true)
    expect(safeEqual('s3cr3t', 's3cr3x')).toBe(false)
    expect(safeEqual('short', 'a-much-longer-value')).toBe(false) // no length throw
    expect(safeEqual('', '')).toBe(true)
  })
})

describe('bearerMatches', () => {
  const SECRET = 'cron-secret-123'

  it('accepts a correct Bearer token', () => {
    expect(bearerMatches(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('rejects a wrong token, missing header, malformed scheme, or unset secret', () => {
    expect(bearerMatches('Bearer wrong', SECRET)).toBe(false)
    expect(bearerMatches(null, SECRET)).toBe(false)
    expect(bearerMatches(SECRET, SECRET)).toBe(false) // no "Bearer " prefix
    expect(bearerMatches('Basic abc', SECRET)).toBe(false)
    expect(bearerMatches(`Bearer ${SECRET}`, undefined)).toBe(false) // fail closed
    expect(bearerMatches(`Bearer ${SECRET}`, '')).toBe(false)
  })
})
