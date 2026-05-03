# Movestock — CLAUDE.md

## What this project is

Movestock (formerly SpazaSync) is a mobile-first PWA for South African spaza shop and small retail owners. They currently track sales on a calculator and stock manually. Movestock replaces that with: open app on Android phone → scan barcode → product added to sale → stock auto-deducts → in-app daily summary each evening.

**Target user:** no technical background. Plain English. No jargon. Mid-range Android, no laptop.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styling | Tailwind CSS |
| DB + Auth | Supabase (PostgreSQL, RLS, Supabase Auth) |
| Deployment | Vercel (+ Vercel Cron) |
| Validation | Zod |
| Testing | Vitest |
| Barcode | `@zxing/browser` (phone camera) |
| Offline | IndexedDB via `idb` |
| Timezone | `date-fns-tz` with `Africa/Johannesburg` |

---

## Auth Model

- **Owner** — email + password. Sees full app. Must select active teller before scanning on /sale.
- **Teller** — shop code + display name + password. Synthetic email `{slug}@shop-{code}.spazasync.app`. Locked to /sale only via proxy.ts. Auto-selected as active teller. RLS + synthetic email scoping prevents cross-shop access.
- **Admin** — email + password. Promoted via `npx tsx scripts/set-admin.ts user@example.com`. Sees `/admin/*`. **Dual-role:** if promoted from owner, retains shop_id and can access shop pages too. Skips subscription gate. Admin data via service role; shop data via RLS.

**Shop Code:** 6–10 char uppercase alphanumeric, globally unique (`shops.code`). Chosen at onboarding. Used on teller login.

### Access Matrix

| Route | Owner | Teller | Admin (dual-role) |
|---|---|---|---|
| /dashboard | ✓ | ✗ | ✓ (if linked) |
| /sale | ✓ | ✓ | ✓ (if linked) |
| /stock-take, /products, /stock, /tellers, /settings | ✓ | ✗ | ✓ (if linked) |
| /admin/* | ✗ | ✗ | ✓ |

---

## Database Schema

All tables have RLS enabled. `admin_payments` and `barcode_catalog` writes are service-role-only.

### Tables
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold, language ('en'/'so'/'am'/'zu'/'ur'), subscription_status, trial_ends_at, subscription_ends_at, payfast_token, access_granted, admin_notes, registration_number, location, has_fridge, has_freezer, municipality_id (FK→municipalities, ON DELETE SET NULL), municipality_area_text (free-text fallback when "Other / not sure" picked at signup), has_employees, fund_interest, onboarding_compliance_completed, onboarding_compliance_dismissed_at, onboarding_compliance_dismiss_count
- `shop_users` — maps auth users to shops with role (owner | teller)
- `tellers` — name (unique per shop), optional auth user_id, `food_safety_trained_at` (Phase 37c — Step 6 staff training)
- `products` — barcode (nullable), name, price, stock_qty, cost_price, supplier_id; unique(shop_id, barcode WHERE NOT NULL); unique(shop_id, LOWER(name))
- `product_batches` — shop_id, product_id, expiry_date, quantity (FEFO source of truth)
- `sales` — total, teller_id, completed_at, offline_id (UNIQUE for dedup), synced_at
- `sale_items` — product_id, quantity, unit_price, subtotal
- `stock_take_entries` — product_id, qty_before, qty_after, teller_id, taken_at
- `stock_adjustments` — product_id, qty_before, qty_after, delta, reason, adjusted_by, adjusted_at
- `admin_payments` — shop_id, amount, method, reference, notes (service-role only)
- `sale_batch_consumptions` — sale_id, batch_id, product_id, qty_consumed, expiry_date (FEFO audit)
- `barcode_catalog` — barcode (unique), name, category (RLS SELECT all, writes admin only)
- `suppliers` — shop_id, name, contact_number, type, location; unique(shop_id, LOWER(name))
- `goods_received` — shop_id, product_id, supplier_id, quantity, notes, received_by, received_at
- `access_requests` — shop_id, teller_id, feature ('inventory'), status (pending/granted/denied/revoked/expired), requested_at, resolved_at, resolved_by, expires_at; in `supabase_realtime` publication
- `daily_checklists` — shop_id, date (SAST), fridge_ok/temp, freezer_ok/temp, surfaces_cleaned, floor_cleaned, storage_clean, expired_items_action, waste_bins_ok, completed_by, completed_at; UNIQUE(shop_id, date)
- `business_documents` — shop_id, document_type (municipal_registration/coa/cipc/business_license/owner_id/sars_tax/uif/food_safety_training/smmesa), status (valid/expired/pending/not_registered/not_required/on_file/`in_progress` — added 37c), reference_number, date_issued, expiry_date, notes, `applied_at` (Phase 37c — set when owner taps "I've applied"); UNIQUE(shop_id, document_type). The dashboard ComplianceCard score still scopes to the original 5 doc types (see `CORE_COMPLIANCE_DOC_TYPES` in `lib/compliance/document-status.ts`); the journey hub (37c) uses its own status engine in `lib/compliance/journey.ts` covering all 7 step types.
- `owner_profiles` — Phase 37b. user_id PK (FK→auth.users ON DELETE CASCADE), nationality_type ('sa_citizen'|'foreign_national'), food_safety_training_completed, food_safety_training_date, food_safety_training_provider, created_at, updated_at. RLS: user can SELECT/INSERT/UPDATE their own row only. Service-role bypasses for atomic onboarding writes.
- `pest_control_logs` — shop_id, visit_date, provider_name, treatment_type, notes
- `waste_management` — shop_id (PK singleton), removal_type, frequency, provider_name, last_confirmed_date
- `municipalities` — id, name, province, short_name, areas TEXT[]; UNIQUE(name, province); GIN index on areas. Public-read RLS, service-role writes only.
- `municipality_offices` — FK municipality_id, office_type ('trading_permit'|'environmental_health'|'business_licensing'|'customer_care'), name, address, area, phone, email, hours, online_portal_url, online_form_url, notes. Public-read RLS.
- `municipality_requirements` — FK municipality_id, requirement_type ('trading_permit'|'coa'|'general'), documents_required JSONB array, fees, estimated_processing_time, additional_notes; UNIQUE(municipality_id, requirement_type). JSONB element shape: `{ name, applies_to: 'sa_citizen'|'foreign_national'|'all', required: bool, notes? }`. Public-read RLS.

### RLS helpers
- `user_in_shop(shop_id)` — SECURITY DEFINER
- `user_is_owner(shop_id)` — SECURITY DEFINER

### SQL functions
- `decrement_stock(p_product_id, p_qty)` — atomic decrement, clamp to 0
- `decrement_stock_fefo(p_product_id, p_qty, p_sale_id DEFAULT NULL)` — FEFO batch consumption; records to `sale_batch_consumptions` when sale_id given

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_SANDBOX=true
SUBSCRIPTION_PRICE_ZAR=349.99
NEXT_PUBLIC_APP_URL=
EXTERNAL_API_KEY=
```

---

## Workflow Rules

### Phase Gating (CRITICAL)
**NEVER auto-start the next phase.** After a phase: STOP, update CLAUDE.md (file tree, Living Scope, what was built), then WAIT for user to say "go".

### i18n Coverage Rule (CRITICAL)
Locales: `en`, `so`, `am`, `zu`, `ur`. Any user-facing string added/changed/removed in `src/lib/i18n/translations/en/*.json` MUST be mirrored in all 4 other locales **in the same phase**. Translations must be native, plain-English-tone (short, friendly, no jargon). Every page/component with user-visible text MUST use `useTranslation()` (client) or `getServerTranslations()` (server) — NEVER hardcode strings. Adding a new namespace `en/foo.json` requires `so/foo.json`, `am/foo.json`, `zu/foo.json`, `ur/foo.json` in the same commit. The `tests/unit/i18n.test.ts` test enforces parity.

### Bug Tracking (CRITICAL)
- After fixing any bug: add an entry to `tasks/bugs.md` (symptom, root cause, fix, prevention rule). Mandatory.
- Before touching auth/routing/middleware/API routes: read `tasks/bugs.md` and apply prevention rules.

### Plan + Verify
- Plan mode for any non-trivial task (3+ steps or architectural decisions). Re-plan on derailment.
- Never mark complete without proving it works (tests, logs, demonstrated behavior).
- For non-trivial changes, pause and ask "is there a more elegant way?" before presenting.

### Subagents
Use liberally for research/exploration to keep main context clean. One task per subagent.

### Phase Summary Compression (Rule 7)
After an entire phase **group** completes (e.g., all of 15a–15e), compress per-file detail into a 2–4 line summary per phase. Keep: key files/migrations, architectural decisions, notable bug fixes. Drop: per-file NEW/UPDATED annotations.

### Tasks
Plan to `tasks/todo.md` with checkable items → verify with user → mark progress → review section at end → update `tasks/lessons.md` after corrections.

---

## Supabase Access Rules

- **CAN read** via REST API with service role key from `.env.local`. Use `curl` with `apikey` + `Authorization` headers.
- **CANNOT write** (no migrations, no schema changes). Only the user runs SQL in Supabase SQL Editor.
- **Migration workflow:** (1) write `.sql` migration locally, (2) output raw SQL for user to paste, (3) verify via REST API: `curl -s "https://<project>.supabase.co/rest/v1/<table>?select=id&limit=0"` returns `[]` if exists.

---

## Git Safety Rules (CRITICAL — NO EXCEPTIONS)

**NEVER (even if asked):** `git push --force`/`-f`, `git reset --hard` on pushed branch, deleting main/master, `git clean -fd`/`-fx`, `rm -rf .git`, `gh repo delete`, broad `git checkout .`/`git restore .`, batch-deleting files/branches/commits without per-item review.

**Always OK:** `git add`, `git commit` (new commits, never amend unless asked), `git push` (no force), read-only inspection (`status`/`log`/`diff`), creating/switching branches, `git stash`.

**Confirm first:** any `git reset`, `git rebase`, branch deletion, any `gh` command that mutates remote.

**Defensive:** show `git log --oneline -5` and `git status` before destructive ops. Prefer new commits over amend/rebase. Ask if unsure.

---

## Living Project Awareness

### File Structure
The file tree below is ground truth. After every phase: Glob scan, diff against tree, update tree to match reality before marking complete.

### Phase Completion Protocol
1. Glob scan project root
2. Diff vs file tree below
3. Update file tree
4. Check off phase in Living Scope
5. Add "What was built" note
6. If phase has migration: output raw SQL, then verify via REST API before marking complete
7. Commit: `feat: Phase N — <desc>`, push to main
8. Output completion checklist to user
9. Mark todo complete
10. **STOP** — wait for user.

### Session Start Protocol
1. Read CLAUDE.md fully (mandatory)
2. Note completed phases (Living Scope)
3. Note current file structure
4. Review `tasks/lessons.md`
5. Read `tasks/bugs.md` (mandatory before auth/routing/API/middleware work)
6. Resume from last completed phase
7. Output session-start checklist confirming 1–6 done

---

## Living Scope

Phases 1–36c + 37a–37c complete. See [ARCHIVE.md](ARCHIVE.md) for detailed summaries (compressed per Rule 7).

Most recent:
- 36a Navigation Restructure (5-tab nav, hubs, dashboard cleanup, extended FAB)
- 36b Switch User (top app bar avatar + recent users on login)
- 36c Teller Access Requests + Realtime Notifications
- 37a Municipality Directory — pure data layer for the upcoming Compliance Module (37a–37g). 3 tables (`municipalities`, `municipality_offices`, `municipality_requirements`) with public-read RLS + service-role writes. 6 metros seeded from official `.gov.za` sources (Johannesburg, Tshwane, Ekurhuleni, eThekwini, Cape Town, Mangaung). DB helpers filter requirements by nationality (`sa_citizen` | `foreign_national`) so later phases can show personalised "what to bring" lists. No UI, no API routes, no i18n changes — pure foundation.
- 37c Compliance Journey Hub — third user-facing phase of the Compliance Module. New `/compliance/journey` route delivers a personalised 5–7 step plan (Trading Permit → Health Certificate → CIPC → SARS → UIF → Food Safety → SMMESA) with a 4-state status engine (`not_started` | `in_progress` | `complete` | `locked`) plus dependency rules (CoA needs food-safety training; Trading Permit needs CIPC + SARS + food-safety; SMMESA needs CIPC). Step cards collapse/expand and surface "What you need to bring" (from `municipality_requirements`), pre-filled "Your details" cards (per Design Rule 6 — ID/passport always blank, missing shop fields link to Settings), "Where to go" (from `municipality_offices`, with a generic fallback for un-seeded munis), and "Mark as done / I've applied / I've received" actions writing to `business_documents`. Migration 023 extends `business_documents.status` with `'in_progress'`, adds `applied_at TIMESTAMPTZ`, and adds `tellers.food_safety_trained_at` (Step 6 staff list). Reusable `<InspectionReadinessPanel>` extracted from `/inspection` to keep the CoA Step 2 readiness check single-sourced. New `JourneyProgressCard` on the dashboard mirrors the journey progress + an SA+fund_interest "R300k" teaser. New `compliance-journey` i18n namespace (~120 keys) × 5 locales — non-EN locales currently mirror EN values (parity tests pass; native translations are a follow-up). PDF generation for affidavits / evidence packs deferred to Phase 37e (buttons render disabled). 50 new unit tests in `tests/unit/journey.test.ts`.
- 37b Compliance Onboarding — first user-facing phase of the Compliance Module. New `owner_profiles` table (person-level, keyed to `auth.users(id)`) supports owners with multiple shops without duplicating nationality/training data. `shops` extended with `municipality_id`, `municipality_area_text`, `has_employees`, `fund_interest`, plus three onboarding-state columns driving the dashboard banner snooze (7-day → 30-day rules). `business_documents` CHECK constraint extended with `sars_tax`, `uif`, `food_safety_training`, `smmesa` — SARS is its own type, **not** reused as `business_license`, per "no legal shortcuts". Existing `/onboarding` shop-setup step now requires an Area answer (municipality dropdown + "Other / not sure" → free-text fallback resolved server-side via `findMunicipalityByArea()`). Bottom-sheet 8-screen modal opens automatically on first dashboard visit for fresh owners; banner+snooze for existing owners. Foreign nationals skip the Fund screen and `fund_interest` is force-set to `false` server-side. Toggle states (`have`/`unsure`/`unselected`) map to `business_documents.status` (`on_file`/`pending`/`not_registered`). Settings now has a "Redo compliance check" button that resets onboarding state and reopens the modal. New `compliance-onboarding` i18n namespace × 5 locales; existing `auth` namespace gained 7 area-related keys × 5 locales. Dashboard `ComplianceCard` deliberately still scopes its score to the original 5 doc types via `CORE_COMPLIANCE_DOC_TYPES` (see `lib/compliance/document-status.ts`) — preventing a regression for shops that haven't yet gone through the new onboarding. Journey hub (37c) will surface the new doc types separately.

When starting a new phase, append it here and update the file tree.

---

## Current File Tree

_Last updated: Phase 37c (2026-05-03)_

```
spaza shop/
├── ARCHIVE.md
├── CLAUDE.md
├── README.md
├── next.config.ts, next-env.d.ts, tsconfig.json
├── package.json, package-lock.json
├── postcss.config.mjs, tailwind.config.ts
├── vercel.json, vitest.config.ts
├── .env.local.example
├── public/
│   ├── manifest.json, offline.html, sw.js
│   └── icons/{icon.svg, icon-maskable.svg}
├── src/
│   ├── proxy.ts                           # Auth guard + role-based routing
│   ├── app/
│   │   ├── layout.tsx, error.tsx, not-found.tsx, page.tsx, globals.css, favicon.ico
│   │   ├── auth/callback/route.ts
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                 # Wraps in LanguageProvider
│   │   │   ├── login/page.tsx             # Owner + Teller tabs
│   │   │   └── onboarding/page.tsx        # Language → Account → Shop
│   │   ├── (app)/
│   │   │   ├── layout.tsx                 # LanguageProvider + ToastProvider + BottomNav + DailySummaryAlert
│   │   │   ├── error.tsx
│   │   │   ├── dashboard/{page.tsx, loading.tsx}     # Streaming with Suspense
│   │   │   ├── settings/page.tsx
│   │   │   ├── subscribe/page.tsx
│   │   │   ├── sale/{page.tsx, complete/page.tsx}
│   │   │   ├── expiry/{page.tsx, loading.tsx}
│   │   │   ├── stock-take/page.tsx
│   │   │   ├── stock/{page.tsx, loading.tsx, [id]/page.tsx}
│   │   │   ├── products/{page.tsx, new/page.tsx, [id]/page.tsx}
│   │   │   ├── tellers/{page.tsx, loading.tsx, new/page.tsx}
│   │   │   ├── suppliers/{page.tsx, new/page.tsx, [id]/page.tsx}
│   │   │   ├── checklist/{page.tsx, loading.tsx, history/page.tsx}
│   │   │   ├── documents/{page.tsx, loading.tsx, [type]/page.tsx}
│   │   │   ├── waste-pest/{page.tsx, pest/{page.tsx, new/page.tsx}, waste/page.tsx}
│   │   │   ├── inspection/{page.tsx, loading.tsx}
│   │   │   ├── sales/{page.tsx, history/page.tsx}    # Hub + drill-down
│   │   │   ├── inventory/{page.tsx, loading.tsx}     # Hub
│   │   │   ├── manage/page.tsx                       # Hub: Staff + Compliance + Journey
│   │   │   ├── compliance/                           # Phase 37c
│   │   │   │   ├── layout.tsx                        # Owner-only guard
│   │   │   │   └── journey/{page.tsx, loading.tsx}   # Compliance Journey Hub
│   │   │   # dashboard mounts <DashboardComplianceOnboarding> + <JourneyProgressCard> for owners
│   │   │   └── admin/
│   │   │       ├── layout.tsx, loading.tsx, page.tsx
│   │   │       ├── shops/{page.tsx, loading.tsx, [id]/page.tsx}
│   │   │       └── catalog/{page.tsx, loading.tsx, new/page.tsx, [id]/page.tsx}
│   │   └── api/
│   │       ├── auth/teller-login/route.ts
│   │       ├── onboarding/route.ts
│   │       ├── catalog/importable/route.ts
│   │       ├── products/{route.ts, [id]/route.ts, popular/route.ts, bulk-import/route.ts}
│   │       ├── sales/{route.ts, by-date/route.ts}
│   │       ├── batches/{route.ts, [id]/route.ts}
│   │       ├── stock/{route.ts, expiry/route.ts}
│   │       ├── stock-take/route.ts
│   │       ├── subscribe/{checkout/route.ts, notify/route.ts, status/route.ts}
│   │       ├── cron/expire-subscriptions/route.ts
│   │       ├── summary/daily/route.ts
│   │       ├── admin/
│   │       │   ├── overview/route.ts
│   │       │   ├── catalog/{route.ts, [id]/route.ts}
│   │       │   └── shops/{route.ts, [id]/{route.ts, payments/route.ts, access/route.ts, notes/route.ts, subscription/route.ts}}
│   │       ├── external/v1/
│   │       │   ├── overview/route.ts
│   │       │   └── shops/{route.ts, [id]/{route.ts, sales/route.ts, stock/route.ts, expiry/route.ts}}
│   │       ├── reports/{compliance-pdf/route.ts, monthly-sales-pdf/route.ts}
│   │       ├── settings/route.ts
│   │       ├── tellers/{route.ts, me/route.ts, [id]/route.ts}
│   │       ├── suppliers/{route.ts, [id]/route.ts}
│   │       ├── goods-received/route.ts
│   │       ├── daily-checklist/{route.ts, history/route.ts}
│   │       ├── business-documents/{route.ts, [type]/route.ts}
│   │       ├── pest-control/{route.ts, [id]/route.ts}
│   │       ├── waste-management/{route.ts, confirm/route.ts}
│   │       ├── compliance-score/route.ts
│   │       ├── access-requests/{route.ts, [id]/route.ts, me/route.ts}
│   │       ├── municipalities/route.ts                       # Phase 37b — public list for AreaPicker
│   │       ├── compliance-onboarding/{route.ts, dismiss/route.ts}  # Phase 37b
│   │       ├── compliance/journey/{route.ts, step/route.ts}        # Phase 37c
│   │       └── tellers/[id]/training/route.ts                      # Phase 37c — Step 6 staff toggle
│   ├── components/
│   │   ├── products/{CatalogImportSheet.tsx, BarcodeScanButton.tsx}
│   │   ├── sale/{TellerSelector.tsx, CartItem.tsx, CartSummary.tsx, NewProductModal.tsx, ProductPicker.tsx}
│   │   ├── scanner/{BarcodeScanner.tsx, ScannerOverlay.tsx}
│   │   ├── admin/AdminNav.tsx
│   │   ├── dashboard/
│   │   │   ├── WeeklySalesChart.tsx, WeeklyChartSection.tsx
│   │   │   ├── TodaySummary.tsx, LowStockAlert.tsx, ExpiringAlert.tsx
│   │   │   ├── ComplianceCard.tsx          # Unified score + alerts
│   │   │   ├── JourneyProgressCard.tsx     # Phase 37c — journey % + Continue CTA
│   │   │   └── TopProducts.tsx, LatestSales.tsx
│   │   ├── access/TellerAccessRequestPanel.tsx
│   │   ├── compliance-onboarding/                        # Phase 37b
│   │   │   ├── ComplianceOnboardingModal.tsx, DashboardComplianceOnboarding.tsx
│   │   │   ├── OnboardingBanner.tsx, AreaPicker.tsx, DocumentToggleCard.tsx
│   │   │   ├── WelcomeScreen.tsx, NationalityScreen.tsx, MunicipalityScreen.tsx
│   │   │   ├── EmployeesScreen.tsx, DocumentStatusScreen.tsx, FoodSafetyScreen.tsx
│   │   │   └── FundInterestScreen.tsx, JourneySummaryScreen.tsx
│   │   ├── compliance/                                   # Phase 37c
│   │   │   └── InspectionReadinessPanel.tsx              # Extracted from /inspection
│   │   ├── compliance-journey/                           # Phase 37c
│   │   │   ├── JourneyProgress.tsx, JourneyStep.tsx
│   │   │   ├── DocumentChecklist.tsx, FormSummaryCard.tsx, OfficeDirections.tsx
│   │   │   ├── GenerateDocButton.tsx, MarkAsDoneButtons.tsx, StaffTrainingList.tsx
│   │   │   └── steps/{TradingPermitStep, HealthCertificateStep, CIPCStep,
│   │   │              SARSStep, UIFStep, FoodSafetyStep, SMMESAStep}.tsx
│   │   ├── LanguagePicker.tsx, LanguageProvider.tsx
│   │   ├── TopAppBar.tsx                    # Sticky header + bell + avatar
│   │   ├── NotificationBell.tsx             # Owner-only realtime bell
│   │   ├── ExpiryEntryList.tsx, BottomNav.tsx, ConfirmModal.tsx, Skeleton.tsx
│   │   ├── Toast.tsx, OfflineBanner.tsx, OfflineSyncProvider.tsx, ServiceWorkerRegistrar.tsx
│   │   ├── DailySummaryAlert.tsx, MonthlyComplianceAlert.tsx
│   │   └── NewSupplierModal.tsx
│   ├── hooks/
│   │   ├── useActiveTeller.ts, useCart.ts, useScanner.ts
│   │   └── useOnlineStatus.ts, useOfflineSync.ts, useRefetchOnVisible.ts
│   ├── lib/
│   │   ├── supabase/{client.ts, server.ts, admin.ts}
│   │   ├── auth/{teller.ts, admin-guard.ts, shop-auth.ts, external-api-guard.ts, recent-users.ts}
│   │   ├── payfast/index.ts
│   │   ├── db/
│   │   │   ├── products.ts, sales.ts, sales-history.ts, monthly-sales-report.ts
│   │   │   ├── stock-take.ts, stock.ts, reports.ts, admin.ts, catalog.ts, batches.ts
│   │   │   ├── suppliers.ts, goods-received.ts
│   │   │   ├── daily-checklist.ts, business-documents.ts, pest-control.ts, waste-management.ts
│   │   │   ├── compliance-report.ts, compliance-score.ts
│   │   │   ├── access-requests.ts
│   │   │   ├── municipalities.ts
│   │   │   ├── owner-profiles.ts                       # Phase 37b
│   │   │   ├── inspection-readiness.ts                 # Phase 37c — shared by /inspection + journey
│   │   │   └── journey.ts                              # Phase 37c — composite reader for the hub
│   │   ├── offline/{db.ts, sync.ts}
│   │   ├── checklist/stats.ts
│   │   ├── compliance/{document-status.ts, waste-pest-status.ts, score.ts, onboarding.ts,
│   │   │                journey.ts, goods-description.ts}    # journey + goods-description added 37c
│   │   ├── i18n/
│   │   │   ├── types.ts, interpolate.ts, loader.ts, server.ts
│   │   │   └── translations/{en,so,am,zu,ur}/  (20 namespaces each)
│   │   │       # common, auth, sale, sales, dashboard, settings, stock, products, tellers,
│   │   │       # expiry, summary, suppliers, checklist, documents, waste-pest, inspection,
│   │   │       # inventory, manage, compliance-onboarding, compliance-journey
│   │   ├── events.ts                       # In-tab mutation event bus
│   │   ├── validation/schemas.ts           # All Zod schemas
│   │   └── utils/{api.ts, currency.ts, date.ts, rateLimit.ts, statusBadge.ts}
│   └── types/index.ts
├── supabase/migrations/
│   ├── 001_initial_schema.sql           ├── 011_sale_batch_consumptions.sql
│   ├── 002_decrement_stock.sql          ├── 012_offline_id_unique.sql
│   ├── 003_stock_adjustments.sql        ├── 013_shop_language.sql
│   ├── 004_optional_barcode.sql         ├── 014_profit_tracking.sql
│   ├── 005_subscriptions.sql            ├── 015_suppliers.sql
│   ├── 006_admin_dashboard.sql          ├── 016_goods_received.sql
│   ├── 007_barcode_catalog.sql          ├── 017_daily_checklists.sql
│   ├── 008_shop_fields.sql              ├── 018_business_documents.sql
│   ├── 009_product_batches.sql          ├── 019_waste_pest.sql
│   ├── 010_product_name_unique.sql      ├── 020_access_requests.sql
│   │                                     ├── 021_municipalities.sql
│   │                                     ├── 022_compliance_onboarding.sql
│   └──                                   └── 023_compliance_journey.sql
├── data/sa-products.csv
├── scripts/{set-admin.ts, seed-catalog.ts, seed-municipalities.ts}
├── tasks/{todo.md, todo-archive.md, lessons.md, bugs.md}
└── tests/unit/
    ├── currency.test.ts, validation.test.ts, date.test.ts, rate-limit.test.ts
    ├── security.test.ts, payfast.test.ts, admin.test.ts, batches.test.ts
    ├── i18n.test.ts, profit.test.ts, checklist.test.ts
    ├── business-documents.test.ts, waste-pest.test.ts, compliance-score.test.ts
    ├── monthly-sales-report.test.ts
    ├── municipalities.test.ts
    ├── compliance-onboarding.test.ts
    └── journey.test.ts
```
