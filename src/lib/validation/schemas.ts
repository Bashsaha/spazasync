import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/lib/i18n/types'

const languageEnum = z.enum(SUPPORTED_LOCALES as [string, ...string[]])

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
  ownerName: z.string().min(1, 'Enter your name').max(100),
  registrationNumber: z.string().max(100).optional().or(z.literal('')),
  location: z.string().max(200).optional().or(z.literal('')),
  language: languageEnum.optional().default('en'),
})

// ============================================================
// Products
// ============================================================

export const createProductSchema = z.object({
  barcode: z.string().max(50).nullable().optional().transform((v) => v?.trim() || null),
  name: z.string().min(1, 'Product name is required').max(200),
  price: z.number().positive('Price must be greater than zero'),
  cost_price: z.number().nonnegative('Cost price cannot be negative').nullable().optional(),
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
  low_stock_threshold: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(9999),
  registration_number: z.string().max(100).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  language: languageEnum.optional(),
  profit_tracking_enabled: z.boolean().optional(),
})

// ============================================================
// Product batches (expiry tracking)
// ============================================================

export const addBatchSchema = z.object({
  product_id: z.string().uuid(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
})

// ============================================================
// Admin
// ============================================================

export const adminManualPaymentSchema = z.object({
  shop_id: z.string().uuid(),
  amount: z.number().positive('Amount must be greater than zero'),
  method: z.enum(['eft', 'cash', 'card', 'other']),
  reference: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  activate_subscription: z.boolean().default(false),
})

export const adminToggleAccessSchema = z.object({
  shop_id: z.string().uuid(),
  access_granted: z.boolean(),
})

export const adminUpdateNotesSchema = z.object({
  shop_id: z.string().uuid(),
  admin_notes: z.string().max(2000),
})

export const adminStoreListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(['trialing', 'active', 'cancelled', 'expired', 'manual_override']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================================
// Suppliers
// ============================================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  contact_number: z.string().max(50).nullable().optional().transform((v) => v?.trim() || null),
  type: z.enum(['wholesaler', 'distributor', 'farmer', 'other']).nullable().optional(),
  location: z.string().max(200).nullable().optional().transform((v) => v?.trim() || null),
})

export const updateSupplierSchema = createSupplierSchema.partial()

// ============================================================
// Admin — Barcode Catalog
// ============================================================

export const adminCatalogEntrySchema = z.object({
  barcode: z.string().min(1, 'Barcode is required').max(50),
  name: z.string().min(1, 'Product name is required').max(200),
  category: z.string().max(100).optional().transform((v) => v?.trim() || null),
})

export const adminCatalogSearchSchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const adminUpdateSubscriptionSchema = z.object({
  shop_id: z.string().uuid(),
  subscription_status: z.enum(['trialing', 'active', 'cancelled', 'expired', 'manual_override']),
  subscription_ends_at: z.string().datetime().optional(),
  trial_ends_at: z.string().datetime().optional(),
})
