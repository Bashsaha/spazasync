import { describe, it, expect } from 'vitest'
import { isValidBarcode, isValidGS1Checksum } from '@/lib/barcode/validate'

describe('isValidGS1Checksum', () => {
  it('accepts known-good EAN-13', () => {
    expect(isValidGS1Checksum('6001065000176')).toBe(true) // Coke 330ml SA
    expect(isValidGS1Checksum('5901234123457')).toBe(true)
  })
  it('rejects EAN-13 with bad check digit', () => {
    expect(isValidGS1Checksum('6001065000170')).toBe(false)
    expect(isValidGS1Checksum('6001065000175')).toBe(false)
  })
  it('accepts known-good EAN-8 and UPC-A', () => {
    expect(isValidGS1Checksum('96385074')).toBe(true) // EAN-8
    expect(isValidGS1Checksum('036000291452')).toBe(true) // UPC-A
  })
  it('rejects non-digits', () => {
    expect(isValidGS1Checksum('60010650001A5')).toBe(false)
  })
})

describe('isValidBarcode', () => {
  it('rejects partial EAN-13 (11 digits) on unknown format', () => {
    expect(isValidBarcode('60010650001', null)).toBe(false)
  })
  it('rejects partial EAN-13 when format is ean_13', () => {
    expect(isValidBarcode('60010650001', 'ean_13')).toBe(false)
  })
  it('accepts full valid EAN-13', () => {
    expect(isValidBarcode('6001065000176', 'ean_13')).toBe(true)
    expect(isValidBarcode('6001065000176', null)).toBe(true)
  })
  it('rejects valid-length EAN-13 with bad checksum', () => {
    expect(isValidBarcode('6001065000170', 'ean_13')).toBe(false)
    expect(isValidBarcode('6001065000175', 'ean_13')).toBe(false)
  })
  it('passes non-numeric payloads (QR, Code-128 text)', () => {
    expect(isValidBarcode('https://example.com', null)).toBe(true)
    expect(isValidBarcode('PRODUCT-XYZ-42', null)).toBe(true)
  })
  it('rejects empty string', () => {
    expect(isValidBarcode('', null)).toBe(false)
  })
  it('UPC-E 6-digit form bypasses checksum', () => {
    expect(isValidBarcode('123456', 'upc_e')).toBe(true)
  })
})
