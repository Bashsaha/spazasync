/**
 * Pure barcode validators — used by useScanner to reject partial misreads.
 * No React, no DOM, no browser APIs — testable in isolation.
 */

const NUMERIC_LENGTHS: Record<string, number[]> = {
  ean_13: [13],
  ean_8: [8],
  upc_a: [12],
  upc_e: [6, 8],
}

/** GS1 mod-10 check digit. Valid for EAN-13, EAN-8, UPC-A. */
export function isValidGS1Checksum(code: string): boolean {
  if (!/^\d+$/.test(code)) return false
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  let sum = 0
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w
  }
  return (10 - (sum % 10)) % 10 === check
}

/** Returns true if the decoded value passes per-format length + checksum.
 *  Pass `format=null` to auto-detect by digit count (ZXing path).
 *  Non-numeric payloads (QR text, alphanumeric Code-128) pass unchanged —
 *  those decoders are framing-aware and don't produce partial reads. */
export function isValidBarcode(raw: string, format: string | null): boolean {
  if (raw.length === 0) return false
  if (!/^\d+$/.test(raw)) return true
  if (format && NUMERIC_LENGTHS[format]) {
    if (!NUMERIC_LENGTHS[format].includes(raw.length)) return false
    if (format === 'upc_e' && raw.length === 6) return true
    return isValidGS1Checksum(raw)
  }
  const allLengths = new Set([8, 12, 13])
  if (!allLengths.has(raw.length)) return false
  return isValidGS1Checksum(raw)
}
