/**
 * Currency utilities for Movestock.
 * All amounts are stored in ZAR (South African Rand) as NUMERIC(10,2).
 * Display formatting uses the Intl API with `af-ZA` locale and `ZAR` currency.
 */

const ZAR_FORMATTER = new Intl.NumberFormat('af-ZA', {
  style: 'currency',
  currency: 'ZAR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format a number as a ZAR currency string.
 * @example formatZAR(12.5) → "R 12,50"
 */
export function formatZAR(amount: number): string {
  return ZAR_FORMATTER.format(amount)
}

/**
 * Safely parse a user-entered price string to a number with 2 decimal places.
 * Returns null if the input is not a valid positive number.
 * @example parsePrice("12.50") → 12.50
 * @example parsePrice("abc")   → null
 */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(',', '.')
  const value = parseFloat(cleaned)
  if (isNaN(value) || value < 0) return null
  return Math.round(value * 100) / 100
}

/**
 * Multiply quantity × unit price, rounded to 2 decimal places.
 * Avoids floating-point drift.
 */
export function calcSubtotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

/**
 * Sum an array of subtotals, rounded to 2 decimal places.
 */
export function calcTotal(subtotals: number[]): number {
  const sum = subtotals.reduce((acc, val) => acc + Math.round(val * 100), 0)
  return sum / 100
}
