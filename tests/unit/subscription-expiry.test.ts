import { describe, it, expect } from 'vitest'
import {
  isSubscriptionExpired,
  subscriptionEndDate,
} from '@/lib/subscription/expiry'

const NOW = new Date('2026-06-01T00:00:00.000Z')
const FUTURE = '2026-07-01T00:00:00.000Z'
const PAST = '2026-05-01T00:00:00.000Z'

describe('subscriptionEndDate()', () => {
  it('uses trial_ends_at for a trialing shop', () => {
    expect(subscriptionEndDate('trialing', FUTURE, PAST)).toBe(FUTURE)
  })

  it('uses subscription_ends_at for any non-trialing status', () => {
    expect(subscriptionEndDate('active', FUTURE, PAST)).toBe(PAST)
    expect(subscriptionEndDate('cancelled', FUTURE, PAST)).toBe(PAST)
    expect(subscriptionEndDate('expired', FUTURE, PAST)).toBe(PAST)
    expect(subscriptionEndDate('manual_override', FUTURE, PAST)).toBe(PAST)
  })

  it('returns null when the relevant date is absent', () => {
    expect(subscriptionEndDate('trialing', null, PAST)).toBeNull()
    expect(subscriptionEndDate('active', FUTURE, null)).toBeNull()
    expect(subscriptionEndDate('active', FUTURE, undefined)).toBeNull()
  })
})

describe('isSubscriptionExpired()', () => {
  const expired = (state: Parameters<typeof isSubscriptionExpired>[0]) =>
    isSubscriptionExpired(state, NOW)

  // ── active-like (PayFast recurring / admin override) ──────────────────────
  it('active with a future date is NOT expired', () => {
    expect(expired({ status: 'active', subUntil: FUTURE, accessGranted: false })).toBe(false)
  })

  it('active with NO date is NOT expired (ITN renews each cycle)', () => {
    expect(expired({ status: 'active', subUntil: null, accessGranted: false })).toBe(false)
  })

  it('active with a PAST date IS expired (renewal lapsed)', () => {
    expect(expired({ status: 'active', subUntil: PAST, accessGranted: false })).toBe(true)
  })

  it('manual_override with NO date is NOT expired (indefinite grant)', () => {
    expect(expired({ status: 'manual_override', subUntil: null, accessGranted: false })).toBe(false)
  })

  it('manual_override with a future date is NOT expired', () => {
    expect(expired({ status: 'manual_override', subUntil: FUTURE, accessGranted: false })).toBe(false)
  })

  it('manual_override with a past date IS expired', () => {
    expect(expired({ status: 'manual_override', subUntil: PAST, accessGranted: false })).toBe(true)
  })

  // ── trialing / cancelled need a future date ───────────────────────────────
  it('trialing with a future date is NOT expired', () => {
    expect(expired({ status: 'trialing', subUntil: FUTURE, accessGranted: false })).toBe(false)
  })

  it('trialing with a past date IS expired', () => {
    expect(expired({ status: 'trialing', subUntil: PAST, accessGranted: false })).toBe(true)
  })

  it('cancelled with a future date is NOT expired (access until period end)', () => {
    expect(expired({ status: 'cancelled', subUntil: FUTURE, accessGranted: false })).toBe(false)
  })

  it('cancelled with a past date IS expired', () => {
    expect(expired({ status: 'cancelled', subUntil: PAST, accessGranted: false })).toBe(true)
  })

  // ── explicit expired status ──────────────────────────────────────────────
  it('status "expired" IS expired even with a future date', () => {
    expect(expired({ status: 'expired', subUntil: FUTURE, accessGranted: false })).toBe(true)
  })

  // ── corrupted / missing date on a non-active status ──────────────────────
  it('missing date on a non-active status IS expired (corrupted state)', () => {
    expect(expired({ status: 'trialing', subUntil: null, accessGranted: false })).toBe(true)
    expect(expired({ status: 'trialing', subUntil: undefined, accessGranted: false })).toBe(true)
  })

  it('empty-string date (provisionTellerAccount default) IS treated as missing', () => {
    expect(expired({ status: 'trialing', subUntil: '', accessGranted: false })).toBe(true)
    // and active with empty string falls back to the no-date branch → NOT expired
    expect(expired({ status: 'active', subUntil: '', accessGranted: false })).toBe(false)
  })

  // ── access_granted override ──────────────────────────────────────────────
  it('access_granted keeps access even when the dates say expired', () => {
    expect(expired({ status: 'expired', subUntil: PAST, accessGranted: true })).toBe(false)
    expect(expired({ status: 'trialing', subUntil: PAST, accessGranted: true })).toBe(false)
    expect(expired({ status: 'trialing', subUntil: null, accessGranted: true })).toBe(false)
  })

  it('null/undefined accessGranted behaves like false (no override)', () => {
    expect(expired({ status: 'expired', subUntil: PAST, accessGranted: null })).toBe(true)
    expect(expired({ status: 'expired', subUntil: PAST, accessGranted: undefined })).toBe(true)
  })
})
