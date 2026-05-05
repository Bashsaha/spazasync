// ============================================================
// Movestock — Shared TypeScript Types
// ============================================================

import type { SupportedLocale } from '@/lib/i18n/types'

// --- Database row types ---

export type UserRole = 'owner' | 'teller' | 'admin'

export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired' | 'manual_override'

export interface Shop {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  low_stock_threshold: number
  registration_number: string | null
  location: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  subscription_ends_at: string | null
  language: SupportedLocale
  access_granted: boolean
  admin_notes: string | null
  profit_tracking_enabled: boolean
  has_fridge: boolean
  has_freezer: boolean
  // Phase 37b — Compliance Onboarding
  municipality_id: string | null
  municipality_area_text: string | null
  has_employees: boolean
  fund_interest: boolean
  onboarding_compliance_completed: boolean
  onboarding_compliance_dismissed_at: string | null
  onboarding_compliance_dismiss_count: number
  // Phase 37e — Fund Readiness Checker
  fund_township_rural: boolean | null
  fund_owner_managed: boolean | null
  created_at: string
}

export interface SubscriptionInfo {
  status: SubscriptionStatus
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  daysRemaining: number | null
}

export interface ShopUser {
  id: string
  shop_id: string
  user_id: string
  role: UserRole
  created_at: string
}

export interface Teller {
  id: string
  shop_id: string
  name: string
  user_id: string | null
  active: boolean
  // Phase 37c — Step 6 (Food Safety) per-staff training tracker.
  food_safety_trained_at: string | null
  created_at: string
}

export interface Product {
  id: string
  shop_id: string
  barcode: string | null
  name: string
  price: number   // stored as NUMERIC, parsed as number (ZAR rands)
  cost_price: number | null   // wholesale / buy-in cost per unit — nullable
  stock_qty: number
  supplier_id: string | null  // last-known supplier (Phase 30b)
  created_at: string
}

export interface Sale {
  id: string
  shop_id: string
  teller_id: string | null
  total: number
  completed_at: string
  synced_at: string | null
  offline_id: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  unit_cost: number | null   // snapshot of product.cost_price at sale time
  subtotal: number
}

export interface StockTakeEntry {
  id: string
  shop_id: string
  product_id: string
  qty_before: number
  qty_after: number
  teller_id: string | null
  taken_at: string
}

// --- Cart (in-memory, not persisted to DB until sale complete) ---

export interface CartItem {
  product: Product
  quantity: number
  subtotal: number
}

export interface Cart {
  items: CartItem[]
  teller_id: string | null
  total: number
}

// --- Offline queue (stored in IndexedDB) ---

export interface PendingSale {
  offline_id: string       // UUID generated locally
  shop_id: string
  teller_id: string | null
  total: number
  items: OfflineSaleItem[]
  queued_at: string
  retry_count: number
  last_error?: string      // reason for last sync failure
}

export interface OfflineSaleItem {
  product_id: string
  barcode: string
  quantity: number
  unit_price: number
  subtotal: number
}

// --- API request/response shapes ---

export interface CreateProductInput {
  barcode: string
  name: string
  price: number
  cost_price?: number | null
  stock_qty?: number
  supplier_id?: string | null
}

export interface CompleteSaleInput {
  teller_id: string | null
  items: {
    product_id: string
    quantity: number
    unit_price: number
  }[]
  offline_id?: string
}

export interface StockTakeInput {
  product_id: string
  qty_after: number
  teller_id?: string | null
}

export interface CreateTellerInput {
  name: string
  password: string
}

export interface StockAdjustment {
  id: string
  shop_id: string
  product_id: string
  qty_before: number
  qty_after: number
  delta: number
  reason: string | null
  adjusted_by: string | null
  adjusted_at: string
}

export interface StockAdjustInput {
  product_id: string
  qty_delta: number
  reason?: string
}

// --- Reporting ---

export interface DailySummaryData {
  salesCount: number
  totalRevenue: number
  totalProfit: number           // sum of (unit_price - unit_cost) * qty where unit_cost IS NOT NULL
  hasProfitData: boolean        // true iff at least one sale_item this period had a non-null unit_cost
  topItems: Array<{ name: string; totalQty: number }>
  tellerCount: number
}

export interface LowStockItem {
  name: string
  stock_qty: number
}

export interface WeeklyDataPoint {
  label: string        // short day name, e.g. "Mon"
  date: string         // yyyy-MM-dd
  revenue: number
  salesCount: number
}

export interface RecentSale {
  id: string
  total: number
  completed_at: string
  teller_name: string | null
}

// --- Sales history (Phase 35a) ---

export interface SaleItemWithProduct {
  id: string
  product_id: string
  product_name: string
  product_barcode: string | null
  quantity: number
  unit_price: number
  unit_cost: number | null
  subtotal: number
  /** (unit_price − unit_cost) * quantity — null when unit_cost is null */
  line_profit: number | null
}

export interface SaleWithDetails {
  id: string
  total: number
  completed_at: string
  teller_id: string | null
  teller_name: string | null
  items: SaleItemWithProduct[]
  /** Σ(line_profit) across items — null if ANY line has null unit_cost and profit tracking is on */
  profit: number | null
}

export interface DailySalesTotals {
  saleCount: number
  revenue: number
  /** null when profit tracking off OR when any sale that day has missing cost data */
  profit: number | null
  uniqueTellers: number
}

export interface TopProduct {
  name: string
  totalQty: number
  totalRevenue: number
}

// --- Auth session context ---

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  shop_id: string
  teller_id: string | null   // set if role === 'teller'; used to auto-select on sale page
}

// --- Product batches (expiry tracking) ---

export interface ProductBatch {
  id: string
  shop_id: string
  product_id: string
  expiry_date: string   // DATE as YYYY-MM-DD
  quantity: number
  created_at: string
}

export interface AddBatchInput {
  product_id: string
  expiry_date: string   // YYYY-MM-DD
  quantity: number
}

// --- Shared barcode catalog ---

export interface BarcodeCatalogEntry {
  id: string
  barcode: string
  name: string
  category: string | null
  created_at: string
  updated_at: string
}

// --- Admin dashboard ---

export interface AdminPayment {
  id: string
  shop_id: string
  amount: number
  method: 'eft' | 'cash' | 'card' | 'other'
  reference: string | null
  notes: string | null
  recorded_by: string
  recorded_at: string
}

export interface AdminShopListItem {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  subscription_status: SubscriptionStatus
  access_granted: boolean
  created_at: string
  owner_email: string | null
  last_payment_at: string | null
}

export interface StockMovementEntry {
  date: string // YYYY-MM-DD
  product_name: string
  type: 'sale' | 'adjustment'
  delta: number
  reason: string | null
}

export interface ExpiringProductAlert {
  name: string
  expired_qty: number
  expiring_soon_qty: number
  earliest_expiry: string // YYYY-MM-DD
}

// --- Expiry page (Phase 19a) ---

export interface BatchDetail {
  id: string
  expiry_date: string   // YYYY-MM-DD
  quantity: number
  status: 'expired' | 'expiring_soon' | 'ok'
}

export interface ExpiryProductDetail {
  product_id: string
  product_name: string
  barcode: string | null
  stock_qty: number
  urgency: 'expired' | 'expiring_soon' | 'ok'
  batches: BatchDetail[]
}

// --- Sale batch consumption audit (Phase 19b) ---

export interface SaleBatchConsumption {
  id: string
  sale_id: string
  batch_id: string
  product_id: string
  qty_consumed: number
  expiry_date: string   // DATE as YYYY-MM-DD
  created_at: string
}

export interface ShopProduct {
  id: string
  name: string
  barcode: string | null
  price: number
  stock_qty: number
}

export interface AdminOverviewStats {
  totalShops: number
  activeShops: number
  trialingShops: number
  expiredShops: number
  manualOverrideShops: number
  recentSignUps: number
}

// --- Suppliers (Phase 30a) ---

export type SupplierType = 'wholesaler' | 'distributor' | 'farmer' | 'other'

export interface Supplier {
  id: string
  shop_id: string
  name: string
  contact_number: string | null
  type: SupplierType | null
  location: string | null
  created_at: string
}

export interface CreateSupplierInput {
  name: string
  contact_number?: string | null
  type?: SupplierType | null
  location?: string | null
}

// --- Goods received (Phase 30b) ---

export interface GoodsReceived {
  id: string
  shop_id: string
  product_id: string
  supplier_id: string | null
  quantity: number
  notes: string | null
  received_by: string | null
  received_at: string
}

export interface CreateGoodsReceivedInput {
  product_id: string
  quantity: number
  supplier_id?: string | null
  notes?: string | null
}

/** Goods received row joined with product + supplier names (for list/reports). */
export interface GoodsReceivedWithNames extends GoodsReceived {
  product_name: string
  supplier_name: string | null
}

// --- Daily checklist (Phase 31) ---

export type ExpiredItemsAction = 'none_found' | 'removed' | 'skipped'

export interface DailyChecklist {
  id: string
  shop_id: string
  date: string                // YYYY-MM-DD (SAST)
  fridge_ok: boolean | null
  fridge_temp: number | null
  freezer_ok: boolean | null
  freezer_temp: number | null
  surfaces_cleaned: boolean | null
  floor_cleaned: boolean | null
  storage_clean: boolean | null
  waste_bins_ok: boolean | null   // Phase 33 — "waste bins emptied and area clean?"
  expired_items_action: ExpiredItemsAction | null
  completed_by: string | null
  completed_at: string
  updated_at: string
}

export interface DailyChecklistInput {
  fridge_ok?: boolean | null
  fridge_temp?: number | null
  freezer_ok?: boolean | null
  freezer_temp?: number | null
  surfaces_cleaned?: boolean | null
  floor_cleaned?: boolean | null
  storage_clean?: boolean | null
  waste_bins_ok?: boolean | null
  expired_items_action?: ExpiredItemsAction | null
}

// --- Business documents (Phase 32) ---

export type DocumentType =
  | 'municipal_registration'
  | 'coa'
  | 'cipc'
  | 'business_license'
  | 'owner_id'
  | 'sars_tax'
  | 'uif'
  | 'food_safety_training'
  | 'smmesa'

export type DocumentStatus =
  | 'valid'
  | 'expired'
  | 'pending'
  | 'not_registered'
  | 'not_required'
  | 'on_file'
  | 'in_progress'   // Phase 37c — owner tapped "I've applied" but not yet received

export interface BusinessDocument {
  id: string
  shop_id: string
  document_type: DocumentType
  status: DocumentStatus
  reference_number: string | null
  date_issued: string | null        // YYYY-MM-DD
  expiry_date: string | null        // YYYY-MM-DD
  notes: string | null
  applied_at: string | null         // Phase 37c — set when status flips to 'in_progress'
  created_at: string
  updated_at: string
}

export interface UpsertBusinessDocumentInput {
  status: DocumentStatus
  reference_number?: string | null
  date_issued?: string | null
  expiry_date?: string | null
  notes?: string | null
  applied_at?: string | null
}

export type DocumentOverallStatus = 'grey' | 'green' | 'amber' | 'red'

export interface DocumentExpiryWarning {
  document_type: DocumentType
  expiry_date: string
  days_remaining: number             // negative if already expired
}

export interface DocumentStatusSummary {
  overall: DocumentOverallStatus
  totalLogged: number                // rows present
  validCount: number                 // status in ('valid','on_file')
  expiringSoon: DocumentExpiryWarning[]
  expired: DocumentExpiryWarning[]
  missing: DocumentType[]            // document_types with no row yet
}

export interface ChecklistStats {
  completedDays: number     // days with a row present in the window
  totalDays: number         // window size (e.g. 30)
  compliancePct: number     // 0..100, completedDays/totalDays * 100, rounded
  cleaningRate: number      // 0..100, pct of completed days where all 3 cleaning booleans true
  avgFridgeTemp: number | null
  avgFreezerTemp: number | null
  outOfRangeDays: number    // count of completed days where fridge outside 1-5 OR freezer > -18
}

// --- Waste & pest control (Phase 33) ---

export interface PestControlLog {
  id: string
  shop_id: string
  visit_date: string           // YYYY-MM-DD
  provider_name: string
  treatment_type: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface CreatePestControlLogInput {
  visit_date: string
  provider_name: string
  treatment_type: string
  notes?: string | null
}

export type WasteRemovalType = 'municipal' | 'private' | 'self_disposal'
export type WasteFrequency = 'daily' | 'weekly' | 'twice_weekly' | 'monthly' | 'other'

export interface WasteManagement {
  shop_id: string
  removal_type: WasteRemovalType
  frequency: WasteFrequency
  provider_name: string | null
  last_confirmed_date: string | null   // YYYY-MM-DD (SAST)
  updated_at: string
}

export interface UpsertWasteManagementInput {
  removal_type: WasteRemovalType
  frequency: WasteFrequency
  provider_name?: string | null
}

// --- Compliance score (Phase 34a) ---

export type ComplianceScoreCategoryKey =
  | 'checklist'
  | 'expiry'
  | 'suppliers'
  | 'documents'
  | 'waste_pest'

export type ComplianceScoreBand = 'green' | 'amber' | 'red'

/** Inputs for the pure `computeComplianceScore` helper — all already derivable from existing queries. */
export interface ComplianceScoreInputs {
  checklistCompliancePct: number      // 0–100 — reuse computeChecklistStats.compliancePct
  expiredBatchCount: number           // count of batches with quantity > 0 AND expiry_date < today
  productCount: number                // total products in shop
  productsWithSupplier: number        // products where supplier_id IS NOT NULL
  documentOverall: DocumentOverallStatus  // from computeDocumentStatus
  pestOverdue: boolean                // isPestOverdue(lastVisit, today)
  wasteStale: boolean                 // isWasteConfirmationStale(lastConfirmed, today)
}

export interface ComplianceScoreCategory {
  key: ComplianceScoreCategoryKey
  weight: number                      // 0–100 (sums to 100 across all categories)
  score: number                       // 0–100 within category
  weighted: number                    // score * weight / 100 — category contribution to overall
  /** i18n key in the `inspection` namespace; null when score == 100 (no tip needed). */
  tipKey: string | null
  /** Optional params for the tip's i18n interpolation. */
  tipParams?: Record<string, number>
}

export interface ComplianceScoreResult {
  overall: number                     // 0–100 rounded
  band: ComplianceScoreBand
  categories: ComplianceScoreCategory[]
}

// --- Access requests (Phase 36c) ---

export type AccessRequestFeature = 'inventory'
export type AccessRequestStatus =
  | 'pending'
  | 'granted'
  | 'denied'
  | 'revoked'
  | 'expired'

export interface AccessRequest {
  id: string
  shop_id: string
  teller_id: string
  feature: AccessRequestFeature
  status: AccessRequestStatus
  requested_at: string
  resolved_at: string | null
  resolved_by: string | null
  expires_at: string | null
}

/** Listed by the owner's bell — joined with the teller's name for display. */
export interface AccessRequestWithTeller extends AccessRequest {
  teller_name: string
}

/** What the teller's `/api/access-requests/me` endpoint returns. */
export interface TellerAccessStatus {
  /** True iff there's a non-expired 'granted' row for this teller's `inventory` feature. */
  has_access: boolean
  /** ISO timestamp when access expires; null when no active grant. */
  expires_at: string | null
  /** Most-recent request (any status), used to drive the request-access UI. */
  current_request: AccessRequest | null
}

// --- Municipality directory (Phase 37a) ---

export type Province =
  | 'gauteng'
  | 'western_cape'
  | 'kzn'
  | 'eastern_cape'
  | 'free_state'
  | 'limpopo'
  | 'mpumalanga'
  | 'north_west'
  | 'northern_cape'

export type OfficeType =
  | 'trading_permit'
  | 'environmental_health'
  | 'business_licensing'
  | 'customer_care'

export type RequirementType = 'trading_permit' | 'coa' | 'general'

export type NationalityType = 'sa_citizen' | 'foreign_national'

export type DocumentRequirementAppliesTo = NationalityType | 'all'

export interface DocumentRequirement {
  name: string
  applies_to: DocumentRequirementAppliesTo
  required: boolean
  notes?: string | null
}

export interface Municipality {
  id: string
  name: string
  province: Province
  short_name: string
  areas: string[]
  created_at: string
}

export interface MunicipalityOffice {
  id: string
  municipality_id: string
  office_type: OfficeType
  name: string
  address: string
  area: string | null
  phone: string | null
  email: string | null
  hours: string | null
  online_portal_url: string | null
  online_form_url: string | null
  notes: string | null
  created_at: string
}

export interface MunicipalityRequirement {
  id: string
  municipality_id: string
  requirement_type: RequirementType
  documents_required: DocumentRequirement[]
  fees: string | null
  estimated_processing_time: string | null
  additional_notes: string | null
  created_at: string
}

// --- Compliance Onboarding (Phase 37b) ---

export interface OwnerProfile {
  user_id: string
  nationality_type: NationalityType | null
  food_safety_training_completed: boolean
  food_safety_training_date: string | null     // YYYY-MM-DD
  food_safety_training_provider: string | null
  // Phase 37e — Fund Readiness Checker (priority status)
  has_disability: boolean
  created_at: string
  updated_at: string
}

/** 3-state toggle used on Document Status screen — mapped to DocumentStatus server-side. */
export type DocumentToggleState = 'have' | 'unsure' | 'unselected'

/** Doc types asked about during the compliance-onboarding flow.
 *  UIF is conditional — only shown when has_employees=true. */
export type OnboardingDocumentType =
  | 'municipal_registration'
  | 'coa'
  | 'cipc'
  | 'sars_tax'
  | 'uif'

/** What the modal POSTs to /api/compliance-onboarding when the user finishes. */
export interface ComplianceOnboardingPayload {
  nationality_type: NationalityType
  // exactly one of these is set:
  municipality_id?: string | null
  municipality_area_text?: string | null
  has_employees: boolean
  document_states: Partial<Record<OnboardingDocumentType, DocumentToggleState>>
  food_safety_training_completed: boolean
  food_safety_training_date?: string | null      // YYYY-MM-DD; required iff completed=true
  food_safety_training_provider?: string | null
  fund_interest: boolean                         // server forces false for foreign_national
}

/** Status badge shown on Screen 8 — Your Journey summary. */
export type JourneyStepStatus = 'done' | 'todo'

export interface JourneyStep {
  document_type: OnboardingDocumentType | 'food_safety_training'
  status: JourneyStepStatus
  /** 1-based ordinal among 'todo' steps; null for 'done'. */
  stepNumber: number | null
}

// --- Compliance Journey Hub (Phase 37c) ---

/**
 * The 7 compliance steps shown at /compliance/journey, in dependency order.
 * `cipc`, `sars_tax`, `uif` and `food_safety_training` have no prerequisites;
 * `coa` requires food-safety training; `municipal_registration` (the trading
 * permit) requires CIPC + SARS + food-safety training; `smmesa` requires CIPC.
 */
export type JourneyStepKey =
  | 'municipal_registration'   // Step 1 — Trading Permit
  | 'coa'                      // Step 2 — Health Certificate
  | 'cipc'                     // Step 3
  | 'sars_tax'                 // Step 4
  | 'uif'                      // Step 5 — only if has_employees
  | 'food_safety_training'     // Step 6
  | 'smmesa'                   // Step 7 — only if SA + fund_interest

/** 4-state badge shown on each journey card. */
export type ComplianceJourneyStepStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'locked'

export interface ComplianceJourneyStep {
  key: JourneyStepKey
  /** 1-based ordinal across the visible steps; matches what the UI labels "Step N". */
  stepNumber: number
  status: ComplianceJourneyStepStatus
  /** Other JourneyStepKeys this step waits on. Empty when no prerequisites. */
  dependencies: JourneyStepKey[]
  /** When status === 'locked', the step keys still preventing it. */
  blockedBy: JourneyStepKey[]
  /** Backing business_documents row, or null when the step has never been touched. */
  document: BusinessDocument | null
}

/** Action POSTed to /api/compliance/journey/step to flip a step's state. */
export type JourneyStepAction = 'mark_done' | 'mark_applied' | 'mark_received' | 'reset'

export interface JourneyStepActionInput {
  document_type: DocumentType
  action: JourneyStepAction
  reference_number?: string | null
  date_issued?: string | null    // YYYY-MM-DD
  expiry_date?: string | null    // YYYY-MM-DD
}

/** Composite payload returned by GET /api/compliance/journey. */
export interface ComplianceJourneyData {
  ownerProfile: OwnerProfile | null
  shop: Pick<
    Shop,
    | 'id'
    | 'name'
    | 'location'
    | 'whatsapp_number'
    | 'has_fridge'
    | 'has_freezer'
    | 'has_employees'
    | 'fund_interest'
    | 'municipality_id'
    | 'municipality_area_text'
    | 'registration_number'
  >
  ownerEmail: string | null
  municipality: Municipality | null
  permitOffices: MunicipalityOffice[]
  healthOffices: MunicipalityOffice[]
  permitRequirements: DocumentRequirement[]
  coaRequirements: DocumentRequirement[]
  documents: BusinessDocument[]
  tellers: Teller[]
  productNames: string[]
  monthlyRevenueZar: number    // 0 if no sales in the last 30 days
  steps: ComplianceJourneyStep[]
  inspectionReadiness: InspectionReadinessResult
}

/** Single readiness check rendered in the InspectionReadinessPanel. */
export interface InspectionReadinessCheck {
  key: string                        // i18n key in the `inspection` namespace
  pass: boolean
  fixHref: string                    // route to take the owner to fix the issue
}

export interface InspectionReadinessResult {
  checks: InspectionReadinessCheck[]
  passing: number
  total: number
}
