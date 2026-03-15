import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// We test the pure functions directly by importing them
// The module reads env vars, so we mock them
beforeEach(() => {
  vi.stubEnv('PAYFAST_MERCHANT_ID', '10000100')
  vi.stubEnv('PAYFAST_MERCHANT_KEY', '46f0cd694581a')
  vi.stubEnv('PAYFAST_PASSPHRASE', 'jt7NOE43FZPn')
  vi.stubEnv('PAYFAST_SANDBOX', 'true')
  vi.stubEnv('SUBSCRIPTION_PRICE_ZAR', '349.99')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://test.spazasync.app')
})

describe('generateSignature', () => {
  it('generates correct MD5 signature without passphrase', async () => {
    const { generateSignature } = await import('@/lib/payfast')

    const params = {
      merchant_id: '10000100',
      merchant_key: '46f0cd694581a',
      amount: '100.00',
      item_name: 'Test Item',
    }

    const sig = generateSignature(params)

    // Manually compute expected: merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test+Item
    const expected = crypto
      .createHash('md5')
      .update('merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test+Item')
      .digest('hex')

    expect(sig).toBe(expected)
  })

  it('generates correct MD5 signature with passphrase', async () => {
    const { generateSignature } = await import('@/lib/payfast')

    const params = {
      merchant_id: '10000100',
      amount: '50.00',
    }

    const sig = generateSignature(params, 'secret123')

    const expected = crypto
      .createHash('md5')
      .update('merchant_id=10000100&amount=50.00&passphrase=secret123')
      .digest('hex')

    expect(sig).toBe(expected)
  })

  it('skips empty string values', async () => {
    const { generateSignature } = await import('@/lib/payfast')

    const params = {
      merchant_id: '10000100',
      name_last: '',
      amount: '99.00',
    }

    const sig = generateSignature(params)

    // name_last should be excluded
    const expected = crypto
      .createHash('md5')
      .update('merchant_id=10000100&amount=99.00')
      .digest('hex')

    expect(sig).toBe(expected)
  })

  it('URL-encodes special characters and replaces %20 with +', async () => {
    const { generateSignature } = await import('@/lib/payfast')

    const params = {
      item_name: 'SpazaSync Monthly Plan',
    }

    const sig = generateSignature(params)

    const expected = crypto
      .createHash('md5')
      .update('item_name=SpazaSync+Monthly+Plan')
      .digest('hex')

    expect(sig).toBe(expected)
  })
})

describe('buildCheckoutParams', () => {
  it('builds params with correct fields', async () => {
    const { buildCheckoutParams } = await import('@/lib/payfast')

    const params = buildCheckoutParams({
      shopId: 'shop-123',
      userEmail: 'owner@example.com',
      userName: 'John Smith',
      appUrl: 'https://test.spazasync.app',
    })

    expect(params.merchant_id).toBe('10000100')
    expect(params.merchant_key).toBe('46f0cd694581a')
    expect(params.m_payment_id).toBe('shop-123')
    expect(params.email_address).toBe('owner@example.com')
    expect(params.name_first).toBe('John')
    expect(params.name_last).toBe('Smith')
    expect(params.amount).toBe('349.99')
    expect(params.recurring_amount).toBe('349.99')
    expect(params.item_name).toBe('SpazaSync Monthly Plan')
    expect(params.subscription_type).toBe('1')
    expect(params.frequency).toBe('3')
    expect(params.cycles).toBe('0')
    expect(params.return_url).toBe('https://test.spazasync.app/subscribe?status=success')
    expect(params.cancel_url).toBe('https://test.spazasync.app/subscribe?status=cancelled')
    expect(params.notify_url).toBe('https://test.spazasync.app/api/subscribe/notify')
    expect(params.signature).toBeDefined()
    expect(params.signature).toHaveLength(32) // MD5 hex
  })

  it('handles single-word names', async () => {
    const { buildCheckoutParams } = await import('@/lib/payfast')

    const params = buildCheckoutParams({
      shopId: 'shop-456',
      userEmail: 'test@example.com',
      userName: 'Maria',
      appUrl: 'https://test.spazasync.app',
    })

    expect(params.name_first).toBe('Maria')
    // name_last should be empty and excluded from clean params
    expect(params.name_last).toBeUndefined()
  })
})

describe('isPayFastIP', () => {
  it('accepts any IP in sandbox mode', async () => {
    vi.stubEnv('PAYFAST_SANDBOX', 'true')
    const { isPayFastIP } = await import('@/lib/payfast')

    expect(isPayFastIP('192.168.1.1')).toBe(true)
    expect(isPayFastIP('10.0.0.1')).toBe(true)
  })

  it('validates PayFast IP ranges in production mode', async () => {
    vi.stubEnv('PAYFAST_SANDBOX', 'false')
    // Need fresh import since SANDBOX_MODE is a function
    vi.resetModules()
    const { isPayFastIP } = await import('@/lib/payfast')

    // 197.97.145.144/28 = 197.97.145.144 – 197.97.145.159
    expect(isPayFastIP('197.97.145.145')).toBe(true)
    expect(isPayFastIP('197.97.145.159')).toBe(true)

    // Outside range
    expect(isPayFastIP('192.168.1.1')).toBe(false)
    expect(isPayFastIP('10.0.0.1')).toBe(false)
  })
})

describe('subscription expiry logic', () => {
  it('detects expired trial (trial_ends_at in past)', () => {
    const trialEndsAt = new Date(Date.now() - 1000).toISOString()
    const isExpired = new Date(trialEndsAt) < new Date()
    expect(isExpired).toBe(true)
  })

  it('detects active trial (trial_ends_at in future)', () => {
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const isExpired = new Date(trialEndsAt) < new Date()
    expect(isExpired).toBe(false)
  })

  it('calculates days remaining correctly', () => {
    const endDate = new Date(Date.now() + 3.5 * 24 * 60 * 60 * 1000).toISOString()
    const msRemaining = new Date(endDate).getTime() - Date.now()
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
    expect(daysRemaining).toBe(4)
  })

  it('clamps days remaining to 0 when expired', () => {
    const endDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const msRemaining = new Date(endDate).getTime() - Date.now()
    const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
    expect(daysRemaining).toBe(0)
  })
})
