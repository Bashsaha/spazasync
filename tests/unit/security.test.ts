/**
 * Security posture tests — verify that validation schemas
 * act as a real defense layer against malformed/malicious input.
 */
import { describe, it, expect } from 'vitest'
import {
  completeSaleSchema,
  stockAdjustSchema,
  onboardingSchema,
  stockTakeSchema,
  tellerLoginSchema,
} from '@/lib/validation/schemas'

describe('completeSaleSchema security', () => {
  it('rejects non-UUID teller_id (SQL injection attempt)', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: "'; DROP TABLE tellers; --",
      items: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', quantity: 1, unit_price: 5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID product_id in items', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: null,
      items: [{ product_id: 'not-a-uuid', quantity: 1, unit_price: 5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity in items', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: null,
      items: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', quantity: -1, unit_price: 5 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative unit_price', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: null,
      items: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', quantity: 1, unit_price: -9.99 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('stockAdjustSchema security', () => {
  it('rejects string qty_delta', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: '100',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID product_id', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '../../../etc/passwd',
      qty_delta: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects extremely long reason string', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: 5,
      reason: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

describe('onboardingSchema security', () => {
  it('rejects shopCode with SQL special characters', () => {
    const result = onboardingSchema.safeParse({
      shopName: 'Test',
      shopCode: "SHOP'; --",
      ownerName: 'Owner',
    })
    expect(result.success).toBe(false)
  })

  it('rejects shopCode with hyphens', () => {
    const result = onboardingSchema.safeParse({
      shopName: 'Test',
      shopCode: 'SHOP-01',
      ownerName: 'Owner',
    })
    expect(result.success).toBe(false)
  })

  it('rejects whatsappNumber without country code prefix', () => {
    const result = onboardingSchema.safeParse({
      shopName: 'Test',
      shopCode: 'SHOP01',
      ownerName: 'Owner',
      whatsappNumber: '0821234567',
    })
    expect(result.success).toBe(false)
  })

  it('rejects extremely long shopName', () => {
    const result = onboardingSchema.safeParse({
      shopName: 'A'.repeat(101),
      shopCode: 'SHOP01',
      ownerName: 'Owner',
    })
    expect(result.success).toBe(false)
  })
})

describe('stockTakeSchema security', () => {
  it('rejects float qty_after (must be integer)', () => {
    const result = stockTakeSchema.safeParse({
      entries: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', qty_after: 4.9 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects string qty_after', () => {
    const result = stockTakeSchema.safeParse({
      entries: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', qty_after: '10' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('tellerLoginSchema security', () => {
  it('rejects shopCode with script injection attempt', () => {
    const result = tellerLoginSchema.safeParse({
      shopCode: '<script>',
      tellerName: 'User',
      password: 'pass123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects very long tellerName', () => {
    const result = tellerLoginSchema.safeParse({
      shopCode: 'SHOP01',
      tellerName: 'A'.repeat(101),
      password: 'pass123',
    })
    expect(result.success).toBe(false)
  })
})
