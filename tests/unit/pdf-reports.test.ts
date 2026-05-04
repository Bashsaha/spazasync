/**
 * Phase 37d — unit tests for the document-generation helpers.
 *
 * These tests cover the pure helpers (`assertNoSensitiveValues`, the goods
 * description used by all PDFs). The PDF route handlers themselves are I/O
 * orchestrators around `jsPDF` — exercised manually + by the existing
 * compliance-pdf integration; we don't snapshot the binary output.
 *
 * The single most important assertion here is the Design Rule 6 guard:
 * any FormRow with an "ID/passport/tax number" label MUST stay blank.
 */

import { describe, expect, it } from 'vitest'
import { assertNoSensitiveValues, type FormRow } from '@/lib/pdf/shared'
import { generateGoodsDescription } from '@/lib/compliance/goods-description'

describe('assertNoSensitiveValues — Design Rule 6 enforcement', () => {
  it('passes when sensitive rows are blank', () => {
    const rows: FormRow[] = [
      { label: 'Full name', value: 'Alice' },
      { label: 'ID number', value: null, blank: true, hint: 'fill in' },
      { label: 'Passport', value: null, blank: true },
      { label: 'Tax number', value: null, blank: true },
    ]
    expect(() => assertNoSensitiveValues(rows)).not.toThrow()
  })

  it('passes when sensitive rows are missing entirely', () => {
    const rows: FormRow[] = [
      { label: 'Full name', value: 'Alice' },
      { label: 'Phone', value: '0712345678' },
    ]
    expect(() => assertNoSensitiveValues(rows)).not.toThrow()
  })

  it('throws if an ID number row carries a value', () => {
    const rows: FormRow[] = [
      { label: 'ID number', value: '8001015009087' },
    ]
    expect(() => assertNoSensitiveValues(rows)).toThrow(/Design Rule 6/)
  })

  it('throws if a passport number row carries a value', () => {
    const rows: FormRow[] = [
      { label: 'Passport number', value: 'A12345678' },
    ]
    expect(() => assertNoSensitiveValues(rows)).toThrow(/Design Rule 6/)
  })

  it('throws if a tax number row carries a value', () => {
    const rows: FormRow[] = [
      { label: 'Tax number', value: '1234567890' },
    ]
    expect(() => assertNoSensitiveValues(rows)).toThrow(/Design Rule 6/)
  })

  it('throws on case-insensitive label matches', () => {
    const rows: FormRow[] = [
      { label: 'SA ID Number', value: '8001015009087' },
    ]
    expect(() => assertNoSensitiveValues(rows)).toThrow(/Design Rule 6/)
  })

  it('treats a blank=true row as safe even with a stray value', () => {
    // `blank: true` forces the renderer to skip the value, so we don't
    // bother flagging it. The renderer is the source of truth.
    const rows: FormRow[] = [
      { label: 'ID number', value: 'leftover from old code', blank: true },
    ]
    expect(() => assertNoSensitiveValues(rows)).not.toThrow()
  })
})

describe('generateGoodsDescription — used by all trading-permit and CoA PDFs', () => {
  it('falls back to a generic description for an empty catalogue', () => {
    expect(generateGoodsDescription([])).toMatch(/Groceries/)
  })

  it('falls back when no products match any keyword bucket', () => {
    expect(generateGoodsDescription(['Widget A', 'Widget B'])).toMatch(/Groceries/)
  })

  it('returns a single bucket label when only one matches', () => {
    expect(generateGoodsDescription(['Coke 500ml'])).toBe('Cold drinks')
  })

  it('joins two buckets with "and"', () => {
    expect(generateGoodsDescription(['Coke', 'Bread'])).toBe(
      'Bread and dairy and Cold drinks',
    )
  })

  it('joins multiple buckets with comma + Oxford "and"', () => {
    const result = generateGoodsDescription(['Coke', 'Bread', 'Soap', 'Rice'])
    // Order is dictated by BUCKETS array, not input order.
    expect(result).toContain('Bread and dairy')
    expect(result).toContain('Cold drinks')
    expect(result).toContain('Cleaning and household')
    expect(result).toContain('Tinned and dry groceries')
    expect(result).toMatch(/, and /)
  })
})
