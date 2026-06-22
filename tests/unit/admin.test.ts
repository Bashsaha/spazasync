import { describe, it, expect } from 'vitest'
import {
  adminManualPaymentSchema,
  adminToggleAccessSchema,
  adminUpdateNotesSchema,
  adminUpdateSubscriptionSchema,
  adminStoreListQuerySchema,
} from '@/lib/validation/schemas'
import { statusBadgeColors } from '@/lib/utils/statusBadge'
import type { SubscriptionStatus } from '@/types'

// ---------------------------------------------------------------------------
// statusBadgeColors
// ---------------------------------------------------------------------------

describe('statusBadgeColors', () => {
  const allStatuses: SubscriptionStatus[] = [
    'trialing',
    'active',
    'cancelled',
    'expired',
    'manual_override',
    'processing_cancellation',
  ]

  it('has entries for all 6 subscription statuses', () => {
    for (const s of allStatuses) {
      expect(statusBadgeColors[s]).toBeDefined()
      expect(typeof statusBadgeColors[s]).toBe('string')
    }
  })

  it('has no extra keys beyond the 6 statuses', () => {
    expect(Object.keys(statusBadgeColors)).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// adminManualPaymentSchema
// ---------------------------------------------------------------------------

describe('adminManualPaymentSchema', () => {
  const valid = {
    shop_id: '550e8400-e29b-41d4-a716-446655440000',
    amount: 349.99,
    method: 'eft' as const,
  }

  it('accepts valid payment', () => {
    expect(adminManualPaymentSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts with optional fields', () => {
    const result = adminManualPaymentSchema.safeParse({
      ...valid,
      reference: 'REF-001',
      notes: 'Manual override',
      activate_subscription: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative amount', () => {
    expect(adminManualPaymentSchema.safeParse({ ...valid, amount: -10 }).success).toBe(false)
  })

  it('rejects zero amount', () => {
    expect(adminManualPaymentSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false)
  })

  it('rejects invalid method', () => {
    expect(adminManualPaymentSchema.safeParse({ ...valid, method: 'bitcoin' }).success).toBe(false)
  })

  it('rejects non-UUID shop_id', () => {
    expect(adminManualPaymentSchema.safeParse({ ...valid, shop_id: 'abc' }).success).toBe(false)
  })

  it('defaults activate_subscription to false', () => {
    const result = adminManualPaymentSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activate_subscription).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// adminToggleAccessSchema
// ---------------------------------------------------------------------------

describe('adminToggleAccessSchema', () => {
  it('accepts true', () => {
    const r = adminToggleAccessSchema.safeParse({
      shop_id: '550e8400-e29b-41d4-a716-446655440000',
      access_granted: true,
    })
    expect(r.success).toBe(true)
  })

  it('accepts false', () => {
    const r = adminToggleAccessSchema.safeParse({
      shop_id: '550e8400-e29b-41d4-a716-446655440000',
      access_granted: false,
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-boolean access_granted', () => {
    const r = adminToggleAccessSchema.safeParse({
      shop_id: '550e8400-e29b-41d4-a716-446655440000',
      access_granted: 'yes',
    })
    expect(r.success).toBe(false)
  })

  it('rejects missing access_granted', () => {
    const r = adminToggleAccessSchema.safeParse({
      shop_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(r.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// adminUpdateNotesSchema
// ---------------------------------------------------------------------------

describe('adminUpdateNotesSchema', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid notes', () => {
    expect(adminUpdateNotesSchema.safeParse({ shop_id: uuid, admin_notes: 'Test note' }).success).toBe(true)
  })

  it('accepts empty string', () => {
    expect(adminUpdateNotesSchema.safeParse({ shop_id: uuid, admin_notes: '' }).success).toBe(true)
  })

  it('accepts exactly 2000 chars', () => {
    const r = adminUpdateNotesSchema.safeParse({ shop_id: uuid, admin_notes: 'x'.repeat(2000) })
    expect(r.success).toBe(true)
  })

  it('rejects notes over 2000 chars', () => {
    const r = adminUpdateNotesSchema.safeParse({ shop_id: uuid, admin_notes: 'x'.repeat(2001) })
    expect(r.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// adminUpdateSubscriptionSchema
// ---------------------------------------------------------------------------

describe('adminUpdateSubscriptionSchema', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts valid status only', () => {
    const r = adminUpdateSubscriptionSchema.safeParse({
      shop_id: uuid,
      subscription_status: 'active',
    })
    expect(r.success).toBe(true)
  })

  it('accepts status with end dates', () => {
    const r = adminUpdateSubscriptionSchema.safeParse({
      shop_id: uuid,
      subscription_status: 'trialing',
      trial_ends_at: '2026-04-01T23:59:59.999Z',
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const r = adminUpdateSubscriptionSchema.safeParse({
      shop_id: uuid,
      subscription_status: 'premium',
    })
    expect(r.success).toBe(false)
  })

  it('rejects non-datetime strings for date fields', () => {
    const r = adminUpdateSubscriptionSchema.safeParse({
      shop_id: uuid,
      subscription_status: 'active',
      subscription_ends_at: 'next-tuesday',
    })
    expect(r.success).toBe(false)
  })

  it('accepts all 5 valid statuses', () => {
    for (const s of ['trialing', 'active', 'cancelled', 'expired', 'manual_override']) {
      const r = adminUpdateSubscriptionSchema.safeParse({ shop_id: uuid, subscription_status: s })
      expect(r.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// adminStoreListQuerySchema
// ---------------------------------------------------------------------------

describe('adminStoreListQuerySchema', () => {
  it('defaults page to 1 and limit to 20', () => {
    const r = adminStoreListQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(1)
      expect(r.data.limit).toBe(20)
    }
  })

  it('coerces string page/limit to numbers', () => {
    const r = adminStoreListQuerySchema.safeParse({ page: '3', limit: '50' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(3)
      expect(r.data.limit).toBe(50)
    }
  })

  it('rejects limit > 100', () => {
    expect(adminStoreListQuerySchema.safeParse({ limit: '200' }).success).toBe(false)
  })

  it('rejects page < 1', () => {
    expect(adminStoreListQuerySchema.safeParse({ page: '0' }).success).toBe(false)
  })

  it('accepts search and status filter', () => {
    const r = adminStoreListQuerySchema.safeParse({ search: 'test', status: 'active' })
    expect(r.success).toBe(true)
  })

  it('rejects search over 100 chars', () => {
    expect(adminStoreListQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })
})
