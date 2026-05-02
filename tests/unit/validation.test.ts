import { describe, it, expect } from 'vitest'
import {
  ownerLoginSchema,
  tellerLoginSchema,
  onboardingSchema,
  createProductSchema,
  updateProductSchema,
  completeSaleSchema,
  stockTakeSchema,
  createTellerSchema,
  stockAdjustSchema,
  updateShopSettingsSchema,
} from '@/lib/validation/schemas'

// ---------------------------------------------------------------------------
// ownerLoginSchema
// ---------------------------------------------------------------------------

describe('ownerLoginSchema', () => {
  it('accepts valid email and password', () => {
    const result = ownerLoginSchema.safeParse({ email: 'owner@example.com', password: 'secret1' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = ownerLoginSchema.safeParse({ email: 'not-an-email', password: 'secret1' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Enter a valid email address')
  })

  it('rejects password shorter than 6 characters', () => {
    const result = ownerLoginSchema.safeParse({ email: 'a@b.com', password: '12345' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Password must be at least 6 characters')
  })

  it('rejects missing fields', () => {
    const result = ownerLoginSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// tellerLoginSchema
// ---------------------------------------------------------------------------

describe('tellerLoginSchema', () => {
  it('accepts valid input and transforms shopCode to uppercase', () => {
    const result = tellerLoginSchema.safeParse({
      shopCode: 'cape99',
      tellerName: 'Sipho',
      password: 'pass123',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.shopCode).toBe('CAPE99')
  })

  it('rejects shopCode shorter than 6 chars', () => {
    const result = tellerLoginSchema.safeParse({ shopCode: 'A1', tellerName: 'X', password: 'pass123' })
    expect(result.success).toBe(false)
  })

  it('rejects shopCode longer than 10 chars', () => {
    const result = tellerLoginSchema.safeParse({ shopCode: 'ABCDEFGHIJK', tellerName: 'X', password: 'pass123' })
    expect(result.success).toBe(false)
  })

  it('rejects shopCode with special characters', () => {
    const result = tellerLoginSchema.safeParse({ shopCode: 'SHOP!!', tellerName: 'X', password: 'pass123' })
    expect(result.success).toBe(false)
  })

  it('rejects empty tellerName', () => {
    const result = tellerLoginSchema.safeParse({ shopCode: 'CAPE99', tellerName: '', password: 'pass123' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// onboardingSchema
// ---------------------------------------------------------------------------

describe('onboardingSchema', () => {
  // Phase 37b — onboarding now requires either municipality_id or
  // municipality_area_text (XOR). Tests pass area-text by default.
  const validBase = {
    shopName: 'Cape Town Spaza',
    ownerName: 'Thabo',
    municipality_area_text: 'Soweto',
  }

  it('accepts a valid full onboarding object', () => {
    const result = onboardingSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it('rejects empty shopName', () => {
    const result = onboardingSchema.safeParse({ ...validBase, shopName: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional registrationNumber and location', () => {
    const result = onboardingSchema.safeParse({
      ...validBase,
      registrationNumber: 'REG-2025-001',
      location: '12 Main Rd, Khayelitsha',
    })
    expect(result.success).toBe(true)
  })

  it('allows empty strings for registrationNumber and location', () => {
    const result = onboardingSchema.safeParse({
      ...validBase,
      registrationNumber: '',
      location: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects registrationNumber longer than 100 chars', () => {
    const result = onboardingSchema.safeParse({
      ...validBase,
      registrationNumber: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects location longer than 200 chars', () => {
    const result = onboardingSchema.safeParse({
      ...validBase,
      location: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createProductSchema
// ---------------------------------------------------------------------------

describe('createProductSchema', () => {
  it('accepts valid product', () => {
    const result = createProductSchema.safeParse({
      barcode: '6001234567890',
      name: 'Coca Cola 330ml',
      price: 9.99,
      stock_qty: 48,
    })
    expect(result.success).toBe(true)
  })

  it('defaults stock_qty to 0 when omitted', () => {
    const result = createProductSchema.safeParse({ barcode: '123', name: 'Test', price: 5 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.stock_qty).toBe(0)
  })

  it('rejects price of zero', () => {
    const result = createProductSchema.safeParse({ barcode: '123', name: 'Test', price: 0, stock_qty: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Price must be greater than zero')
  })

  it('rejects negative price', () => {
    const result = createProductSchema.safeParse({ barcode: '123', name: 'Test', price: -1, stock_qty: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative stock_qty', () => {
    const result = createProductSchema.safeParse({ barcode: '123', name: 'Test', price: 5, stock_qty: -1 })
    expect(result.success).toBe(false)
  })

  it('transforms empty barcode to null', () => {
    const result = createProductSchema.safeParse({ barcode: '', name: 'Test', price: 5, stock_qty: 0 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.barcode).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// updateProductSchema
// ---------------------------------------------------------------------------

describe('updateProductSchema', () => {
  it('accepts partial update (price only)', () => {
    const result = updateProductSchema.safeParse({ price: 12.5 })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = updateProductSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects negative price in update', () => {
    const result = updateProductSchema.safeParse({ price: -5 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// completeSaleSchema
// ---------------------------------------------------------------------------

describe('completeSaleSchema', () => {
  const validItem = {
    product_id: '550e8400-e29b-41d4-a716-446655440001',
    quantity: 2,
    unit_price: 9.99,
  }

  it('accepts a valid sale', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: '550e8400-e29b-41d4-a716-446655440099',
      items: [validItem],
    })
    expect(result.success).toBe(true)
  })

  it('accepts null teller_id', () => {
    const result = completeSaleSchema.safeParse({ teller_id: null, items: [validItem] })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = completeSaleSchema.safeParse({ teller_id: null, items: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('A sale must have at least one item')
  })

  it('rejects item with zero quantity', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: null,
      items: [{ ...validItem, quantity: 0 }],
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional offline_id', () => {
    const result = completeSaleSchema.safeParse({
      teller_id: null,
      items: [validItem],
      offline_id: 'offline-abc-123',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// stockTakeSchema
// ---------------------------------------------------------------------------

describe('stockTakeSchema', () => {
  it('accepts valid entries', () => {
    const result = stockTakeSchema.safeParse({
      entries: [
        { product_id: '550e8400-e29b-41d4-a716-446655440001', qty_after: 10 },
        { product_id: '550e8400-e29b-41d4-a716-446655440002', qty_after: 0 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty entries array', () => {
    const result = stockTakeSchema.safeParse({ entries: [] })
    expect(result.success).toBe(false)
  })

  it('rejects negative qty_after', () => {
    const result = stockTakeSchema.safeParse({
      entries: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', qty_after: -1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer qty_after', () => {
    const result = stockTakeSchema.safeParse({
      entries: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', qty_after: 2.5 }],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createTellerSchema
// ---------------------------------------------------------------------------

describe('createTellerSchema', () => {
  it('accepts valid name and password', () => {
    const result = createTellerSchema.safeParse({ name: 'Sipho', password: 'teller1' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createTellerSchema.safeParse({ name: '', password: 'teller1' })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 6 characters', () => {
    const result = createTellerSchema.safeParse({ name: 'Sipho', password: '12345' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Password must be at least 6 characters')
  })
})

// ---------------------------------------------------------------------------
// stockAdjustSchema
// ---------------------------------------------------------------------------

describe('stockAdjustSchema', () => {
  it('accepts a positive qty_delta (add stock)', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: 24,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a negative qty_delta (remove stock)', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: -10,
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional reason string', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: 5,
      reason: 'Delivery received',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer qty_delta', () => {
    const result = stockAdjustSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      qty_delta: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid product_id (not a UUID)', () => {
    const result = stockAdjustSchema.safeParse({ product_id: 'not-a-uuid', qty_delta: 5 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// updateShopSettingsSchema
// ---------------------------------------------------------------------------

describe('updateShopSettingsSchema', () => {
  it('accepts valid full settings', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      whatsapp_number: '+27821234567',
      low_stock_threshold: 5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects low_stock_threshold of zero', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      low_stock_threshold: 0,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Must be at least 1')
  })

  it('rejects low_stock_threshold exceeding 9999', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      low_stock_threshold: 10000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty shop name', () => {
    const result = updateShopSettingsSchema.safeParse({ name: '', low_stock_threshold: 5 })
    expect(result.success).toBe(false)
  })

  it('accepts optional registration_number and location', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      low_stock_threshold: 5,
      registration_number: 'REG-123',
      location: '12 Main Rd, Cape Town',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null registration_number and location', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      low_stock_threshold: 5,
      registration_number: null,
      location: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects registration_number longer than 100 chars', () => {
    const result = updateShopSettingsSchema.safeParse({
      name: 'My Shop',
      low_stock_threshold: 5,
      registration_number: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })
})
