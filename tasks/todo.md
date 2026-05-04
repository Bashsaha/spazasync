# Movestock — Task Tracking

## Phase 37 — Compliance Module (7 sub-phases)

The Compliance Module helps spaza shop owners get legally compliant: trading permits, Certificates of Acceptability, fund applications, document packs. Read [docs spec from user] for full scope, design rules, build order. **DO NOT auto-start a sub-phase — wait for explicit go-ahead between each one per Phase Gating rule.**

### Phase 37a — Municipality Directory (Phase C in spec) ✅ COMPLETE

**Goal:** A pure data layer of South African municipality offices, addresses, contacts, document requirements. Every later compliance phase auto-populates "where to go" / "what to bring" instructions from this. No user-facing screens this phase.

**Constraint (CLAUDE.md design rule 7):** Only government-verified sources. All seed data is sourced from the spec doc which references official `.gov.za` / municipality sites.

**Non-goals (this phase):**
- No UI, no API routes, no i18n changes (data isn't user-facing yet)
- No changes to any existing feature

- [ ] Migration `021_municipalities.sql`:
  - `municipalities` (id, name, province, short_name, areas TEXT[], created_at)
  - `municipality_offices` (FK municipality_id, office_type CHECK enum, name, address, area, phone, email, hours, online_portal_url, online_form_url, notes)
  - `municipality_requirements` (FK municipality_id, requirement_type CHECK enum, documents_required JSONB, fees, estimated_processing_time, additional_notes)
  - Indexes: FK indexes + GIN on `municipalities.areas`
  - RLS ON, public-read SELECT policy (reference data anyone can read), no INSERT/UPDATE/DELETE policies (service-role only writes)
- [ ] Types in `src/types/index.ts`: `Province`, `OfficeType`, `RequirementType`, `NationalityType`, `DocumentRequirement`, `Municipality`, `MunicipalityOffice`, `MunicipalityRequirement`
- [ ] Zod schemas in `src/lib/validation/schemas.ts`: `documentRequirementSchema`, `municipalitySchema`, `municipalityOfficeSchema`, `municipalityRequirementSchema`
- [ ] DB helpers in `src/lib/db/municipalities.ts`: `listMunicipalities`, `getMunicipalitiesByProvince`, `getMunicipalityById`, `findMunicipalityByArea` (case-insensitive), `getOfficesForMunicipality(id, type?)`, `getRequirements(id, type, nationality)` (filters JSONB by `applies_to`)
- [ ] Seed script `scripts/seed-municipalities.ts`: idempotent upsert by `(name, province)`. Seeds 6 metros: Johannesburg, Tshwane, Ekurhuleni, eThekwini, Cape Town, Mangaung. Each with offices + trading_permit requirements per spec.
- [ ] Tests `tests/unit/municipalities.test.ts`:
  - Requirement filter: sa_citizen sees `applies_to ∈ {sa_citizen, all}`; foreign_national sees `applies_to ∈ {foreign_national, all}`
  - Area lookup is case-insensitive
  - Province filter returns correct subset
- [ ] Run typecheck + vitest — both clean
- [ ] Output raw SQL → user runs in Supabase SQL Editor
- [ ] Verify via REST: `municipalities`, `municipality_offices`, `municipality_requirements` all exist
- [ ] Run seed script (`npx tsx scripts/seed-municipalities.ts`) — verify rows present
- [ ] Phase Completion Protocol: Glob, file-tree update, add Phase 37a to Living Scope, commit `feat: Phase 37a — Municipality Directory`, push, output checklist

### Acceptance

- 3 new tables exist in Supabase with RLS on, public-readable
- 6 metros seeded
- `findMunicipalityByArea('Soweto')` returns Johannesburg row
- `getRequirements(jhb_id, 'trading_permit', 'sa_citizen')` returns SA-applicable docs only
- All existing tests still pass (no regressions)
- No existing feature touched

### Phase 37b — Compliance Onboarding (Phase A in spec) ✅ COMPLETE

8-screen modal (we added Employees as a separate screen so UIF gating is explicit; total grew from 7→8). Shipped:
- Migration 022: `owner_profiles` (PK = auth.users.id, RLS scoped to own row); `shops` extended with `municipality_id`/`municipality_area_text`/`has_employees`/`fund_interest`/`onboarding_compliance_completed`/`onboarding_compliance_dismissed_at`/`onboarding_compliance_dismiss_count`; `business_documents.document_type` CHECK extended with `sars_tax`/`uif`/`food_safety_training`/`smmesa` (no reuse of `business_license` for SARS).
- Pure helpers in `lib/compliance/onboarding.ts` (toggle↔status mapping, journey-step ordering, banner-snooze rules) — fully unit tested.
- API: `POST /api/compliance-onboarding`, `POST /api/compliance-onboarding/dismiss`, `GET /api/municipalities` (public list for AreaPicker).
- 13 components under `src/components/compliance-onboarding/`.
- `/onboarding` shop-setup step now requires Area (compulsory municipality dropdown + "Other / not sure" → free-text fallback resolved server-side).
- Settings has a Compliance section + "Redo compliance check" button that resets the snooze and reopens the modal on `/dashboard`.
- New i18n namespace `compliance-onboarding` × 5 locales; existing `auth` namespace gained area-question keys × 5 locales.
- Dashboard ComplianceCard score deliberately scoped to original 5 doc types via `CORE_COMPLIANCE_DOC_TYPES` (avoids regression for shops not yet onboarded).
- 470/470 unit tests pass (29 new).

### Phase 37d — Document Generation Engine (Phase E in spec) ✅ COMPLETE

5 PDF endpoints producing pre-filled paperwork the owner prints + takes to municipality / SEFA.
Reuses existing jsPDF + autotable stack and `getComplianceReportData()`. Honours Design Rule 6 — no ID/passport/tax numbers embedded.

- [ ] `src/lib/pdf/shared.ts` — header/footer, brand colours, page-break helpers (extracted from compliance-pdf)
- [ ] `src/lib/db/owner-profile-report.ts` — composite reader: owner profile + shop + goods description + sales rollup
- [ ] `src/app/api/reports/trading-permit-summary/route.ts` (GET, owner-only)
- [ ] `src/app/api/reports/landlord-affidavit/route.ts` (GET, owner-only)
- [ ] `src/app/api/reports/goods-declaration/route.ts` (GET, owner-only)
- [ ] `src/app/api/reports/food-safety-pack/route.ts` (GET, owner-only, ?days=30)
- [ ] `src/app/api/reports/fund-application-pack/route.ts` (GET, owner-only, gated on SA + fund_interest)
- [ ] Wire `href` on TradingPermitStep + FoodSafetyStep GenerateDocButton calls
- [ ] Add "Generate Evidence Pack" button to `/inspection` page
- [ ] i18n keys: only if new strings needed; mirror across all 5 locales
- [ ] Tests: `tests/unit/pdf-reports.test.ts` — owner-profile aggregation, goods description, no-PII assertion
- [ ] typecheck + vitest clean
- [ ] Phase Completion Protocol

Acceptance:
- All 5 endpoints return application/pdf for an authenticated owner
- Generated PDFs contain NO `id_number` / `passport_number` / `tax_number` field values (regex test)
- Fund pack returns 403 for foreign nationals or `fund_interest=false`
- Buttons in TradingPermitStep + FoodSafetyStep render enabled (not "coming soon")
- No DB schema changes; no existing test regressions

### Phases 37e–37g (later)

- 37e — Fund Readiness Checker (Phase D)
- 37f — Foreign National Path (Phase G)
- 37g — Smart Reminders (Phase F)

---

## Phase Completion Protocol Reminder

After each sub-phase: run the full protocol in CLAUDE.md — Glob, file-tree diff, Living Scope check-off, "What was built" note, commit, push, checklist output. **STOP** after each — wait for user.

---

Phases 1–36c complete. See [ARCHIVE.md](../ARCHIVE.md) for detailed phase summaries.
