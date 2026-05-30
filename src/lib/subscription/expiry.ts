/**
 * Single source of truth for "has this shop's subscription expired / should
 * access be denied".
 *
 * Two call sites must agree, or paid shops get locked out / expired shops slip
 * through (the exact class of bug BUG-047 was about):
 *   1. The OWNER subscription gate in `proxy.ts` — reads JWT `app_metadata`
 *      (`sub_status` / `sub_until` / `access_granted`).
 *   2. The TELLER lockout check in `(app)/layout.tsx` + the `/shop-suspended`
 *      page — reads the LIVE `shops` row (`subscription_status` /
 *      `trial_ends_at` / `subscription_ends_at` / `access_granted`).
 *
 * Keeping the decision here (pure, zero deps so it stays edge-safe for the
 * proxy) guarantees the two sites can't drift.
 */

/**
 * Map a shop's subscription columns to the single "end date" that matters,
 * mirroring `updateShopUsersSubscription()` / `provisionTellerAccount()`'s
 * `sub_until` rule: a trialing shop is bounded by `trial_ends_at`, anything
 * else by `subscription_ends_at`. This is what lets the teller's shop-derived
 * input line up with the owner's JWT-derived `sub_until`.
 */
export function subscriptionEndDate(
  status: string | null | undefined,
  trialEndsAt: string | null | undefined,
  subscriptionEndsAt: string | null | undefined,
): string | null {
  const end = status === 'trialing' ? trialEndsAt : subscriptionEndsAt
  return end ?? null
}

export interface SubscriptionState {
  /** subscription_status (shop row) or sub_status (JWT metadata). */
  status: string | null | undefined
  /** The relevant end date — see subscriptionEndDate() / JWT sub_until. */
  subUntil: string | null | undefined
  /** access_granted — the admin override that keeps access despite expiry. */
  accessGranted: boolean | null | undefined
}

/**
 * True when the subscription should be treated as expired / access denied.
 *
 * Allow-list logic (identical to the owner gate's long-standing rule):
 *   - 'active' or 'manual_override' with a future `subUntil` OR no `subUntil`
 *     at all (PayFast recurring renews each cycle; an admin override can be
 *     indefinite) → NOT expired.
 *   - any other status ('trialing' / 'cancelled' / …) → needs a future
 *     `subUntil` to stay alive.
 *   - a missing / empty `subUntil` on a non-active status is a corrupted state
 *     and is treated as expired (every trial / cancelled sub MUST carry an end
 *     date) — without this, a blank `sub_until` silently bypasses the gate.
 *
 * `access_granted` overrides everything: an admin-granted shop is never locked
 * out even if the dates say expired.
 */
export function isSubscriptionExpired(
  { status, subUntil, accessGranted }: SubscriptionState,
  now: Date = new Date(),
): boolean {
  const subUntilDate = subUntil ? new Date(subUntil) : null
  const hasFutureUntil = subUntilDate ? subUntilDate.getTime() > now.getTime() : false

  const isActiveLike =
    (status === 'active' && (hasFutureUntil || !subUntilDate)) ||
    (status === 'manual_override' && (hasFutureUntil || !subUntilDate))

  const isOtherWithFutureUntil =
    hasFutureUntil &&
    status !== 'expired' &&
    status !== 'active' &&
    status !== 'manual_override'

  const expired = !(isActiveLike || isOtherWithFutureUntil)

  return expired && !accessGranted
}
