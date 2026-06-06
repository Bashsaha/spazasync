// ============================================================
// Movestock — Compliance module types
// (daily checklist, business documents, waste & pest, score,
//  access requests, municipality directory, onboarding,
//  journey hub, smart reminders & admin alerts)
// ============================================================

import type { Shop, Teller } from './core'

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

/** Visa / permit type captured for foreign-national owners (Phase 37f). */
export type VisaType =
  | 'business_visa'
  | 'asylum_seeker_s22'
  | 'refugee_s24'
  | 'work_permit'
  | 'other'

export interface OwnerProfile {
  user_id: string
  nationality_type: NationalityType | null
  food_safety_training_completed: boolean
  food_safety_training_date: string | null     // YYYY-MM-DD
  food_safety_training_provider: string | null
  // Phase 37e — Fund Readiness Checker (priority status)
  has_disability: boolean
  // Phase 41a — sub-question shown to foreign-born owners only. TRUE means
  // they were naturalised SA citizens before 1994 (so they qualify for the
  // Spaza Shop Support Fund per the SEFA guideline). NULL = not asked.
  naturalised_pre_1994: boolean | null
  // Phase 37f — Foreign National Path. Both null for SA citizens.
  visa_type: VisaType | null
  visa_expiry_date: string | null              // YYYY-MM-DD; null when "doesn't expire / don't know"
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
  // Phase 37f — only set when nationality_type === 'foreign_national'.
  // Server forces both to null for SA citizens (defence in depth).
  visa_type?: VisaType | null
  visa_expiry_date?: string | null               // YYYY-MM-DD; null when owner picked "I don't know / doesn't expire"
  // Phase 41a — only set when nationality_type === 'foreign_national'.
  // Server forces null for SA citizens.
  naturalised_pre_1994?: boolean | null
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
  | 'right_to_trade'           // Foreign-national-only prerequisite (visa/permit). No business_documents row — status derives from owner_profiles.visa_type.
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

// --- Smart Reminders & Nudges (Phase 37g) ---

export type ReminderType =
  | 'coa_expiry'
  | 'permit_expiry'
  | 'cipc_annual'
  | 'visa_expiry'
  | 'journey_nudge'
  | 'fund_nudge'
  | 'fund_qualified'
  | 'score_drop'
  | 'checklist_streak'
  | 'admin_alert'
  | 'products_missing_cost'
  | 'products_missing_supplier'

export type ReminderPriority = 'urgent' | 'high' | 'normal' | 'low'

export type AdminAlertPriority = 'normal' | 'high' | 'urgent'
export type AdminAlertAudience = 'all' | 'sa_citizen' | 'foreign_national'

/** Banner-ready reminder served to the dashboard. Title/body/CTA copy are i18n
 *  keys (in the `compliance-reminders` namespace) plus interpolation params. */
export interface Reminder {
  /** Unique within the cycle — also used as the `compliance_reminders.reminder_key`. */
  key: string
  type: ReminderType
  priority: ReminderPriority
  /** i18n key for the title. */
  titleKey: string
  /** i18n key for the body copy. */
  bodyKey: string
  /** Interpolation params for both titleKey and bodyKey. */
  params?: Record<string, string | number>
  /** Optional CTA. When set, banner renders a link to `ctaHref` with `ctaKey` label. */
  ctaKey?: string
  ctaHref?: string
}

/** Persisted ledger row tracking when a reminder was first shown / dismissed. */
export interface ComplianceReminderRow {
  id: string
  shop_id: string
  reminder_type: ReminderType
  reminder_key: string
  shown_at: string | null
  dismissed_at: string | null
  created_at: string
}

export interface AdminAlert {
  id: string
  title: string
  message: string
  link_text: string | null
  link_url: string | null
  priority: AdminAlertPriority
  target_audience: AdminAlertAudience
  starts_at: string
  expires_at: string | null
  created_at: string
}

export interface CreateAdminAlertInput {
  title: string
  message: string
  link_text?: string | null
  link_url?: string | null
  priority?: AdminAlertPriority
  target_audience?: AdminAlertAudience
  starts_at?: string
  expires_at?: string | null
}

export type UpdateAdminAlertInput = Partial<CreateAdminAlertInput>

/** Inputs to the pure reminder evaluator — every field already derivable from existing readers. */
export interface ReminderEvaluatorInputs {
  /** SAST date in YYYY-MM-DD — drives all expiry math + bucket keys. */
  todayISO: string
  ownerProfile: OwnerProfile | null
  shop: Pick<Shop, 'has_employees' | 'fund_interest'>
  documents: BusinessDocument[]
  /** Steps from generateJourneySteps — used to detect incomplete journeys. */
  journeySteps: ComplianceJourneyStep[]
  /** Most-recent activity timestamp on the journey (max of document.updated_at). */
  lastJourneyActivity: string | null
  complianceScore: number
  scoreBand: ComplianceScoreBand
  /** Number of full days since the last completed daily_checklists row (0 = today). */
  daysSinceChecklist: number
  /** Did the shop complete its checklist for today? */
  checklistCompletedToday: boolean
  /** Active admin alerts visible to this owner (already filtered by audience). */
  adminAlerts: AdminAlert[]
  /** Existing ledger rows so the evaluator can apply caps + dismiss filters. */
  ledger: ComplianceReminderRow[]
  /** True iff the shop currently qualifies for the fund (green status). */
  fundQualified: boolean
  /** Count of products with NULL cost_price. Drives the "products_missing_cost" reminder. */
  productsMissingCost: number
  /** Count of products with NULL supplier_id. Drives the "products_missing_supplier" reminder. */
  productsMissingSupplier: number
  /** Count of suppliers for the shop. Used to suppress the missing-supplier reminder
   *  when the shop has 0 suppliers (day-one shops shouldn't be told to assign suppliers
   *  before they've added any — same rule as the BUG-028 inventory tip). */
  suppliersCount: number
}
