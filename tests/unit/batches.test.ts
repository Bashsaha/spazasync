import { describe, it, expect } from 'vitest'
import { addBatchSchema } from '../../src/lib/validation/schemas'

describe('addBatchSchema', () => {
  it('accepts valid batch input', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
      quantity: 24,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.product_id).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.data.expiry_date).toBe('2025-06-15')
      expect(result.data.quantity).toBe(24)
    }
  })

  it('rejects missing product_id', () => {
    const result = addBatchSchema.safeParse({
      expiry_date: '2025-06-15',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID product_id', () => {
    const result = addBatchSchema.safeParse({
      product_id: 'not-a-uuid',
      expiry_date: '2025-06-15',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing expiry_date', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid expiry_date format (DD/MM/YYYY)', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '15/06/2025',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid expiry_date format (ISO datetime)', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15T00:00:00Z',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
      quantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
      quantity: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects decimal quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
      quantity: 2.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts quantity of 1 (minimum)', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-12-31',
      quantity: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts large quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2026-01-01',
      quantity: 10000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty string for expiry_date', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '',
      quantity: 24,
    })
    expect(result.success).toBe(false)
  })

  it('rejects string for quantity', () => {
    const result = addBatchSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      expiry_date: '2025-06-15',
      quantity: 'twenty',
    })
    expect(result.success).toBe(false)
  })
})
