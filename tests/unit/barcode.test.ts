import { describe, it, expect } from 'vitest'
import { barcodeCandidates } from '@/lib/utils/barcode'

describe('barcodeCandidates', () => {
  it('expands a 12-digit UPC-A to include its 13-digit EAN-13 form', () => {
    expect(barcodeCandidates('028400090193')).toEqual(['028400090193', '0028400090193'])
  })

  it('expands a 13-digit leading-zero EAN-13 to include its 12-digit UPC-A form', () => {
    expect(barcodeCandidates('0028400090193')).toEqual(['0028400090193', '028400090193'])
  })

  it('does not expand a 13-digit non-leading-zero EAN-13 (genuine SA/EU code)', () => {
    expect(barcodeCandidates('6001234567890')).toEqual(['6001234567890'])
  })

  it('passes EAN-8 through unchanged — no alternate form exists', () => {
    expect(barcodeCandidates('12345670')).toEqual(['12345670'])
  })

  it('passes Code-128 / alphanumeric codes through unchanged', () => {
    expect(barcodeCandidates('ABC-123')).toEqual(['ABC-123'])
  })

  it('trims whitespace and rejects empty input', () => {
    expect(barcodeCandidates('  ')).toEqual([])
    expect(barcodeCandidates('')).toEqual([])
  })
})
