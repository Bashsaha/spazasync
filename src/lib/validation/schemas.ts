import { z } from 'zod'
import { SUPPORTED_LOCALES } from '@/lib/i18n/types'

const languageEnum = z.enum(SUPPORTED_LOCALES as [string, ...string[]])

// ============================================================
// Auth
// ============================================================

// Owner sign-in is Google OAuth — no password, no email field on our side.
// Supabase handles the OAuth redirect / token exchange end-to-end.

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

export const onboardingSchema = z
  .object({
    shopName: z.string().min(1, 'Enter your shop name').max(100),
    ownerName: z.string().min(1, 'Enter your name').max(100),
    registrationNumber: z.string().max(100).optional().or(z.literal('')),
    location: z.string().max(200).optional().or(z.literal('')),
    language: languageEnum.optional().default('en'),
    // Phase 37b — Area capture: exactly one of these must be set.
    // Owner picks a known municipality (UUID) OR types a free-text area
    // ("Other / not sure" path); server-side findMunicipalityByArea() then
    // attempts a match to upgrade the free text into a municipality_id.
    municipality_id: z.string().uuid().nullable().optional(),
    municipality_area_text: z
      .string()
      .min(1, 'Tell us your area or township')
      .max(200)
      .nullable()
      .optional(),
  })
  .refine(
    (v) =>
      (v.municipality_id != null && !v.municipality_area_text) ||
      (!v.municipality_id && v.municipality_area_text != null),
    { message: 'Choose your area, or type it in if it is not listed' },
  )

// ============================================================
// Products
// ============================================================

export const createProductSchema = z.object({
  barcode: z.string().max(50).nullable().optional().transform((v) => v?.trim() || null),
  name: z.string().min(1, 'Product name is required').max(200),
  price: z.number().positive('Price must be greater than zero'),
  cost_price: z.number().nonnegative('Cost price cannot be negative').nullable().optional(),
  stock_qty: z.number().int().min(0).default(0),
  supplier_id: z.string().uuid().nullable().optional(),
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

/** Reasons a counted quantity can come in lower than current stock. */
export const STOCK_TAKE_LOSS_REASONS = ['unsure', 'damaged_expired', 'miscount', 'other'] as const
export type StockTakeLossReason = (typeof STOCK_TAKE_LOSS_REASONS)[number]

export const stockTakeItemSchema = z.object({
  product_id: z.string().uuid(),
  qty_after: z.number().int().min(0),
  teller_id: z.string().uuid().nullable().optional(),
  // Why the count is lower than current stock. Only meaningful (and required by
  // the UI) when qty_after < qty_before; ignored otherwise.
  reason: z.enum(STOCK_TAKE_LOSS_REASONS).optional(),
})

export const stockTakeSchema = z.object({
  entries: z.array(stockTakeItemSchema).min(1),
})

// ============================================================
// Tellers
// ============================================================

export const createTellerSchema = z.object({
  name: z.string().min(1, 'Enter the teller\'s name').max(100),
  // 6-digit PIN. Stored as the Supabase Auth password for the synthetic
  // teller user — Supabase requires ≥6 chars, which 6 digits satisfies.
  // Using a numeric PIN (instead of type=password) bypasses Chrome's
  // Password Reuse Protection, which fires the "deceptive site" warning
  // when an owner accidentally types a password they use elsewhere.
  password: z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
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
  has_fridge: z.boolean().optional(),
  has_freezer: z.boolean().optional(),
  // Phase 37b — "Redo compliance check" resets these three fields together.
  redo_compliance_check: z.literal(true).optional(),
  // Phase 37e — toggle for the Government Fund eligibility surface.
  fund_interest: z.boolean().optional(),
})

// ============================================================
// Fund eligibility (Phase 37e)
// ============================================================

export const updateFundEligibilitySchema = z.object({
  fund_township_rural: z.boolean().nullable().optional(),
  fund_owner_managed: z.boolean().nullable().optional(),
  has_disability: z.boolean().optional(),
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
// Goods received (Phase 30b)
// ============================================================

export const createGoodsReceivedSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  supplier_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional().transform((v) => v?.trim() || null),
})

// ============================================================
// Daily checklist (Phase 31)
// ============================================================

// Accept reasonable temp range and clamp to NUMERIC(4,1): -99.9 .. 99.9
const tempField = z
  .number()
  .min(-99.9)
  .max(99.9)
  .nullable()
  .optional()

export const upsertChecklistSchema = z.object({
  fridge_ok: z.boolean().nullable().optional(),
  fridge_temp: tempField,
  freezer_ok: z.boolean().nullable().optional(),
  freezer_temp: tempField,
  surfaces_cleaned: z.boolean().nullable().optional(),
  floor_cleaned: z.boolean().nullable().optional(),
  storage_clean: z.boolean().nullable().optional(),
  waste_bins_ok: z.boolean().nullable().optional(),
  expired_items_action: z
    .enum(['none_found', 'removed', 'skipped'])
    .nullable()
    .optional(),
})

// ============================================================
// Business documents (Phase 32)
// ============================================================

export const DOCUMENT_TYPES = [
  'municipal_registration',
  'coa',
  'cipc',
  'business_license',
  'owner_id',
  'sars_tax',
  'uif',
  'food_safety_training',
  'smmesa',
] as const

export const DOCUMENT_STATUSES = [
  'valid',
  'expired',
  'pending',
  'not_registered',
  'not_required',
  'on_file',
  'in_progress',   // Phase 37c — set by /api/compliance/journey/step on "I've applied"
] as const

export const documentTypeSchema = z.enum(DOCUMENT_TYPES)

export const upsertBusinessDocumentSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES),
  reference_number: z
    .string()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  date_issued: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD')
    .nullable()
    .optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD')
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
})

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

// ============================================================
// Waste & pest control (Phase 33)
// ============================================================

export const WASTE_REMOVAL_TYPES = ['municipal', 'private', 'self_disposal'] as const
export const WASTE_FREQUENCIES = ['daily', 'weekly', 'twice_weekly', 'monthly', 'other'] as const

export const createPestControlLogSchema = z.object({
  visit_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD'),
  provider_name: z.string().min(1, 'Provider name is required').max(100),
  treatment_type: z.string().min(1, 'Treatment type is required').max(100),
  notes: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
})

export const upsertWasteManagementSchema = z.object({
  removal_type: z.enum(WASTE_REMOVAL_TYPES),
  frequency: z.enum(WASTE_FREQUENCIES),
  provider_name: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
})

// ============================================================
// Access requests (Phase 36c)
// ============================================================

export const ACCESS_REQUEST_FEATURES = ['inventory'] as const
export const ACCESS_REQUEST_ACTIONS = ['grant', 'deny', 'revoke'] as const

export const createAccessRequestSchema = z.object({
  feature: z.enum(ACCESS_REQUEST_FEATURES).default('inventory'),
})

export const resolveAccessRequestSchema = z.object({
  action: z.enum(ACCESS_REQUEST_ACTIONS),
})

// ============================================================
// Municipality directory (Phase 37a)
// ============================================================

export const PROVINCES = [
  'gauteng',
  'western_cape',
  'kzn',
  'eastern_cape',
  'free_state',
  'limpopo',
  'mpumalanga',
  'north_west',
  'northern_cape',
] as const

export const OFFICE_TYPES = [
  'trading_permit',
  'environmental_health',
  'business_licensing',
  'customer_care',
] as const

export const REQUIREMENT_TYPES = ['trading_permit', 'coa', 'general'] as const

export const NATIONALITY_TYPES = ['sa_citizen', 'foreign_national'] as const

export const DOCUMENT_APPLIES_TO = ['sa_citizen', 'foreign_national', 'all'] as const

// Phase 37f — Foreign National Path
export const VISA_TYPES = [
  'business_visa',
  'asylum_seeker_s22',
  'refugee_s24',
  'work_permit',
  'other',
] as const

export const documentRequirementSchema = z.object({
  name: z.string().min(1).max(300),
  applies_to: z.enum(DOCUMENT_APPLIES_TO),
  required: z.boolean(),
  notes: z.string().max(1000).nullable().optional(),
})

export const municipalitySchema = z.object({
  name: z.string().min(1).max(200),
  province: z.enum(PROVINCES),
  short_name: z.string().min(1).max(100),
  areas: z.array(z.string().min(1).max(100)).default([]),
})

// Empty string → null, otherwise validate as the inner schema. Used for
// optional contact fields where the seed script may pass '' for "unknown".
const optionalEmail = z
  .union([z.literal(''), z.string().email().max(200), z.null()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v))

const optionalUrl = z
  .union([z.literal(''), z.string().url().max(500), z.null()])
  .optional()
  .transform((v) => (v === '' || v == null ? null : v))

export const municipalityOfficeSchema = z.object({
  municipality_id: z.string().uuid(),
  office_type: z.enum(OFFICE_TYPES),
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  area: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: optionalEmail,
  hours: z.string().max(200).nullable().optional(),
  online_portal_url: optionalUrl,
  online_form_url: optionalUrl,
  notes: z.string().max(2000).nullable().optional(),
})

export const municipalityRequirementSchema = z.object({
  municipality_id: z.string().uuid(),
  requirement_type: z.enum(REQUIREMENT_TYPES),
  documents_required: z.array(documentRequirementSchema).default([]),
  fees: z.string().max(200).nullable().optional(),
  estimated_processing_time: z.string().max(200).nullable().optional(),
  additional_notes: z.string().max(2000).nullable().optional(),
})

// ============================================================
// Compliance onboarding (Phase 37b)
// ============================================================

export const DOCUMENT_TOGGLE_STATES = ['have', 'unsure', 'unselected'] as const

export const ONBOARDING_DOCUMENT_TYPES = [
  'municipal_registration',
  'coa',
  'cipc',
  'sars_tax',
  'uif',
] as const

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD')

export const ownerProfileSchema = z.object({
  nationality_type: z.enum(NATIONALITY_TYPES),
  food_safety_training_completed: z.boolean(),
  food_safety_training_date: dateString.nullable().optional(),
  food_safety_training_provider: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
})

export const complianceOnboardingSchema = z
  .object({
    nationality_type: z.enum(NATIONALITY_TYPES),
    municipality_id: z.string().uuid().nullable().optional(),
    municipality_area_text: z.string().min(1).max(200).nullable().optional(),
    has_employees: z.boolean(),
    document_states: z
      .object({
        municipal_registration: z.enum(DOCUMENT_TOGGLE_STATES).optional(),
        coa: z.enum(DOCUMENT_TOGGLE_STATES).optional(),
        cipc: z.enum(DOCUMENT_TOGGLE_STATES).optional(),
        sars_tax: z.enum(DOCUMENT_TOGGLE_STATES).optional(),
        uif: z.enum(DOCUMENT_TOGGLE_STATES).optional(),
      })
      .default({}),
    food_safety_training_completed: z.boolean(),
    food_safety_training_date: dateString.nullable().optional(),
    food_safety_training_provider: z
      .string()
      .max(200)
      .nullable()
      .optional()
      .transform((v) => v?.trim() || null),
    fund_interest: z.boolean(),
    // Phase 37f — only meaningful when nationality_type === 'foreign_national'.
    // The API force-nulls these for SA citizens, but the schema allows them
    // through so the client can submit a single payload shape regardless.
    visa_type: z.enum(VISA_TYPES).nullable().optional(),
    visa_expiry_date: dateString.nullable().optional(),
    // Phase 41a — foreign-born owners naturalised before 1994 qualify for the
    // Spaza Shop Support Fund. API force-nulls for SA citizens.
    naturalised_pre_1994: z.boolean().nullable().optional(),
  })
  .refine(
    (v) =>
      (v.municipality_id != null && !v.municipality_area_text) ||
      (!v.municipality_id && v.municipality_area_text != null),
    { message: 'Pick your municipality, or tell us your area' },
  )
  .refine(
    (v) =>
      !v.food_safety_training_completed ||
      (v.food_safety_training_completed && !!v.food_safety_training_date),
    { message: 'When was the training completed?' },
  )
  .refine(
    (v) =>
      v.nationality_type !== 'foreign_national' || !!v.visa_type,
    { message: 'Tell us your visa or permit type', path: ['visa_type'] },
  )

// ============================================================
// Compliance journey hub (Phase 37c)
// ============================================================

export const JOURNEY_STEP_ACTIONS = [
  'mark_done',
  'mark_applied',
  'mark_received',
  'reset',
] as const

const journeyDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD')
  .nullable()
  .optional()

const journeyRefNumber = z
  .string()
  .max(100)
  .nullable()
  .optional()
  .transform((v) => v?.trim() || null)

export const journeyStepActionSchema = z
  .object({
    document_type: documentTypeSchema,
    action: z.enum(JOURNEY_STEP_ACTIONS),
    reference_number: journeyRefNumber,
    date_issued: journeyDate,
    expiry_date: journeyDate,
  })
  .refine(
    (v) =>
      v.action !== 'mark_received' ||
      (v.reference_number !== null && v.reference_number !== undefined && v.reference_number.length > 0),
    { message: 'Enter the document number you received', path: ['reference_number'] },
  )

export const tellerTrainingSchema = z.object({
  trained: z.boolean(),
  trained_at: z
    .string()
    .datetime()
    .nullable()
    .optional(),
})

// ============================================================
// Smart Reminders & Nudges (Phase 37g)
// ============================================================

export const ADMIN_ALERT_PRIORITIES = ['normal', 'high', 'urgent'] as const
export const ADMIN_ALERT_AUDIENCES = ['all', 'sa_citizen', 'foreign_national'] as const

export const dismissReminderSchema = z.object({
  reminder_key: z.string().min(1).max(200),
  reminder_type: z.enum([
    'coa_expiry',
    'permit_expiry',
    'cipc_annual',
    'visa_expiry',
    'journey_nudge',
    'fund_nudge',
    'fund_qualified',
    'score_drop',
    'checklist_streak',
    'admin_alert',
  ]),
})

export const createAdminAlertSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  message: z.string().min(1, 'Message is required').max(2000),
  link_text: z
    .string()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  link_url: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => v?.trim() || null),
  priority: z.enum(ADMIN_ALERT_PRIORITIES).default('normal'),
  target_audience: z.enum(ADMIN_ALERT_AUDIENCES).default('all'),
  starts_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().nullable().optional(),
})

export const updateAdminAlertSchema = createAdminAlertSchema.partial()
