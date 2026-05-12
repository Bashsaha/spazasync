# Movestock — Task Tracking

## BUG-026 → 028 — Inventory cluster UX (proposed, not started)

### BUG-026 — Back buttons in Inventory pages route to /dashboard instead of /inventory
**Symptom:** From the Inventory tab, tapping a card (Stock, Products, Count Stock, Expiry, Suppliers) opens the page — but the "Back" link in the page header sends the user to `/dashboard`, breaking the tab's mental model. Users expect to land back on the Inventory hub.
**Files to touch (change `href="/dashboard"` → `href="/inventory"` on the back link only):**
- `src/app/(app)/products/page.tsx:51`
- `src/app/(app)/products/new/page.tsx`
- `src/app/(app)/products/[id]/page.tsx`
- `src/app/(app)/stock/page.tsx:114`
- `src/app/(app)/stock/[id]/page.tsx`
- `src/app/(app)/stock-take/page.tsx:144`
- `src/app/(app)/expiry/page.tsx:224`
- `src/app/(app)/suppliers/new/page.tsx`
- `src/app/(app)/suppliers/[id]/page.tsx`
**Out of scope (similar issue on Manage cluster — `checklist`, `inspection`, `documents/[type]`, `tellers`, `waste-pest/*`):** not touching unless you say so — those are owned by `/manage`, not `/inventory`. Ask if you want them fixed in the same pass.

### BUG-027 — Stock-take "Update Stock" sticky button hidden behind the New Sale FAB
**Symptom:** On `/stock-take`, the sticky bottom submit bar sits at `bottom-0` (covered by the 72px `BottomNav`) and the floating "New Sale" FAB sits at `bottom: 72px + safe-area` — so the submit button is double-covered: invisible under the nav and obscured by the FAB.
**Root cause:** Two competing fixed-position elements. The submit bar uses `fixed bottom-0`, ignoring the `BottomNav` that already paints there. The page-level FAB has nothing to defer to.
**Fix:**
1. Lift the sticky submit bar on `stock-take/page.tsx` above the `BottomNav` — change wrapper to `fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))]` (64px ≈ nav height; FAB sits at 72px above the same baseline, so the submit bar will sit just below the FAB without overlap).
2. Hide the New Sale FAB on `/stock-take` — extend the existing exclusion list in `BottomNav.tsx` (already hides on `/sale`). The Update Stock button IS the primary action on this page; two CTAs fighting for the same corner is the bug. Pattern already used on `/sale`.
3. Bump `<main>` padding-bottom from `pb-32` to `pb-44` so the last counted row clears the lifted submit bar.
4. While we're here: extend the same `pb-32 → pb-40+` rule wherever a list ends near the FAB. Audit `/products`, `/stock`, `/expiry`, `/suppliers` — verify last list item has ≥ 96px clearance from the FAB top edge. (FAB top = `bottom 72px + h-14` = ~128px from screen bottom.) Only change pages that currently let content sit under the FAB.

### BUG-028 — Add "products without supplier" nudge alongside "products without cost"
**Feature:** Mirror the existing missing-cost nudge so owners can spot products with no supplier linked. UX intentionally softer than missing-cost (cost feeds the profit dashboard — a hard data gap; supplier is operationally useful but not blocking).

**UX rules I'm proposing (call out anything you want changed):**
1. **Tone:** "Tip", not "Alert". Use **slate/gray** card (not amber). Amber should mean *something is wrong*; supplier-less products aren't wrong, they're just less useful for the goods-received flow + compliance docs.
2. **Where it appears:**
   - On `/stock-take` — below the missing-cost banner (when missing-cost is amber, supplier tip is gray; visual hierarchy preserves "cost first" priority).
   - On `/products` — same gray tip banner with a "Show only" filter, matching the missing-cost pattern.
3. **No nag if zero suppliers exist on the shop yet.** A shop with 0 suppliers should be nudged to *create* suppliers first, not flagged for "missing supplier on every product". So: if `suppliers.count === 0`, suppress the banner entirely and instead the tip text says "Add your first supplier" linking to `/suppliers/new`. (Prevents a noisy "47 products without supplier!" the moment they open the app.)
4. **No pill on the product row.** Missing-cost gets a pill because cost gaps blow up profit charts. Supplier gaps don't break anything — keep the row clean. Tip lives in the banner only.
5. **Not gated on a toggle** (unlike missing-cost which gates on `profit_tracking_enabled`). Supplier tracking is always on once you have ≥1 supplier.
6. **Dismiss?** No persistent dismiss. The banner disappears the moment count hits 0. Adding a dismiss state isn't worth a new column.

**Implementation:**
- `src/app/api/settings/route.ts` GET: add `products_missing_supplier: number` and `suppliers_count: number` to the response (one extra `count: 'exact', head: true` query each, runs in parallel with the existing missing-cost count).
- `src/lib/db/products.ts` `listProducts`: add `opts.missingSupplier?: boolean` → `query.is('supplier_id', null)`.
- `src/app/(app)/products/page.tsx`: accept `missing_supplier=1` searchParam, fetch the count, render the gray banner + filter toggle.
- `src/app/(app)/stock-take/page.tsx`: render the gray tip card under the missing-cost amber card.
- i18n: new keys in `stock.json` (`missing_supplier_tip`, `missing_supplier_btn`) and `products.json` (`missing_supplier_banner`, `missing_supplier_filter_active`, `missing_supplier_filter_btn`, `missing_supplier_show_all`, `missing_supplier_all_done`, `add_first_supplier_tip`) — **× 5 locales** (`en`, `so`, `am`, `zu`, `ur`) per the i18n Coverage Rule. Parity test must stay green.

**Out of scope:**
- No DB migration (uses existing `products.supplier_id`).
- No new API routes.
- No changes to the goods-received flow.
- No backfill UI (linking suppliers in bulk) — separate phase if requested.

### Verification before marking complete
- `npx tsc --noEmit` clean.
- `npm test` — 616/616 still green (including `i18n.test.ts` parity).
- Manual smoke on dev server: tab into Inventory → open each of the 5 child pages → tap Back → confirm lands on `/inventory`. Open `/stock-take` with ≥1 product → confirm "Update Stock" button visible, not under FAB, FAB hidden. Set one product's `supplier_id=null` → confirm gray tip appears on `/stock-take` and `/products`, filter works, banner disappears when all products have suppliers.
- Add entries to `tasks/bugs.md` for BUG-026 and BUG-027 (BUG-028 is a feature, not a bug — skip).

### Open questions for you before I start
1. Manage-cluster back buttons (checklist, inspection, documents, tellers, waste-pest) — fix in the same pass, or leave for later?
2. The "Add your first supplier" fallback on shops with 0 suppliers — keep, or just show nothing?
3. Anywhere else in the app you've noticed FAB-overlap I should clean up while the audit is live?

---

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
