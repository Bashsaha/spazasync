/**
 * UPC-A and EAN-13 are the same code in two representations:
 * UPC-A is 12 digits; EAN-13 is the same code with a leading zero (13 digits).
 *
 * ZXing JS returned UPC-A as the 12-digit form; Chrome's native BarcodeDetector
 * returns it as the 13-digit form. Products may have been stored in either
 * representation depending on when they were scanned. To match either, we
 * generate both candidates at lookup time and `.in()` against the column.
 *
 * EAN-8 (8 digits) and Code-128 / Code-39 (variable) have no alternate form.
 */
export function barcodeCandidates(barcode: string): string[] {
  const trimmed = barcode.trim()
  if (!trimmed) return []
  if (/^\d{13}$/.test(trimmed) && trimmed.startsWith('0')) {
    return [trimmed, trimmed.slice(1)]
  }
  if (/^\d{12}$/.test(trimmed)) {
    return [trimmed, '0' + trimmed]
  }
  return [trimmed]
}
