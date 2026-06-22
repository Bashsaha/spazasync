/**
 * Pure match engine for EFT reconciliation. No DB, no clock (caller passes
 * `now`), no env (caller passes `price`) — fully unit-testable.
 *
 * Renewal-aware extension is the core rule: a shop paying EARLY stacks the new
 * period onto its existing end date (never cut short); a LAPSED shop starts
 * fresh from the reactivation day.
 */

import type { ParsedDeposit, ShopSubInfo, ClassifiedDeposit } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS_PER_MONTH = 30

/** Uppercase + strip everything non-alphanumeric. Used for code matching + dedupe. */
export function normalizeRef(s: string): string {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Return every known shop code that appears in the reference.
 * 0 ⇒ unmatched, 1 ⇒ candidate, ≥2 distinct ⇒ ambiguous.
 * Codes are globally unique 6–10 char uppercase alphanumeric, so a substring
 * scan of the normalized reference is reliable.
 */
export function findShopCodes(reference: string, knownCodes: string[]): string[] {
  const norm = normalizeRef(reference)
  if (!norm) return []
  const found = new Set<string>()
  for (const code of knownCodes) {
    if (code && norm.includes(code)) found.add(code)
  }
  return [...found]
}

/**
 * How many whole subscription months an amount represents, or null when it
 * isn't a clean multiple of the monthly price (under/overpayment → review).
 */
export function monthsFromAmount(amount: number, price: number): number | null {
  if (!(amount > 0) || !(price > 0)) return null
  const nearest = Math.round(amount / price)
  if (nearest >= 1 && Math.abs(amount - nearest * price) <= 0.01) return nearest
  return null
}

/**
 * Renewal-aware new end date.
 * - Still has time left (active / manual_override / cancelled with a future
 *   end, or trialing with a future trial end) ⇒ stack onto that end date.
 * - Lapsed / expired / no future date ⇒ start from `now` (reactivation day).
 */
export function computeRenewalEnd(
  shop: Pick<ShopSubInfo, 'subscription_status' | 'subscription_ends_at' | 'trial_ends_at'>,
  months: number,
  now: Date,
): Date {
  const subEnd = shop.subscription_ends_at ? new Date(shop.subscription_ends_at) : null
  const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null
  const status = shop.subscription_status

  let currentUntil: Date | null = null
  if (
    (status === 'active' ||
      status === 'manual_override' ||
      status === 'cancelled' ||
      status === 'processing_cancellation') &&
    subEnd &&
    subEnd.getTime() > now.getTime()
  ) {
    currentUntil = subEnd
  } else if (status === 'trialing' && trialEnd && trialEnd.getTime() > now.getTime()) {
    currentUntil = trialEnd
  }

  const base = currentUntil ?? now
  return new Date(base.getTime() + months * DAYS_PER_MONTH * DAY_MS)
}

/**
 * Stable idempotency key. FNB exports carry no stable cross-export transaction
 * id, so we key on date + amount (in cents) + normalized reference. Two
 * genuinely identical same-day deposits would collide (rare); the admin
 * resolves the second via the existing single-payment UI.
 */
export function dedupeKey(deposit: ParsedDeposit): string {
  return `${deposit.date}|${Math.round(deposit.amount * 100)}|${normalizeRef(deposit.reference)}`
}

/**
 * Classify one deposit against the shop roster + the set of already-applied
 * dedupe keys. A "confident" (auto-appliable) match needs: exactly one code,
 * a clean month multiple, and not already applied.
 */
export function classifyDeposit(
  deposit: ParsedDeposit,
  shopsByCode: Map<string, ShopSubInfo>,
  knownCodes: string[],
  price: number,
  appliedKeys: Set<string>,
): ClassifiedDeposit {
  const key = dedupeKey(deposit)
  const base = {
    deposit,
    dedupeKey: key,
    matchedCode: null as string | null,
    shopId: null as string | null,
    months: null as number | null,
  }

  if (appliedKeys.has(key)) {
    return { ...base, outcome: 'duplicate', reason: 'Already applied in a previous upload' }
  }

  const codes = findShopCodes(deposit.reference, knownCodes)
  if (codes.length === 0) {
    return { ...base, outcome: 'unmatched', reason: 'No shop code found in the reference' }
  }
  if (codes.length > 1) {
    return {
      ...base,
      outcome: 'needs_review',
      reason: `Reference matches more than one shop code (${codes.join(', ')})`,
    }
  }

  const code = codes[0]
  const shop = shopsByCode.get(code)
  if (!shop) {
    return { ...base, outcome: 'unmatched', reason: 'No shop code found in the reference' }
  }

  const months = monthsFromAmount(deposit.amount, price)
  if (months === null) {
    return {
      ...base,
      outcome: 'needs_review',
      matchedCode: code,
      shopId: shop.id,
      reason: 'Amount is not a whole multiple of the monthly price',
    }
  }

  return {
    ...base,
    outcome: 'applied',
    matchedCode: code,
    shopId: shop.id,
    months,
    reason: `${months} month(s)`,
  }
}
