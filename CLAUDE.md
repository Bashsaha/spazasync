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
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold, language ('en'/'so'/'am'/'zu'/'ur'), subscription_status, trial_ends_at, subscription_ends_at, payfast_token, access_granted, admin_notes, registration_number, location, has_fridge, has_freezer, municipality_id (FK→municipalities, ON DELETE SET NULL), municipality_area_text (free-text fallback when "Other / not sure" picked at signup), has_employees, fund_interest, onboarding_compliance_completed, onboarding_compliance_dismissed_at, onboarding_compliance_dismiss_count, fund_township_rural (Phase 37e — nullable yes/no), fund_owner_managed (Phase 37e — nullable yes/no)
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
- `owner_profiles` — Phase 37b. user_id PK (FK→auth.users ON DELETE CASCADE), nationality_type ('sa_citizen'|'foreign_national'), food_safety_training_completed, food_safety_training_date, food_safety_training_provider, has_disability (Phase 37e — defaults false; only "priority" attribute we capture, per Design Rule 6), visa_type (Phase 37f — nullable; CHECK enum 'business_visa'|'asylum_seeker_s22'|'refugee_s24'|'work_permit'|'other'), visa_expiry_date (Phase 37f — nullable DATE; null when "doesn't expire / don't know"), created_at, updated_at. RLS: user can SELECT/INSERT/UPDATE their own row only. Service-role bypasses for atomic onboarding writes.
- `pest_control_logs` — shop_id, visit_date, provider_name, treatment_type, notes
- `waste_management` — shop_id (PK singleton), removal_type, frequency, provider_name, last_confirmed_date
- `municipalities` — id, name, province, short_name, areas TEXT[]; UNIQUE(name, province); GIN index on areas. Public-read RLS, service-role writes only.
- `municipality_offices` — FK municipality_id, office_type ('trading_permit'|'environmental_health'|'business_licensing'|'customer_care'), name, address, area, phone, email, hours, online_portal_url, online_form_url, notes. Public-read RLS.
- `municipality_requirements` — FK municipality_id, requirement_type ('trading_permit'|'coa'|'general'), documents_required JSONB array, fees, estimated_processing_time, additional_notes; UNIQUE(municipality_id, requirement_type). JSONB element shape: `{ name, applies_to: 'sa_citizen'|'foreign_national'|'all', required: bool, notes? }`. Public-read RLS.
- `compliance_reminders` — Phase 37g. shop_id (FK→shops ON DELETE CASCADE), reminder_type CHECK enum (`coa_expiry`|`permit_expiry`|`cipc_annual`|`visa_expiry`|`journey_nudge`|`fund_nudge`|`fund_qualified`|`score_drop`|`checklist_streak`|`admin_alert`), reminder_key TEXT (per-cycle bucket — weekly/biweekly/yearly/once-ever), shown_at, dismissed_at; UNIQUE(shop_id, reminder_key). Owner-scoped RLS (select/insert/update via `user_in_shop`). Re-firing in a new cycle uses a new bucket key, bypassing dedupe.
- `admin_alerts` — Phase 37g. title, message, link_text, link_url, priority CHECK (`normal`|`high`|`urgent`), target_audience CHECK (`all`|`sa_citizen`|`foreign_national`), starts_at, expires_at. Public-read RLS gated to active window only (`starts_at <= now() AND (expires_at IS NULL OR expires_at > now())`); writes are service-role only (no INSERT/UPDATE/DELETE policies).

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

Phases 1–36c + 37a–37g + 38 complete. See [ARCHIVE.md](ARCHIVE.md) for detailed summaries (compressed per Rule 7).

Most recent:
- 38 Brand Redesign — Movestock visual identity rollout. New design tokens (teal-forward, flat, pill buttons, Plus Jakarta Sans typeface) wired through `tailwind.config.ts` (custom `brand` palette `#1ABC9C`/`#15A886`/`#0F6E56`/`#E1F5EE` + `surface #F5F5F5` / `ink #1A1A1A` / `line #E0E0E0` / `chat-received #F0F0F0` / `chat-canvas #ECE5DD`; `fontFamily.sans` set to the Jakarta CSS var with sensible system fallbacks). `globals.css` now exposes the same tokens via `@theme inline` and paints body in `bg-surface` / `text-ink`. `layout.tsx` imports `Plus_Jakarta_Sans` from `next/font/google` (weights 400/500/600/700, variable `--font-jakarta`), drops the Arial fallback, and ships `themeColor #1ABC9C`. `manifest.json` + `public/offline.html` realigned to the brand color. Sweep across 112 files: every `(blue|indigo|sky|teal|cyan|emerald)-*` Tailwind utility collapses to the `brand` family (`50-400 → brand-light`, `500-600 → brand`, `700-900 → brand-hover`), every `shadow-(sm|md|lg|xl|2xl)` utility removed (the brief is "flat — no shadows"), every CTA className that contains `bg-brand` has its `rounded-(md|lg|xl|2xl|3xl)` rewritten to `rounded-full` (50px pill spec). The `WeeklySalesChart` recharts `Bar fill` + tooltip cursor moved to brand teal. Semantic green/amber/red status colors retained — `compliance-score` band logic, `ReminderBanner` urgency tones, and stock-state badges all keep working. `statusBadgeColors.trialing/active` remapped to `bg-brand-light text-brand-dark` so the primary "good" state aligns with brand. **No copy/i18n changes** (purely visual phase) — `tests/unit/i18n.test.ts` parity stays green. **No DB migration, no API contract changes.** All 614/614 tests pass; `tsc --noEmit` clean. Browser smoke test left to user — the harness here is headless and the dev server wasn't started; this is called out for a follow-up `npm run dev` walkthrough of `/login → /dashboard → /sale → /inventory → /manage → /settings` to verify nothing visually drifted (no leftover blue chrome, FAB pill is teal, BottomNav active state is teal, body renders in Plus Jakarta Sans).
- 37g Smart Reminders & Nudges — final user-facing phase of the Compliance Module. Adds a single dismissible banner at the very top of the dashboard that surfaces the highest-priority next thing the owner should know: a CoA / trading permit / visa expiring in 60 / 30 / 0 days, an idle compliance journey, a newly-qualified fund application, a compliance-score drop, a 3+ day checklist streak break, the annual CIPC return, and admin-broadcast alerts. Migration 026 adds 2 tables: `compliance_reminders` (shop-scoped ledger of `shown_at` / `dismissed_at` per `reminder_key`; UNIQUE(shop_id, reminder_key) is the dedupe surface — re-firing in a new cycle uses a fresh bucket key) and `admin_alerts` (global broadcasts with priority + target_audience + start/expiry window; public-read RLS gated to active window, writes service-role only). Pure engine in `lib/compliance/reminders.ts` does ALL the bucketing math — weekly journey nudges (`journey_nudge_<isoMonday>`), bi-weekly fund nudges (`fund_nudge_<isoBiweekStart>`), per-document expiry buckets (`coa_expiry_<docId>_2m|1m|expired`), 90/60/30/expired visa buckets, annual CIPC, weekly score-drop band buckets, weekly checklist-streak. After 4 prior dismissals the journey nudge falls back to monthly bucketing. Composite reader `lib/db/reminders.ts` resolves all 7 input streams in one batched call (shop, owner profile, documents, score, checklist streak, admin alerts, ledger), runs `pickTopReminder`, then UPSERTs `shown_at` best-effort. Priority order: urgent (expired docs, urgent admin) > high (≤30d expiry, score red, fund_qualified) > normal (≤60d expiry, journey/fund nudges, checklist streak, score amber, normal admin) > low; same-priority ties broken alphabetically by reminder_type. **Design Rule 3 enforced** in the engine: visa reminders gated on `nationality_type='foreign_national'`, fund reminders gated on `sa_citizen + fund_interest`, admin alerts filtered by `target_audience` against owner nationality. Owner-only mount (tellers never see; gated at the dashboard call-site). 3 React components: `<ReminderBanner>` (presentational, 4-tone borders by priority), `<DashboardReminder>` (server component reader+renderer, Suspense-wrapped on dashboard), `<DismissButton>` (client — POSTs `/api/compliance-reminders/dismiss` then `router.refresh()` so the next-priority banner shows). New admin section under `/admin/alerts` (list + new + edit/expire/delete) wired into AdminNav. New `compliance-reminders` i18n namespace (~50 keys × 5 locales — non-EN locales mirror EN per 37c precedent; parity tests green). New API routes: `POST /api/compliance-reminders/dismiss`, `GET/POST /api/admin/alerts`, `GET/PATCH/DELETE /api/admin/alerts/[id]`. New helper `getChecklistStreakStatus()` on `lib/db/daily-checklist.ts` (full days since last completed checklist + completedToday flag). 614/614 tests pass (30 new for the engine — covers all 11 reminder types, dismissal filtering, priority ordering, bucket-key shapes, foreign/SA gating, fund_interest gating, journey idle threshold, monthly fallback after 4 dismissals).
- 37f Foreign National Path — sixth user-facing phase of the Compliance Module. Layers conditional rendering on top of 37b/37c/37e for owners with `nationality_type='foreign_national'`. Migration 025 adds `owner_profiles.visa_type` (CHECK enum: business_visa | asylum_seeker_s22 | refugee_s24 | work_permit | other) and `owner_profiles.visa_expiry_date` (nullable DATE — null when the owner picked "I don't know / doesn't expire"). New onboarding screen `VisaScreen` slots in after Nationality for foreign nationals only (replaces the Fund-Interest screen — total stays at 7 progress screens). Includes a fronting notice (informational, framed helpfully per the Immigration Act). API at `/api/compliance-onboarding` defence-in-depths the inverse of the existing fund_interest force-false: visa fields are force-nulled when nationality_type='sa_citizen'. New `VisaPermitWarning` card sits at the top of `/compliance/journey` for foreign nationals — combines the visa-permit-link reminder with a day-precision countdown (`{n} days remaining` / "Expired — renew immediately"). The 90/60/30-day proactive reminders are explicitly Phase 37g (Smart Reminders) — not in this phase. `TradingPermitStep` + `CIPCStep` accept a new `isForeignNational` prop that swaps the `form_id_number` row for `form_passport_number`, swaps the `form_bring_id_warning` footer for `form_bring_passport_warning`, and (in TradingPermit) renders a small inline "permit-tied-to-visa" notice. CIPC's "how to register" Step 3 swaps "ID number" for "passport number". **No engine changes** — `lib/compliance/journey.ts` already gates SMMESA on `sa_citizen && fund_interest`, so foreign nationals naturally see 5–6 steps (UIF in iff has_employees). New regression test asserts SMMESA stays hidden even if a misbehaving callsite sets fund_interest=true on a foreign profile. **Document checklists are still seed-driven** — `municipality_requirements.documents_required` already filters by nationality (37a infra), and the Tshwane row already covers the R5M business-visa requirement via the existing `applies_to: 'foreign_national'` row. Fund route already redirects non-SA via `getFundReadinessData` (37e); no change. Visa data plumbed through `DashboardComplianceOnboarding` for the "Redo compliance check" pre-fill. New i18n: 12 keys × 5 locales in `compliance-onboarding`, 13 keys × 5 locales in `compliance-journey` (non-EN locales mirror EN per 37c precedent — parity test green). 8 new tests (570/570 pass).
- 37e Fund Readiness Checker — fifth user-facing phase of the Compliance Module. New owner-only `/compliance/fund` page answers "Can I apply for the R500M Spaza Shop Support Fund right now?" with a green/amber/red verdict synthesised from onboarding answers, document statuses, and the existing 0–100 compliance score. Doubly gated via Design Rule 3: `compliance/layout.tsx` blocks tellers; `getFundReadinessData()` returns null (→ redirect to `/compliance/journey`) for non-SA citizens or owners with `fund_interest=false`. **Youth + women-owned priority badges deliberately dropped** — would have required capturing DOB + gender (Design Rule 6 violation) for zero functional benefit since SEFA assesses priority server-side. Manual disability toggle stays — the only "priority" attribute we capture, set explicitly by the owner. Migration 024 adds 3 columns: `shops.fund_township_rural`, `shops.fund_owner_managed` (both NULL = unanswered, distinguishes "not asked yet" from "answered no"), and `owner_profiles.has_disability` (default false). Pure status engine in `lib/compliance/fund.ts` with 14 unit tests covering RED/AMBER/GREEN logic + CIPC tier gating. PDF download button reuses the existing 37d `/api/reports/fund-application-pack` endpoint (no new PDF code). Settings gains a "Government Fund" toggle (SA citizens only, gated by `nationality_type` from a new line on the `/api/settings` GET). JourneyProgressCard + JourneyProgress fund teasers now deep-link into `/compliance/fund` instead of `/compliance/journey`. New `compliance-fund` i18n namespace (~70 keys) × 5 locales — non-EN locales mirror EN values per 37c precedent. 562/562 tests pass.
- 36a Navigation Restructure (5-tab nav, hubs, dashboard cleanup, extended FAB)
- 36b Switch User (top app bar avatar + recent users on login)
- 36c Teller Access Requests + Realtime Notifications
- 37a Municipality Directory — pure data layer for the upcoming Compliance Module (37a–37g). 3 tables (`municipalities`, `municipality_offices`, `municipality_requirements`) with public-read RLS + service-role writes. 6 metros seeded from official `.gov.za` sources (Johannesburg, Tshwane, Ekurhuleni, eThekwini, Cape Town, Mangaung). DB helpers filter requirements by nationality (`sa_citizen` | `foreign_national`) so later phases can show personalised "what to bring" lists. No UI, no API routes, no i18n changes — pure foundation.
- 37d Document Generation Engine — fourth user-facing phase of the Compliance Module. Five new owner-only PDF endpoints under `/api/reports/*` produce pre-filled paperwork the owner prints + takes to the municipality / SEFA: `trading-permit-summary`, `landlord-affidavit`, `goods-declaration`, `food-safety-pack`, `fund-application-pack`. Reuses the existing jsPDF + jspdf-autotable stack via a new `lib/pdf/shared.ts` helper module (header/footer, page-break, dotted form-row drawing, brand colours) — same pattern as `compliance-pdf` so future PDFs cost ~150 LOC each. Composite reader `lib/db/owner-profile-report.ts` pulls shop + owner profile + 90-day sales rollup + goods description in one batched call. **Design Rule 6 enforced centrally**: `assertNoSensitiveValues()` throws if any `FormRow` with an "ID/passport/tax number" label carries a non-blank value, so a future contributor can't accidentally embed PII in a PDF. ID/passport/tax fields render as dotted underline + "(fill in yourself)" hint instead. Fund pack endpoint gates on `nationality_type='sa_citizen'` AND `fund_interest=true` (Design Rule 3) — returns 403 otherwise; the journey UI doesn't link to it yet (Phase 37e Fund Readiness Checker will). Wired up: `TradingPermitStep` GenerateDocButtons (3 enabled — summary, landlord affidavit, goods declaration), `HealthCertificateStep` evidence-pack button, `/inspection` page gets a second emerald-themed "Generate Evidence Pack" CTA below the existing "Download Report PDF" button. New i18n keys: `doc_trading_permit_summary_title/desc` in `compliance-journey` × 5 locales, `download_evidence_pack/hint` in `inspection` × 5 locales (native translations for am/zu/ur/so; parity test green). 12 new unit tests in `tests/unit/pdf-reports.test.ts` covering the Design Rule 6 guard + goods-description aggregation. No DB migration this phase. 540/540 tests pass.
- 37c Compliance Journey Hub — third user-facing phase of the Compliance Module. New `/compliance/journey` route delivers a personalised 5–7 step plan (Trading Permit → Health Certificate → CIPC → SARS → UIF → Food Safety → SMMESA) with a 4-state status engine (`not_started` | `in_progress` | `complete` | `locked`) plus dependency rules (CoA needs food-safety training; Trading Permit needs CIPC + SARS + food-safety; SMMESA needs CIPC). Step cards collapse/expand and surface "What you need to bring" (from `municipality_requirements`), pre-filled "Your details" cards (per Design Rule 6 — ID/passport always blank, missing shop fields link to Settings), "Where to go" (from `municipality_offices`, with a generic fallback for un-seeded munis), and "Mark as done / I've applied / I've received" actions writing to `business_documents`. Migration 023 extends `business_documents.status` with `'in_progress'`, adds `applied_at TIMESTAMPTZ`, and adds `tellers.food_safety_trained_at` (Step 6 staff list). Reusable `<InspectionReadinessPanel>` extracted from `/inspection` to keep the CoA Step 2 readiness check single-sourced. New `JourneyProgressCard` on the dashboard mirrors the journey progress + an SA+fund_interest "R300k" teaser. New `compliance-journey` i18n namespace (~120 keys) × 5 locales — non-EN locales currently mirror EN values (parity tests pass; native translations are a follow-up). PDF generation for affidavits / evidence packs deferred to Phase 37e (buttons render disabled). 50 new unit tests in `tests/unit/journey.test.ts`.
- 37b Compliance Onboarding — first user-facing phase of the Compliance Module. New `owner_profiles` table (person-level, keyed to `auth.users(id)`) supports owners with multiple shops without duplicating nationality/training data. `shops` extended with `municipality_id`, `municipality_area_text`, `has_employees`, `fund_interest`, plus three onboarding-state columns driving the dashboard banner snooze (7-day → 30-day rules). `business_documents` CHECK constraint extended with `sars_tax`, `uif`, `food_safety_training`, `smmesa` — SARS is its own type, **not** reused as `business_license`, per "no legal shortcuts". Existing `/onboarding` shop-setup step now requires an Area answer (municipality dropdown + "Other / not sure" → free-text fallback resolved server-side via `findMunicipalityByArea()`). Bottom-sheet 8-screen modal opens automatically on first dashboard visit for fresh owners; banner+snooze for existing owners. Foreign nationals skip the Fund screen and `fund_interest` is force-set to `false` server-side. Toggle states (`have`/`unsure`/`unselected`) map to `business_documents.status` (`on_file`/`pending`/`not_registered`). Settings now has a "Redo compliance check" button that resets onboarding state and reopens the modal. New `compliance-onboarding` i18n namespace × 5 locales; existing `auth` namespace gained 7 area-related keys × 5 locales. Dashboard `ComplianceCard` deliberately still scopes its score to the original 5 doc types via `CORE_COMPLIANCE_DOC_TYPES` (see `lib/compliance/document-status.ts`) — preventing a regression for shops that haven't yet gone through the new onboarding. Journey hub (37c) will surface the new doc types separately.

When starting a new phase, append it here and update the file tree.

---

## Current File Tree

_Last updated: Phase 38 (2026-05-09)_

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
│   │   │   ├── compliance/                           # Phase 37c + 37e
│   │   │   │   ├── layout.tsx                        # Owner-only guard
│   │   │   │   ├── journey/{page.tsx, loading.tsx}   # Compliance Journey Hub
│   │   │   │   └── fund/{page.tsx, loading.tsx}      # Phase 37e — Fund Readiness Checker
│   │   │   # dashboard mounts <DashboardComplianceOnboarding> + <JourneyProgressCard>
│   │   │   #                  + <DashboardReminder> (Phase 37g) for owners
│   │   │   └── admin/
│   │   │       ├── layout.tsx, loading.tsx, page.tsx
│   │   │       ├── shops/{page.tsx, loading.tsx, [id]/page.tsx}
│   │   │       ├── catalog/{page.tsx, loading.tsx, new/page.tsx, [id]/page.tsx}
│   │   │       └── alerts/{page.tsx, new/page.tsx, [id]/page.tsx}    # Phase 37g
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
│   │       ├── reports/                                       # Phase 37d adds 5 PDF endpoints
│       │   ├── compliance-pdf/route.ts, monthly-sales-pdf/route.ts
│       │   ├── trading-permit-summary/route.ts            # 37d
│       │   ├── landlord-affidavit/route.ts                # 37d
│       │   ├── goods-declaration/route.ts                 # 37d
│       │   ├── food-safety-pack/route.ts                  # 37d
│       │   └── fund-application-pack/route.ts             # 37d (SA + fund_interest gated)
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
│   │       ├── compliance/fund/eligibility/route.ts                # Phase 37e — PATCH 3 toggles
│   │       ├── compliance-reminders/dismiss/route.ts               # Phase 37g
│   │       ├── admin/alerts/{route.ts, [id]/route.ts}              # Phase 37g
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
│   │   ├── compliance-onboarding/                        # Phase 37b (+ 37f VisaScreen)
│   │   │   ├── ComplianceOnboardingModal.tsx, DashboardComplianceOnboarding.tsx
│   │   │   ├── OnboardingBanner.tsx, AreaPicker.tsx, DocumentToggleCard.tsx
│   │   │   ├── WelcomeScreen.tsx, NationalityScreen.tsx, MunicipalityScreen.tsx
│   │   │   ├── EmployeesScreen.tsx, DocumentStatusScreen.tsx, FoodSafetyScreen.tsx
│   │   │   ├── FundInterestScreen.tsx, JourneySummaryScreen.tsx
│   │   │   └── VisaScreen.tsx                            # Phase 37f — foreign-national-only screen
│   │   ├── compliance/                                   # Phase 37c
│   │   │   └── InspectionReadinessPanel.tsx              # Extracted from /inspection
│   │   ├── compliance-journey/                           # Phase 37c (+ 37f VisaPermitWarning)
│   │   │   ├── JourneyProgress.tsx, JourneyStep.tsx
│   │   │   ├── DocumentChecklist.tsx, FormSummaryCard.tsx, OfficeDirections.tsx
│   │   │   ├── GenerateDocButton.tsx, MarkAsDoneButtons.tsx, StaffTrainingList.tsx
│   │   │   ├── VisaPermitWarning.tsx                     # Phase 37f — foreign-national journey-hub banner
│   │   │   └── steps/{TradingPermitStep, HealthCertificateStep, CIPCStep,
│   │   │              SARSStep, UIFStep, FoodSafetyStep, SMMESAStep}.tsx
│   │   ├── compliance-fund/                              # Phase 37e
│   │   │   ├── FundHeroStatus.tsx, EligibilitySection.tsx, DocumentReadiness.tsx
│   │   │   ├── ComplianceReadiness.tsx, FundBreakdown.tsx
│   │   │   └── GenerateApplicationPackButton.tsx, ApplySection.tsx
│   │   ├── compliance-reminders/                         # Phase 37g
│   │   │   ├── ReminderBanner.tsx                        # presentational, 4-tone borders
│   │   │   ├── DashboardReminder.tsx                     # server component reader+renderer
│   │   │   └── DismissButton.tsx                         # 'use client' — POST + router.refresh
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
│   │   │   ├── journey.ts                              # Phase 37c — composite reader for the hub
│   │   │   ├── owner-profile-report.ts                 # Phase 37d — composite reader for PDF endpoints
│   │   │   ├── fund-readiness.ts                       # Phase 37e — composite reader for /compliance/fund
│   │   │   ├── reminders.ts                            # Phase 37g — composite reader for dashboard banner
│   │   │   └── admin-alerts.ts                         # Phase 37g — service-role CRUD helpers
│   │   ├── offline/{db.ts, sync.ts}
│   │   ├── pdf/shared.ts                   # Phase 37d — shared jsPDF helpers + PII guard
│   │   ├── checklist/stats.ts
│   │   ├── compliance/{document-status.ts, waste-pest-status.ts, score.ts, onboarding.ts,
│   │   │                journey.ts, goods-description.ts, fund.ts, reminders.ts}
│   │   │                # fund.ts (37e), reminders.ts (37g — pure evaluator + bucket-key engine)
│   │   ├── i18n/
│   │   │   ├── types.ts, interpolate.ts, loader.ts, server.ts
│   │   │   └── translations/{en,so,am,zu,ur}/  (22 namespaces each)
│   │   │       # common, auth, sale, sales, dashboard, settings, stock, products, tellers,
│   │   │       # expiry, summary, suppliers, checklist, documents, waste-pest, inspection,
│   │   │       # inventory, manage, compliance-onboarding, compliance-journey, compliance-fund,
│   │   │       # compliance-reminders
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
│   │                                     ├── 023_compliance_journey.sql
│   │                                     ├── 024_fund_readiness.sql
│   │                                     ├── 025_foreign_national_visa.sql
│   └──                                   └── 026_compliance_reminders.sql
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
    ├── journey.test.ts
    ├── pdf-reports.test.ts
    ├── fund-readiness.test.ts
    └── reminders.test.ts
```
