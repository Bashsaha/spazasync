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

### Service Worker Cache Bump (CRITICAL)
**Every deploy that ships code changes MUST bump the `CACHE` constant in `public/sw.js`** (e.g. `movestock-v7` → `movestock-v8`). Movestock is a PWA — the service worker pre-caches the app shell and serves cached pages on repeat visits. Without a version bump, returning users keep loading the previous build from the SW cache even after a successful Vercel deploy, and bug fixes silently fail to reach production. Bump the version in the same commit as the code change (or as the final commit of a series before push). The version is a monotonically increasing integer suffix; never reuse an old value. Skip only for deploys that change zero user-facing code (docs-only, CI-only, infra-only).

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

## Pre-Production Checklist (CRITICAL — read this when user asks "is this production ready")

The app is **NOT production-ready** until every item below is ticked off. These are intentionally listed here so that any "is it ready to launch?" / "can I show this to real users?" / "production ready?" question triggers a re-read of this section. Do not declare the app production-ready without explicitly walking the user through each item and confirming its state.

### Auth & identity
- [ ] **Google OAuth consent screen verified** — currently the app is in "Testing" mode in Google Cloud Console, so users see "This app isn't verified — Advanced → Continue" the first time they sign in. To remove that warning: Google Cloud Console → APIs & Services → OAuth consent screen → fill in app logo, privacy policy URL, terms of service URL, then publish + submit for verification. Verification is free; Google reviews automatically for non-sensitive scopes (we only request `email` + `profile`). Takes ~1–2 weeks. Without this, every new owner sees a phishing-style warning at signup — major trust-killer.
- [ ] **OAuth support email is on a Movestock domain** — currently set to a personal Gmail in the consent screen. Change to `hello@movestock.co.za` (or similar) once the custom domain has email forwarding configured. The support email is shown publicly on the consent screen — personal Gmail looks unprofessional and weakens trust signals.

### Domain & infrastructure
- [ ] **Custom domain live on Vercel** — not `*.vercel.app`. Vercel preview URLs have near-zero Safe Browsing reputation; Chrome heuristics fire aggressively against them. A registered `.co.za` domain accumulates reputation and is durable against future heuristic shifts.
- [ ] **Email forwarding configured for the custom domain** — via Cloudflare Email Routing (if DNS is on CF) or ImprovMX / Forward Email (free tier). Required for the OAuth support email above, customer support, and any future transactional email needs.
- [ ] **Custom SMTP configured in Supabase** (Resend or similar) — Supabase's default mailer is rate-limited to ~4 emails/hour and routes to spam. Even though we no longer use email-OTP for owner auth, Supabase still sends emails for password resets (tellers), email verification, etc. Without custom SMTP, those flows silently fail.

### Security
- [ ] **Rate limiting on auth + sensitive endpoints** — `/api/auth/teller-login`, `/api/tellers`, `/api/onboarding` should be IP-throttled to prevent brute-force on teller PINs (6 digits = 1M space).
- [ ] **CSP headers** — currently none. Add a Content-Security-Policy header in `next.config.ts` once the app is on a stable domain.
- [ ] **Secrets review** — confirm no service-role keys, OAuth secrets, or PayFast passphrases leak into any client bundle. Grep the build output (`.next/static/**`) before each release.

### Compliance & legal
- [ ] **Privacy policy page** — required for Google OAuth verification. Must list what data is collected (email, name, shop info, sales data) and how it's used.
- [ ] **Terms of service page** — required for Google OAuth verification. Standard SaaS terms.
- [ ] **POPIA compliance review** — South African data protection act. Already noted in CLAUDE.md compliance journey. Check that data export + deletion paths exist for owners.

When the user asks any variant of "is this production ready" / "can I launch" / "ready for users" — re-read this section and report the state of each item before answering.

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

Phases 1–36c + 37a–37g + 38 + 39 complete. See [ARCHIVE.md](ARCHIVE.md) for detailed summaries (compressed per Rule 7).

Most recent:
- Products: missing-cost card + filtered-edit return flow (2026-05-15) — small UX iteration on the Products page following BUG-030→031. The "products without cost" banner was a flat amber card with an underlined link inside; visually weaker than the "products without supplier" card (which is a proper tap-target with chevron → `/suppliers/assign`). Rebuilt the missing-cost surface as a matching clickable card: `flex items-center justify-between` + amber-50 bg + amber chevron, tapping it pushes `?missing_cost=1`. When the filter is active, the card switches to a status card showing "Showing N products that still need a cost price" with a "← Show all products" exit link. Wired up the filtered-edit return flow: the product row link now appends `?return=missing_cost` (or `?return=missing_supplier`) when a filter is active; `/products/[id]/page.tsx` reads it via `useSearchParams()` and `router.push()`s back to the filtered URL after Save. Net effect: tap card → see filtered list → tap product → edit → Save → just-edited product disappears from the list (its cost is set now), you're still on the filtered view ready to do the next one. No new i18n keys (all reused). No DB migration, no API changes. SW cache v16 → v17.
- BUG-034: kill the last `type="password"` field — owner login becomes email + 6-digit OTP (2026-05-14c) — after BUG-033 converted teller credentials to PINs, the Chrome "Check your passwords / you just entered your password on a deceptive site" warning was STILL firing. Root-cause diagnosis: the teller-name field is plain `type=text` and can't trigger Password Reuse Protection — the warning was actually being triggered by the **owner login / signup** flow (which still had `<input type="password">`) and then persisting across navigations on the same domain. Compounded by the deploy being on a `*.vercel.app` preview URL (near-zero Safe Browsing reputation, so Chrome's reuse detector fires far more aggressively). Proper fix: **remove every remaining `type="password"` field from the app.** Owner login + signup are now **email + 6-digit OTP** via `supabase.auth.signInWithOtp({ email })` → `supabase.auth.verifyOtp({ email, token, type: 'email' })`. No password field anywhere on the client → Chrome's Password Reuse Protection has nothing to bind to. `ownerLoginSchema` dropped the password field; new `ownerOtpVerifySchema` validates the verify step. Both `/login` (owner tab) and `/onboarding` (step 1) are two-phase: enter email → enter 6-digit code, with Resend / "Use a different email" controls. The pre-existing `email-sent` confirmation screen on `/onboarding` was removed (OTP verifies inline). Existing owner accounts in Supabase still work — OTP is keyed off email, no migration needed. The only remaining `signInWithPassword` call is the teller-login server route, which receives the synthetic email + 6-digit PIN — but the **client field** is `type=text inputMode=numeric`, so Chrome never sees a password field. i18n × 5 locales: removed `label_password`, `label_choose_password`, `placeholder_password*`, `email_sent_*`, `btn_create_account*` keys; added 11-key `otp_*` namespace; parity test green. SW cache v14 → v15. **Recommendation flagged to user:** point a custom domain at Vercel — even with the code change, a registered domain accumulates reputation and protects against future Chrome heuristic shifts. **BUG-034 entry added to `tasks/bugs.md`** with the cross-page Password Reuse Protection diagnosis. **Prevention rule:** never use `<input type="password">` on a Vercel preview URL or any low-reputation domain. Chrome's Password Reuse Protection fingerprints saved passwords at the keystroke level on any `type="password"` field, regardless of `autocomplete` attributes — the only fix is to remove the field type entirely (email OTP, magic link, or numeric PIN depending on security tier).
- BUG-033 proper fix: teller credentials → 6-digit PIN (2026-05-14b) — initial `autoComplete="new-password"` fix did NOT suppress the warning. Diagnosed deeper: the warning is **Chrome Password Reuse Protection** (a.k.a. Password Alert), which fingerprints every saved password on the user's Sync profile and fires at the keystroke level whenever any of those passwords is typed into `<input type="password">` on a domain Chrome doesn't recognise as that password's home. `autoComplete` only affects autofill UI, not the reuse-detection layer. Proper fix: **eliminate `type="password"` from the teller flow entirely**. Tellers now use 6-digit numeric PINs entered via `<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="off">` — Chrome never inspects non-password fields for reuse, so the warning can't fire. Side benefits: better UX for non-technical spaza staff (a 6-digit PIN is easier to remember and share than a password), matches the till-style mental model of the rest of the app. `createTellerSchema` tightened to `/^\d{6}$/` (server-side validation); both `/tellers/new` (create) and `/login` (teller tab) forms get the new PIN input with `tracking-[0.4em]` spacing and a 6-dot placeholder. i18n keys `label_password`/`placeholder_password`/`hint_password` in `tellers` namespace and `teller_label_password`/`teller_hint_password`/`teller_error_wrong_password` in `auth` namespace renamed to `_pin` variants across all 5 locales (parity test green). The linter also strengthened owner signup/login: added `name="email"` + `autoComplete="email"` and `name="new-password"` + `autoComplete="new-password"` to `/onboarding`'s signup form. **Migration note for existing tellers:** old tellers were created with arbitrary (often alphanumeric) passwords. The new login form strips non-digits, so they cannot type their old password — owners must deactivate + re-add affected tellers with a new 6-digit PIN. SW cache v13 → v14. **BUG-033 entry in `tasks/bugs.md` rewritten** with the correct root cause (Password Reuse Protection, not Safe Browsing heuristics) and the proper prevention rule: never use `type="password"` for an "owner-sets-credential-for-someone-else" flow — use a numeric PIN instead. Reserve `type="password"` for fields where the person typing IS the credential owner.
- BUG-032→033 + product-edit UI polish (2026-05-14) — small clustered pass on Tellers + Products. **(BUG-032)** Owner-promoted-to-admin (dual-role) got "Only owners can manage tellers" on Add/Remove. Both `POST /api/tellers` and `PATCH /api/tellers/[id]` had a strict `role !== 'owner'` gate; rest of codebase had standardised on `role !== 'owner' && role !== 'admin'` (compliance, reports, settings, access-requests). Aligned both teller endpoints with the convention — `getShopAuth()`'s shop-id requirement is what actually gates non-shop admins. **(BUG-033)** Add-teller form triggered Chrome's "you just entered a password on a deceptive site" warning (grey address bar + X). `<input type="password">` with no `autocomplete` attribute trips Chrome's Safe Browsing heuristic. Added `autoComplete="new-password"` on the password field and `autoComplete="off"` on the name field + form. **(Products page — missing-supplier banner)** Banner was a `<div>` with a small underlined link; now the whole card is a single `<Link>` to `/suppliers/assign` with a chevron. **(Product edit page — cleaner cost-price + supplier UI)** Selling-price and cost-price inputs now have an inline "R" currency prefix. Supplier section was two scattered links below the dropdown; now either (a) a dashed "+ Add supplier" pill replaces the dropdown when the shop has zero suppliers, or (b) the dropdown gets an extra "+ Add supplier" tail option that opens the modal. No DB migration, no new API routes, no i18n changes. SW cache v12 → v13. **Prevention rules logged in `tasks/bugs.md`** (BUG-032: every shop-scoped mutation endpoint must accept `owner` OR `admin`. BUG-033: every password field must declare `autoComplete="new-password"` on create flows, `"current-password"` on sign-in).
- BUG-030→031 + bulk-supplier + 2 new reminders (2026-05-13) — clustered pass touching the scan pipeline, the notification bell, the suppliers flow, and the smart-reminders engine. **(BUG-030)** Barcode scanner sometimes returned partial codes (single-frame accept + no length/checksum validation under ZXing's `TRY_HARDER` mode). New pure validator `src/lib/barcode/validate.ts` enforces per-format digit-count (EAN-13/EAN-8/UPC-A/UPC-E) + GS1 mod-10 checksum; both native and ZXing paths now require the same value in **two consecutive frames** before firing `onScan` (adds ~100ms at 10fps — negligible). Non-numeric payloads (QR text, alphanumeric Code-128) bypass length/checksum since those decoders are framing-aware. 11 new unit tests. **(BUG-031)** Notification bell popup was hidden behind the New Sale FAB and clipped by BottomNav. Replaced with a full-screen WhatsApp-style sheet (`z-[70]`, sticky brand-teal header with back arrow, body-scroll lock while open, `pb-[64px+safe-area]` so nothing clips into the system gesture bar). Each notification is a chat row: priority-coloured avatar, title + truncated preview body, tap to navigate to `ctaHref`, trailing Dismiss button. **(Bulk-assign supplier — small feature)** New `/suppliers/assign` page with multi-select checkboxes, "Select all" toggle, sticky bottom action bar (supplier dropdown + "Assign to N products" button lifted above BottomNav). New `PATCH /api/products/bulk-supplier` validates the supplier belongs to the caller's shop, then `update({ supplier_id }).in('id', product_ids)` in one round-trip. Stock-take + products page "missing supplier" tip CTAs re-pointed to `/suppliers/assign`. `/suppliers` index gets a brand-teal entry card when `products_missing_supplier > 0`. `/api/products` GET now accepts `missing_supplier=1` and `missing_cost=1`. **(2 new smart reminders — independent, per requirements)** Phase 37g engine gains two new types: `products_missing_cost` (normal priority, weekly bucket, CTA `/products?missing_cost=1`) and `products_missing_supplier` (low priority, weekly bucket, CTA `/suppliers/assign`). The supplier reminder is **suppressed entirely** when the shop has 0 suppliers — same rule as BUG-028's gray tip. Composite reader gains three `count: 'exact', head: true` queries. 5 new unit tests. Migration 027 extends `compliance_reminders.reminder_type` CHECK enum with the two new values. New i18n keys × 5 locales (`suppliers.assign_*` ~15 keys, `compliance-reminders.products_missing_*` 6 keys, `products.missing_supplier_assign_btn`). SW cache v10 → v11. 633/633 tests pass; `tsc --noEmit` clean. **Prevention rules logged in `tasks/bugs.md`** (BUG-030: validate every hardware-decoded value before treating as authoritative; for continuous-decode pipelines require N-frame agreement; never enable `TRY_HARDER` without a validation layer. BUG-031: when mobile fixed chrome sums to ~120px+, a full-screen sheet beats a floating popover).
- BUG-026→028 Inventory cluster UX (2026-05-12) — not a phase, but a clustered fix pass on the Inventory + Manage tabs. **(026)** Back links on top-level child pages were hard-coded to `/dashboard` from before the 5-tab nav (Phase 36a) — re-pointed each at its owning hub: `/inventory` (products, stock, stock-take, expiry) and `/manage` (inspection, checklist render paths). `checklist/history` now goes to `/checklist` (its immediate parent). Sub-pages already use `router.back()` so no change needed. **(027)** On `/stock-take` the primary "Update Stock" sticky submit was invisible — bar sat at `bottom-0` behind the 64px BottomNav, and the New Sale FAB (`bottom: 72px + safe-area`, h-14) also occupied the same lower-right region. Two CTAs fighting for the same corner. Lifted the submit bar to `bottom: calc(64px + env(safe-area-inset-bottom, 0px))` with `z-30`; extended `BottomNav.tsx` FAB exclusion list to hide the New Sale FAB on `/stock-take` (same pattern already used for `/sale` — when a page has its own primary sticky CTA the global FAB has to defer); bumped `<main>` `pb-32 → pb-44`. While auditing also bumped `pb-24 → pb-36` on `/products`, `/stock`, `/expiry`, `/suppliers` list pages so the last list item clears the FAB (FAB top edge sits ~128px from screen bottom; pb-36 = 144px gives 16px breathing room). **(028 — small feature, not a bug)** Added a "products without supplier" gray tip on `/stock-take` and `/products`, mirroring the missing-cost amber alert pattern but intentionally softer. UX rules baked in: (a) **gray, not amber** — supplier gaps are operational, not a data-integrity break like missing cost (which corrupts profit charts); (b) **suppress entirely when shop has 0 suppliers** and replace with a "Add your first supplier →" tip linking to `/suppliers/new`, so day-one users don't see "47 products without supplier!" as noise; (c) **no row pill on `/products`** (cost gets a pill because it gates profit math; supplier doesn't break anything); (d) **no dismiss state** (banner self-clears when count hits 0); (e) **not gated on a toggle** — always-on once ≥1 supplier exists. `/api/settings` GET now returns `products_missing_supplier` and `suppliers_count`. `listProducts` in `lib/db/products.ts` gains `opts.missingSupplier?: boolean`. New i18n keys × 5 locales in `stock` and `products` namespaces — native translations for am/zu/ur/so, parity test green. No DB migration, no new API routes. Files touched: `src/components/BottomNav.tsx`, `src/app/(app)/{stock-take,products,stock,expiry,suppliers,inspection,checklist,checklist/history}/page.tsx`, `src/app/api/settings/route.ts`, `src/lib/db/products.ts`, and 10 i18n JSON files. 616/616 tests pass; `tsc --noEmit` clean. **Prevention rules logged in `tasks/bugs.md`** (BUG-026: re-audit Back links every time a new tab/hub is introduced; BUG-027: when a page has its own primary sticky CTA, hide the global FAB on that route, and when stacking fixed elements every new one must measure off the next one up, never `bottom-0` blind).
- BUG-022→025 Dashboard UX polish (2026-05-12) — not a phase, but a clustered fix pass that touched the (app) shell. **(022)** Daily-checklist reminder FAB no longer stays pulsing after the checklist is saved — rewrote the FAB as a client component that owns its own `visible` state (initialised from a new `initialVisible` prop the server-side layout still computes for first-paint correctness) and listens for the existing `DATA_CHANGED` event bus via `useRefetchOnVisible`. New lightweight endpoint `GET /api/daily-checklist/status` → `{ completed: boolean }` lets the FAB re-query and dismiss itself the moment `emitDataChanged()` fires from `checklist/page.tsx::handleSave`. Root cause was that `router.refresh()` followed immediately by `router.push('/dashboard')` race each other and shared layout segments are cached across in-segment pushes, so the layout's `showChecklistReminder=true` survived the navigation. Yesterday's BUG-022 fix (just calling `router.refresh()`) is replaced by this event-driven approach. **(023)** Daily-summary modal no longer renders behind the sticky "Complete Sale" cart bar — bumped `DailySummaryAlert`'s modal backdrop from `z-50` to `z-[60]` (the cart bar is layout-level sticky chrome at z-50; equal z-index resolves by DOM order and the cart bar paints later, so the modal lost). **(024)** Owners now see their own name in the top app bar subtitle. The `tellers` table already has a row for every owner (created at onboarding with `user_id` set so the owner can pick themselves on `/sale`), but `(app)/layout.tsx` only queried it for the `teller` role. Unified the lookup so both owners and tellers get `personName` from `tellers` by `user_id + shop_id`, passed as the TopAppBar `subtitle`; avatar initial now uses the person's name (falling back to the shop name only when no teller row exists). **(025)** Removed the `MonthlyComplianceAlert` "Your monthly compliance score" once-per-month banner — it duplicated the permanent `ComplianceCard` on the dashboard (same score ring + "Action needed" list). Deleted the component file and stripped the stale reference from `/api/compliance-score/route.ts`. The dashboard now shows one compliance card with the score + actions, the Compliance Journey card stays as its own separate card below it, and `/inspection` continues to provide the full category breakdown the removed banner's modal used to surface. New files: `src/app/api/daily-checklist/status/route.ts`. Deleted: `src/components/MonthlyComplianceAlert.tsx`. Touched: `src/components/ChecklistReminderFab.tsx`, `src/app/(app)/layout.tsx`, `src/components/DailySummaryAlert.tsx`, `src/app/api/compliance-score/route.ts`. No DB migration, no API contract changes (one new GET endpoint), no i18n changes. `tsc --noEmit` clean.
- 39 Compliance Journey UX Overhaul — government-verified audit of all compliance features followed by a comprehensive UX + accuracy pass. **Step reorder** (was: Trading Permit first → locked; now: Food Safety → CIPC → SARS → CoA → Trading Permit → UIF → SMMESA — actual real-world dependency order). New **NextStepHero component** (`src/components/compliance-journey/NextStepHero.tsx`) — teal hero card at top of `/compliance/journey` surfacing the single next actionable step with a name, why-you-need-it line, and scroll-anchor CTA. Each step now carries a **numbered 5-step lawyer-style "How to do this" checklist** (Food Safety, CoA, Trading Permit), and existing steps enriched (SARS VAT threshold, UIF 24-hr qualifier + EMP201 deadline, CIPC AR fee corrected, SMMESA fund figure corrected). **Factual fixes from audit** (all P0/P1): (1) SMMESA copy "R500,000" → "up to R300,000 per shop from the R500m fund"; (2) CoA "expires every 24 months" fiction removed — replaced with accurate "re-apply on shop/PIC/premises change" note; (3) CoA reminder engine no longer fabricates a 24-month timer — only fires when user-supplied expiry_date is present; (4) Joburg trading permit fee seeded as "R300 / 3-year permit"; (5) eThekwini: added `trading_permit` requirements row (fee: free; processing: 21 days); (6) Tshwane R5m note drops "in existing SA business" (not in Imm Regs 2014); (7) fronting notice expands to cite **B-BBEE Act §13O** (10 yrs / 10% turnover / 10-yr state-contract ban) + Immigration Act §42; (8) pest-control copy softened throughout to allow self-managed logging (R638 only requires a logbook; Act 36/1947 PCO only needed for chemical contractor use); (9) CIPC AR fee R30 → R100/R450 banded; (10) VAT/Turnover Tax threshold updated to R2.3m (1 Apr 2026 lift). **New**: lightweight POPIA awareness callout at bottom of journey page. **SARS threshold** in SARSStep.tsx updated from `1_000_000` to `2_300_000`. **Fridge temp lower bound** dropped from `fridgeInRange()` in `stats.ts` (R638 mandates only ≤5°C upper bound; no lower limit in regulation). No DB migration, no new API routes. New i18n keys × 5 locales (compliance-journey full overhaul, compliance-onboarding fronting_body, waste-pest pest copy); parity test green. 616/616 tests pass; `tsc --noEmit` clean.
- BUG-021 PWA install hardening (2026-05-10) — not a phase, but worth recording because it touched the install pipeline end-to-end. Fixed three compounding causes of "Add to Home Screen" producing a Chrome-chrome shortcut with a favicon icon instead of a true standalone PWA: (1) manifest only listed SVG icons — Chrome requires PNG 192×192 + 512×512 to install as a WebAPK; iOS needs `apple-touch-icon.png` at 180×180. Added `scripts/generate-pwa-icons.mjs` (uses `sharp`) which rasterises new brand SVGs (`public/icons/icon.svg` + `icon-maskable.svg` — teal #1ABC9C with white checkbox mark) into `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and `public/apple-touch-icon.png`. `manifest.json` lists the three PNGs first (SVG kept as a tail fallback). Layout adds `metadata.icons.apple` so Next emits the apple-touch-icon link. (2) `InstallPwaButton` had a 7-day localStorage dismiss cooldown that hid the banner even when the install never completed — replaced with component-state-only `hideForNow` (returns on next page-load); the only durable hide path is the real `appinstalled` event or `display-mode: standalone`. Added an inline `beforeinstallprompt` capture script in `src/app/layout.tsx` (Chrome fires the event once, often before React hydrates) that stashes the event on `window.__bipEvent` + dispatches a `bip-ready` custom event so the React component picks it up on late mount. Banner moved from dashboard-only to the `(app)` + `(auth)` layouts so logged-out users see it too, and now falls back to platform-specific manual instructions (Android Chrome ⋮ menu / iOS Share sheet) when `beforeinstallprompt` doesn't fire. (3) **Actual root cause of why the deploy still produced a non-PWA install:** middleware (`src/proxy.ts`) was redirecting `/manifest.json?v=...` → `/login` because the early-return static-file regex didn't include `.json` and the `config.matcher` exclusion list didn't either. Chrome was fetching the login HTML, failing to parse it as JSON, and silently deciding the site is not installable. Added `/manifest.json`, `/sw.js`, `/offline.html` as exact-match early-returns and `json|webmanifest` to the static-extension regex; updated `config.matcher` to mirror those exclusions. SW (`public/sw.js`) bumped v4 → v6 and gained a `NEVER_CACHE_PATHS` bypass (`/manifest.json`, `/apple-touch-icon.png`, `/icons/`, `/sw.js`) so Chrome's installability checker always sees the latest manifest. Manifest URL versioned via `?v=2026-05-10b` so Chrome re-evaluates installability instead of reusing a cached "not installable" verdict. Status-bar polish in the same pass: `theme_color` + `background_color` flipped #1ABC9C → #FFFFFF and `appleWebApp.statusBarStyle` flipped `black-translucent` → `default`, so the Android system status bar paints white with dark icons instead of an unreadable teal-on-white. Branding tweak (small): `TopAppBar` visible header now reads "Movestock" in brand teal with the actual shop/teller name as a small subtitle below (popover dropdown still shows the real shop name); `/settings` page gains a centered "Movestock — a product of Veyon" footnote. New i18n key `install_android_hint` × 5 locales for the manual fallback (parity test green). 614/614 tests pass; `tsc --noEmit` clean. **Prevention rule logged in `tasks/bugs.md` BUG-021:** any unauthenticated browser-pipeline resource (manifest, service worker, offline fallback, web app icons, `.well-known/*`, `robots.txt`, `sitemap.xml`) MUST be reachable without auth — middleware redirects on these break PWA installability and SW registration silently. Always test with `curl -I` against the deployed URL.
- 38 Brand Redesign — Movestock visual identity rollout. New design tokens (teal-forward, flat, pill buttons, Plus Jakarta Sans typeface) wired through `tailwind.config.ts` (custom `brand` palette `#1ABC9C`/`#15A886`/`#0F6E56`/`#E1F5EE` + `surface #F5F5F5` / `ink #1A1A1A` / `line #E0E0E0` / `chat-received #F0F0F0` / `chat-canvas #ECE5DD`; `fontFamily.sans` set to the Jakarta CSS var with sensible system fallbacks). `globals.css` exposes the same tokens via `@theme inline` and paints body in `bg-surface` / `text-ink`. `layout.tsx` imports `Plus_Jakarta_Sans` from `next/font/google` (weights 400/500/600/700, variable `--font-jakarta`), drops the Arial fallback, and ships `themeColor #1ABC9C`. `manifest.json` + `public/offline.html` realigned to the brand color. Three mechanical sweeps across the entire `src/**/*.{ts,tsx}` tree (touched ~140 files in total): **(1) Color sweep** — every `(blue|indigo|sky|teal|cyan|emerald)-*` Tailwind utility collapses to the `brand` family (`50-400 → brand-light`, `500-600 → brand`, `700-900 → brand-hover`); every `shadow-(sm|md|lg|xl|2xl)` utility removed (the brief is "flat — no shadows"). **(2) Radius sweep** — every CTA className that contains `bg-brand` has its `rounded-(md|lg|xl|2xl|3xl)` rewritten to `rounded-full` (50px pill spec); `<button>` elements get `rounded-full` (all CTAs are pill, even white/outline secondaries); `<input>`/`<select>`/`<textarea>` get `rounded-xl` (12px); `bg-white border` cards bumped to `rounded-2xl` (16px); `rounded-3xl` collapsed to `rounded-2xl`. **(3) Final pass** — `<span>`-shaped inline badges (small text + `px-/py-` micro-padding + tinted bg) get `rounded-full` per the badge spec; remaining `rounded-md`/`rounded-lg` on inline notice chips bumped to `rounded-xl`. `min-h-screen bg-gray-50/100` wrappers re-tokened to `bg-surface` so page chrome matches the body background. The `WeeklySalesChart` recharts `Bar fill` + tooltip cursor moved to brand teal. Semantic green/amber/red status colors retained — `compliance-score` band logic, `ReminderBanner` urgency tones, and stock-state badges all keep working. `statusBadgeColors.trialing/active` remapped to `bg-brand-light text-brand-dark`. **No copy/i18n changes** (purely visual phase) — `tests/unit/i18n.test.ts` parity stays green. **No DB migration, no API contract changes.** Audit greps in `src/`: `(blue|indigo|sky|teal|cyan|emerald)-(50..900)` → 0; `shadow-(sm|md|lg|xl|2xl)` → 0; `rounded-(md|lg|3xl)` → 0. All 614/614 tests pass; `tsc --noEmit` clean. Browser smoke test left to user — the harness here is headless and the dev server wasn't started; this is called out for a follow-up `npm run dev` walkthrough of `/login → /dashboard → /sale → /inventory → /manage → /settings` to confirm no visual drift.
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

_Last updated: Products missing-cost card + filtered-edit return flow (2026-05-15)_

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
│   ├── manifest.json, offline.html, sw.js, apple-touch-icon.png   # apple-touch-icon (180×180) — iOS PWA install (BUG-021)
│   └── icons/{icon.svg, icon-maskable.svg,
│              icon-192.png, icon-512.png, icon-maskable-512.png}  # PNGs required by Chrome WebAPK install (BUG-021)
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
│   │   │   ├── suppliers/{page.tsx, new/page.tsx, [id]/page.tsx, assign/page.tsx}
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
│   │       ├── products/{route.ts, [id]/route.ts, popular/route.ts, bulk-import/route.ts, bulk-supplier/route.ts}
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
│   │       ├── daily-checklist/{route.ts, status/route.ts, history/route.ts}   # status (BUG-022) — lightweight `{ completed: boolean }` for the FAB
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
│   │   │   ├── NextStepHero.tsx                          # Phase 39 — "Your next step" hero card
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
│   │   ├── DailySummaryAlert.tsx
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
│   │   ├── barcode/validate.ts             # BUG-030 — GS1 length + checksum validators
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
│   │                                     ├── 026_compliance_reminders.sql
│   └──                                   └── 027_reminder_product_types.sql
├── data/sa-products.csv
├── scripts/{set-admin.ts, seed-catalog.ts, seed-municipalities.ts,
│            generate-pwa-icons.mjs}                                # Rasterises brand SVGs → PNG icon set via sharp (BUG-021)
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
    ├── reminders.test.ts
    └── barcode-scanner.test.ts
```
