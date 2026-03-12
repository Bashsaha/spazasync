import { z } from 'zod'

// ============================================================
// Auth
// ============================================================

export const ownerLoginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const tellerLoginSchema = z.object({
  shopCode: z
    .string()
    .min(6, 'Shop code must be 6–10 characters')
    .max(10, 'Shop code must be 6–10 characters')
    .regex(/^[A-Z0-9]+$/i, 'Shop code can only contain letters and numbers')
    .transform((s) => s.toUpperCase()),
  tellerName: z.string().min(1, 'Enter your name').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const onboardingSchema = z.object({
  shopName: z.string().min(1, 'Enter your shop name').max(100),
  shopCode: z
    .string()
    .min(6, 'Shop code must be 6–10 characters')
    .max(10, 'Shop code must be 6–10 characters')
    .regex(/^[A-Z0-9]+$/i, 'Only letters and numbers allowed')
    .transform((s) => s.toUpperCase()),
  ownerName: z.string().min(1, 'Enter your name').max(100),
  whatsappNumber: z
    .string()
    .regex(/^\+27\d{9}$/, 'Enter a valid SA number, e.g. +27821234567')
    .optional()
    .or(z.literal('')),
})

// ============================================================
// Products
// ============================================================

export const createProductSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required').max(50),
  name: z.string().min(1, 'Product name is required').max(200),
  price: z.number().positive('Price must be greater than zero'),
  stock_qty: z.number().int().min(0).default(0),
})

export const updateProductSchema = createProductSchema.partial().omit({ barcode: true })

// ============================================================
// Sales
// ============================================================

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
})

export const completeSaleSchema = z.object({
  teller_id: z.string().uuid().nullable(),
  items: z.array(saleItemSchema).min(1, 'A sale must have at least one item'),
  offline_id: z.string().optional(),
})

// ============================================================
// Stock take
// ============================================================

export const stockTakeItemSchema = z.object({
  product_id: z.string().uuid(),
  qty_after: z.number().int().min(0),
  teller_id: z.string().uuid().nullable().optional(),
})

export const stockTakeSchema = z.object({
  entries: z.array(stockTakeItemSchema).min(1),
})

// ============================================================
// Tellers
// ============================================================

export const createTellerSchema = z.object({
  name: z.string().min(1, 'Enter the teller\'s name').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

// ============================================================
// Stock adjustment
// ============================================================

export const stockAdjustSchema = z.object({
  product_id: z.string().uuid(),
  qty_delta: z.number().int(),  // positive = add stock, negative = remove
  reason: z.string().max(200).optional(),
})

// ============================================================
// Shop settings
// ============================================================

export const updateShopSettingsSchema = z.object({
  name: z.string().min(1, 'Shop name is required').max(100),
  whatsapp_number: z
    .string()
    .regex(/^\+\d{7,15}$/, 'Enter a number like +27821234567')
    .nullable()
    .optional(),
  low_stock_threshold: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(9999),
})
