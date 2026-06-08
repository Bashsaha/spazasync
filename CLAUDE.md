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
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold, language ('en'/'so'/'am'/'zu'/'ur'), subscription_status, trial_ends_at, subscription_ends_at, payfast_token, access_granted, admin_notes, registration_number, location, has_fridge, has_freezer, municipality_id (FK→municipalities, ON DELETE SET NULL), municipality_area_text (free-text fallback when "Other / not sure" picked at signup), has_employees, fund_interest, onboarding_compliance_completed, onboarding_compliance_dismissed_at, onboarding_compliance_dismiss_count, fund_township_rural (Phase 37e — nullable yes/no), fund_owner_managed (Phase 37e — nullable yes/no), sars_grace_period_until (Phase 41a — DATE; six-month SARS transitional window for Spaza Shop Support Fund eligibility, set at compliance-onboarding completion, backfilled to created_at + 6 months for existing shops)
- `shop_users` — maps auth users to shops with role (owner | teller)
- `tellers` — name (unique per shop), optional auth user_id, `food_safety_trained_at` (Phase 37c — Step 6 staff training)
- `products` — barcode (nullable), name, price, stock_qty, cost_price, supplier_id; unique(shop_id, barcode WHERE NOT NULL); unique(shop_id, LOWER(name))
- `product_batches` — shop_id, product_id, expiry_date, quantity (FEFO source of truth)
- `sales` — total, teller_id, completed_at, offline_id (UNIQUE for dedup), synced_at
- `sale_items` — product_id, quantity, unit_price, subtotal
- `stock_take_entries` — product_id, qty_before, qty_after, teller_id, taken_at, reason (Phase: migration 032 — nullable; set only when qty_after < qty_before; one of `unsure`|`damaged_expired`|`miscount`|`other`; `miscount` is excluded from the stock-loss report)
- `stock_adjustments` — product_id, qty_before, qty_after, delta, reason, adjusted_by, adjusted_at
- `admin_payments` — shop_id, amount, method, reference, notes (service-role only)
- `eft_deposits` — Migration 035 (admin EFT reconciliation). Idempotency ledger: `dedupe_key` (UNIQUE — `date|amount-cents|normalized-ref`), shop_id (FK→shops ON DELETE SET NULL), deposit_date, amount, raw_reference, matched_code, months_applied, new_subscription_ends_at, admin_payment_id (FK→admin_payments ON DELETE SET NULL), uploaded_by, created_at. A row == a bank deposit that was applied to a shop's subscription. RLS enabled, **no policies** (service-role only, BUG-012 pattern). Re-uploading overlapping bank-statement date ranges is safe — UNIQUE(dedupe_key) prevents double-crediting.
- `sale_batch_consumptions` — sale_id, batch_id, product_id, qty_consumed, expiry_date (FEFO audit)
- `barcode_catalog` — barcode (unique), name, category (RLS SELECT all, writes admin only)
- `suppliers` — shop_id, name, contact_number, type, location; unique(shop_id, LOWER(name))
- `goods_received` — shop_id, product_id, supplier_id, quantity, notes, received_by, received_at
- `access_requests` — shop_id, teller_id, feature ('inventory'), status (pending/granted/denied/revoked/expired), requested_at, resolved_at, resolved_by, expires_at; in `supabase_realtime` publication
- `daily_checklists` — shop_id, date (SAST), fridge_ok/temp, freezer_ok/temp, surfaces_cleaned, floor_cleaned, storage_clean, expired_items_action, waste_bins_ok, completed_by, completed_at; UNIQUE(shop_id, date)
- `business_documents` — shop_id, document_type (municipal_registration/coa/cipc/business_license/owner_id/sars_tax/uif/food_safety_training/smmesa), status (valid/expired/pending/not_registered/not_required/on_file/`in_progress` — added 37c), reference_number, date_issued, expiry_date, notes, `applied_at` (Phase 37c — set when owner taps "I've applied"); UNIQUE(shop_id, document_type). The dashboard ComplianceCard score still scopes to the original 5 doc types (see `CORE_COMPLIANCE_DOC_TYPES` in `lib/compliance/document-status.ts`); the journey hub (37c) uses its own status engine in `lib/compliance/journey.ts` covering all 7 step types.
- `owner_profiles` — Phase 37b. user_id PK (FK→auth.users ON DELETE CASCADE), nationality_type ('sa_citizen'|'foreign_national'), food_safety_training_completed, food_safety_training_date, food_safety_training_provider, has_disability (Phase 37e — defaults false; only "priority" attribute we capture, per Design Rule 6), visa_type (Phase 37f — nullable; CHECK enum 'business_visa'|'asylum_seeker_s22'|'refugee_s24'|'work_permit'|'other'), visa_expiry_date (Phase 37f — nullable DATE; null when "doesn't expire / don't know"), naturalised_pre_1994 (Phase 41a — nullable boolean; TRUE means foreign-born owner naturalised as SA citizen before 1994 and qualifies for the Spaza Shop Support Fund per the SEFA guideline), created_at, updated_at. RLS: user can SELECT/INSERT/UPDATE their own row only. Service-role bypasses for atomic onboarding writes.
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
- **Phase 45a:** every shop-scoped policy was rewritten from a per-row `user_in_shop()`/`user_is_owner()` call to the set-membership form `shop_id IN (SELECT shop_id FROM shop_users WHERE user_id = (SELECT auth.uid()))` (evaluated once per statement, not per row — the documented Supabase RLS scaling fix; semantics identical). The helper functions are KEPT for `shop_users`' OWN policies (self-referential → inlining would recurse) + other callers.

### Tables (Phase 45f cold-archive)
- `sales_archive`, `sale_items_archive` — partitioned-by-month (`RANGE (completed_at)`, DEFAULT partition) cold storage for sales older than 18 months. RLS enabled on parents AND partitions, NO policies (service-role only). Populated by `archive_old_sales`; NOT read by app reports (intentionally cold; the archive window is beyond every report range). Touches only old sale records — never products/stock.

### SQL functions
- `decrement_stock(p_product_id, p_qty)` — atomic decrement, clamp to 0
- `decrement_stock_fefo(p_product_id, p_qty, p_sale_id DEFAULT NULL)` — FEFO batch consumption; records to `sale_batch_consumptions` when sale_id given
- **Phase 45 scalability objects** — applied directly to Supabase, **NOT tracked as migration files** (per the inline-SQL workflow the user requested in Phase 45; the raw SQL lives in the Phase 45 chat — keep a runbook copy, it is not in the repo):
  - `complete_sale(p_shop_id, p_teller_id, p_offline_id, p_items jsonb)` — one-transaction sale (insert sale + items w/ unit_cost snapshot + FEFO per line); idempotent on offline_id; replaces the per-item RPC loop (45c)
  - `shop_daily_summary(...)`, `shop_sales_statistics(...)`, `shop_popular_products(...)` — SECURITY INVOKER `GROUP BY` aggregates; removed the JS row-pull + the 20k-sale truncation (45b)
  - `expire_due_shops()` — bulk-flip due shops → expired, returns ids (45e cron)
  - `broadcast_shop_change()` — AFTER trigger on `sales` (INSERT) + `access_requests` (I/U/D) → `realtime.broadcast_changes('shop:<id>:<table>', …)`, exception-wrapped so it can't abort writes; RLS on `realtime.messages` scopes a client to its own shop topics (45d)
  - `db_size_stats()` + `archive_old_sales(p_before, p_batch)` — service-role-only; size monitoring + the 18-month sales→archive move (45f)

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

### UI Primitives Convention (CRITICAL)
Visual primitives live in [src/components/ui/](src/components/ui/). New code MUST assemble pages from these — hand-writing `bg-brand text-white rounded-full ...`, `bg-amber-50 border-amber-200 ...`, `<input className="w-full border border-gray-200 rounded-xl ...">` etc. is a smell. Reach for:
- **Button + LinkButton** (5 variants: primary / secondary / outline / destructive / ghost; 3 sizes; loading + icon slots). The only canonical CTA in the app.
- **Card + LinkCard** — every `bg-white border ... rounded-2xl` block.
- **PageHeader** — `<h1 className="text-2xl font-bold">` + optional subtitle at the top of each page.
- **FormField + Input + Textarea + Select** — every form input. FormField wraps label + control + hint/error.
- **Callout** (tones: info / warning / error / success / brand) — every coloured banner / alert / inline error.
- **Badge** (6 tones) — every inline pill chip.
- **EmptyState** — every "nothing here yet" block on list pages.
- **SectionHeader** — every h2-equivalent above a section inside a page.
- **cx()** — tiny class-name joiner; avoids a `clsx`/`tailwind-merge` dependency.

When adding a new visual pattern that doesn't fit any of these, ADD a new primitive to `src/components/ui/` FIRST, then use it from the page. Pages should be assembly + business logic — they should not be where new visuals are invented. This is the single rule that stops post-launch drift. The primitives match the existing Tailwind tokens 1:1 — using them is a pure consolidation, not a redesign.

Existing pages migrate incrementally as they're touched. Initial sweep (BUG-040 follow-on, 2026-05-19) covered: login, onboarding, settings, profile, sale, sale/complete, products/new, products/[id], suppliers/new, tellers/new. Future commits migrate the rest opportunistically — but ANY NEW page or component MUST start from the primitives.

### Bug Tracking (CRITICAL)
- After fixing any bug: add an entry to `tasks/bugs.md` (symptom, root cause, fix, prevention rule). Mandatory.
- Before touching auth/routing/middleware/API routes: read `tasks/bugs.md` and apply prevention rules.

### Compliance Facts Audit (CRITICAL)
- Every factual claim Movestock makes about SA compliance / R500M Spaza Shop Support Fund / municipal regulation (fees, deadlines, thresholds, regulation references, .gov.za URLs, contact numbers) is inventoried in `tasks/compliance-facts-audit.md` with a source-of-truth URL and a last-verified date.
- **Re-verification is scheduled every 30 days** (next due date is at the top of that file; the admin dashboard `ComplianceVerificationWidget` from Phase 41e alerts when this expires) — sooner if SA Budget speech or major regulatory change.
- **When adding ANY new compliance step, fund step, regulation reference, metro seed row, or hardcoded constant about external regulation**: append the new fact(s) to the inventory in the SAME commit, with last-verified date = today. The audit doc's "When a new compliance step is added" 20-item extension checklist is the authoritative checklist for new-step work.
- Before touching compliance copy, the fund engine (`lib/compliance/fund.ts`), the journey engine (`lib/compliance/journey.ts`), or metro seed data (`scripts/seed-municipalities.ts`): read `tasks/compliance-facts-audit.md` so you understand what's currently asserted and where it lives.
- After any fact-correction phase (like 41a/41b/41c): append to the audit log at the bottom of `tasks/compliance-facts-audit.md`.

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

> **CLAUDE HAS LIVE READ ACCESS TO THE PRODUCTION DATABASE. USE IT — DO NOT ASK, DO NOT ASSUME.**
> The service-role key is in `.env.local`. Before claiming anything about the schema, data, whether
> a migration/column/function exists, or whether something is "outdated/broken" — **query the live DB
> and report facts.** Trust exact counts over planner estimates (`db_size_stats` `rows_estimate` can be stale).

**Read recipe (copy-paste):**
```bash
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d '\r')
K=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '\r')
# table/column exists? (200 = yes; an error names the missing column)
curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/<table>?select=<cols>&limit=0" -H "apikey: $K" -H "Authorization: Bearer $K"
# exact row count (read Content-Range header)
curl -s -D - -o /dev/null "$URL/rest/v1/<table>?select=id&limit=1" -H "apikey: $K" -H "Authorization: Bearer $K" -H "Prefer: count=exact" | grep -i content-range
# call a READ-ONLY rpc (never call a mutating one like complete_sale/archive_old_sales/expire_due_shops)
curl -s -X POST "$URL/rest/v1/rpc/db_size_stats" -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -d '{}'
```
Never print the key in output (use it only in `-H` headers).

- **CANNOT write** (no migrations, no schema changes). Only the user runs SQL in Supabase SQL Editor.
- **Migration workflow:** (1) write `.sql` migration locally, (2) output raw SQL for user to paste, (3) verify via REST API as above (`limit=0` returns `[]` / `200` if the table exists).
- **Reproducibility note:** "Phase 45" objects (RPCs/indexes/RLS rewrites) are live in prod but NOT in `migrations/` — see [supabase/RUNBOOK.md](supabase/RUNBOOK.md).

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
- [x] **Google OAuth consent screen — clean sign-in achieved** — DONE (2026-05-29). App published to **production** under the `movestock.co.za` Workspace account (project ownership shared from the personal Gmail via IAM). Branding configured: app name "Movestock", logo, home page, privacy + terms links, authorized domain `movestock.co.za`, support email = `customersupport@movestock.co.za` (Google Group owned by `director@`). Scopes are non-sensitive only (`email`/`profile`/`openid`), so **no blocking "unverified" warning** — incognito test confirms a clean consent screen with ToS + Privacy links. **Still pending (cosmetic, non-blocking):** Google **brand verification** to display the logo on the consent screen — triggered by the logo upload, runs in the background after Submit for verification; sign-in already works cleanly without it. Full walkthrough: [tasks/google-oauth-setup-guide.md](tasks/google-oauth-setup-guide.md).
- [x] **OAuth support email is on a Movestock domain** — DONE (2026-05-29). A Google Workspace mailbox exists on `movestock.co.za` (e.g. `director@`/`hello@movestock.co.za`) — a real branded inbox, stronger than a forwarding alias. Use it as the public support email on the OAuth consent screen (step 3 of the consent-screen task below).

### Domain & infrastructure
- [x] **Custom domain live on Vercel** — DONE (2026-05-29). `movestock.co.za` is pointed at the Movestock app on Vercel (no longer `*.vercel.app`). This accumulates Safe Browsing reputation and removes the Chrome "deceptive site"/heuristic warning class (BUG-033/034 root cause).
- [x] **Email forwarding / branded mailbox for the custom domain** — DONE (2026-05-29). Satisfied by a Google Workspace mailbox on `movestock.co.za` (set up for professional email) — a real inbox rather than a forwarding alias. Covers OAuth support email + customer support. (Note: Resend handles *sending* auth login codes / future transactional email — a separate pipe, see SMTP item below.)
- [x] **Custom SMTP configured in Supabase** — DONE (2026-05-26). Resend wired into Supabase Auth → SMTP Settings. Domain `movestock.co.za` verified in Resend (DKIM on `resend._domainkey`, SPF + MX on `send.` subdomain — no conflict with Google Workspace SPF which lives on the apex). Sender: `noreply@movestock.co.za` / "Movestock". Region: eu-west-1 (matches Supabase). Send-only address (not a Google Workspace mailbox). Invite test → delivered. Note: nothing user-facing currently triggers Supabase email (owners use Google OAuth, tellers use 6-digit PINs set by the owner) — this covers edge flows (manual Supabase-dashboard invites, future email features). If we add email + 6-digit OTP login back (see BUG-034 note below), this becomes the load-bearing pipe.

### Security
- [x] **Rate limiting on auth + sensitive endpoints** — DONE (2026-05-30). `checkRateLimit` ([rateLimit.ts](src/lib/utils/rateLimit.ts)) is now **durable via Upstash Redis** (`@upstash/ratelimit` sliding window) when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, with the original in-memory limiter as fallback (used locally + always under Vitest via a `process.env.VITEST` guard). The shared store means limits hold across serverless instances + survive cold starts (closes the bypass the in-memory version had). **Fail-open** on Upstash errors (an outage never locks out real users). Identity is `<path>:<ip>` so endpoints throttle separately; buckets are namespaced per `limit:window`. `checkRateLimit` is now async — all 16 call sites awaited; `requireExternalApi` became async too (+6 external-route callers). Wired on `/api/auth/teller-login` (10/min), `/api/onboarding` (3/min), `/api/batches` (30/min), `/api/tellers` POST (10) + PATCH (20), admin endpoints (30/min), `/api/admin/eft-reconcile` (10/hr), external API (60/min). Env vars documented in `.env.local.example` (server-only, no `NEXT_PUBLIC_`). Verified: `tsc` clean, 754/754 tests pass (+1 per-path isolation test), `next build` exit 0. **No SW cache bump** — backend-only (API routes + middleware guard), no client-shell/cached-GET impact.
- [x] **CSP + security headers** — DONE. `vercel.json` ships Content-Security-Policy, Strict-Transport-Security (HSTS, added 2026-05-23), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, and a locked Permissions-Policy. `next.config.ts` defers to vercel.json as the single source of truth. Re-tighten the CSP `'unsafe-inline'`/`'unsafe-eval'` script allowances once on a stable domain if feasible.
- [x] **Secrets review** — DONE (2026-05-24). Verified `.next/static/**` contains no service-role key, no External API key, no CRON_SECRET, no PayFast passphrase. Only the `NEXT_PUBLIC_*` Supabase URL + anon key are exposed (correct — they're public by design). Re-run on each major release: build locally, then grep the bundle for the unique secret-value prefixes from `.env.local`.

### Deferred hardening (not launch-blocking — do after launch)
- [x] **Rate limiting → Upstash** — DONE (2026-05-30). See the Security-section entry above for detail. Upstash Redis DB created (EU region), 2 env vars set in Vercel + `.env.local`; `checkRateLimit` uses Upstash when configured, in-memory fallback otherwise, fail-open on outage.
- [x] **Tighten CSP** — DONE (2026-05-30, pending final live re-confirm). `script-src` is `'self' 'nonce-…'` — both `'unsafe-eval'` and `'unsafe-inline'` removed. **History:** the nonce migration was first blamed for a teller redirect loop and reverted — but the loop turned out to be the **subscription gate** applying to tellers (BUG-047, fixed separately in commit 5351c27), NOT the nonce. Re-applied 2026-05-30 with a **more robust cookie sync**: per-request nonce generated in [proxy.ts](src/proxy.ts) (`crypto.randomUUID()`), threaded onto the forwarded request headers (`x-nonce` + CSP, so Next.js auto-stamps its inline hydration scripts) + the enforced response header; root [layout.tsx](src/app/layout.tsx) reads `x-nonce` via `headers()` and stamps the inline `beforeinstallprompt` script. **The cookie-propagation fix vs the first attempt:** `setAll` now rebuilds the forwarded `cookie` header from the authoritative `request.cookies.getAll()` store after a token refresh (not a stale `request.headers.get('cookie')`), so the refreshed access token reliably reaches the `(app)/layout.tsx` `getUser()` — preventing the cookie-race redirect loop that *could* have occurred on the token-refresh path. CSP moved from `vercel.json` to middleware (per-request nonce can't live in a static header); other security headers stay in `vercel.json`. `'strict-dynamic'` omitted (plain `'self' 'nonce-…'` degrades a missed nonce to "still loads" not white-screen). `style-src` keeps `'unsafe-inline'`. Verified: `tsc` clean, `next build` exit 0, 754/754 tests. SW cache v66 → v67. **Live verification required** (build + unit tests do NOT exercise the authenticated render path): after deploy, fresh/incognito session → test BOTH owner AND teller login + the console for CSP violations; if it loops, instant-rollback via Vercel promote-prior. Also worth a re-test after the app sits >1h (exercises the token-refresh cookie path).
- [ ] **Supabase Custom Domain (cosmetic)** — the Google sign-in consent screen shows the raw Supabase host `rbbnfixogbecsntisbhl.supabase.co` on the redirect line (the app name still shows "Movestock"). Renaming it to `auth.movestock.co.za` (or vanity `movestock.supabase.co`) requires Supabase's **Custom Domains add-on** — needs the **Pro plan (~$25/mo) PLUS the add-on (~$10/mo)**; not available on Free, and there is **no free way** to rebrand the auto-generated project host. Decided 2026-05-29 NOT worth it at launch (recurring cost for a line most owners don't read). Revisit only if/when on Pro anyway. If done: enable add-on → add CNAME → update Google OAuth authorized redirect URI → update `NEXT_PUBLIC_SUPABASE_URL` in Vercel → redeploy → re-test sign-in.

### Compliance & legal
- [x] **Privacy policy page** — DONE (2026-05-23). Live at `/legal/privacy`, POPIA-first, lists data collected + usage. **Action remaining:** confirm the support email (`hello@movestock.co.za` placeholder) + the Supabase project region before relying on it for OAuth verification.
- [x] **Terms of service page** — DONE (2026-05-23). Live at `/legal/terms`. Governing law = South Africa; includes a compliance-info disclaimer.
- [x] **POPIA compliance review** — DONE (2026-05-24). Self-service data export now ships at Settings → Your data (`GET /api/account/export`) — returns a JSON file containing every row Movestock holds about the owner + shop (POPIA Section 23 right of access). Deletion path: Settings → Danger zone (`DELETE /api/account`). Privacy policy updated to point owners at both flows. Subscription-exempt — POPIA rights can't be gated on payment.

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

Phases 1–36c + 37a–37g + 38 + 39 + 40 + 41a + 41b + 41c + 41d + 41e + 42 + 43 + 44 + 45 + 46 + 47 complete. See [ARCHIVE.md](ARCHIVE.md) for detailed summaries (compressed per Rule 7).

**Phase 47 — "Stocky 2.0": always-on, discoverable helper — COMPLETE (2026-06-08).** Reworked Stocky from a proactive-only rare nudge (the "saw it once and never again" bug: a 48h cooldown + once-per-session gate strangled it, with no way to summon it) into an **always-visible, tappable helper button** in the TopAppBar next to the bell (owners/admins; hidden on /sale, tellers, and off guide routes). Tap → a **"What can I show you here?" bottom sheet** of the current page's tips (`StockyTipSheet`); pick one → the existing dimmed **spotlight** highlights the real element. An **amber dot** on the button flags an active contextual trigger (low-stock/expiring/missing-cost/no-sale) — it replaces the deleted auto-popup. **Discoverability:** a one-time **welcome** spotlights the button itself on first dashboard visit (after 4s idle, single "Got it"), a "Tap me for help" caption shows on the first 3 home visits, and the sheet self-explains (+ a first-open "I highlight things for you" line). Re-enabling tips in Settings resets the welcome. **Coverage:** per-page tips + `data-tour` anchors on /dashboard, /inventory, /stock, /products, /sales, /manage. Pure logic rewritten to `listPageTips`/`hasActiveTip` (no cadence; `tests/unit/guide.test.ts` updated). RobotGuide deleted; mount moved to `TopAppBar` via `helperUserId`. New i18n keys × 5 locales (parity-enforced). SW cache v90→v91. 809/809 tests, tsc + build clean. **Live phone test still recommended** (the spotlight/sheet/welcome render path isn't exercised by tsc/unit/build).

**Phase 46 — "Stocky" the in-app feature guide — COMPLETE (2026-06-06).** A small friendly robot (inline SVG, CSS-animated, no deps, offline-safe) that occasionally appears on the home hubs (owners/admins only) and teaches ONE feature at a time with a dimmed spotlight + pulsing brand ring on the target element. 100% plain software — NO AI at runtime: reads a hand-authored static catalog (`lib/guide/catalog.ts`) + rule-based contextual triggers (`lib/guide/triggers.ts` — low-stock/expiring/missing-cost/no-sale-today) evaluated against `/api/summary/daily`. Calm cadence: home screens only (`/dashboard`,`/sales`,`/inventory`,`/manage`), after ~4s idle, ≤1 tip / 48h / session, hard-suppressed during any task or sale. Per-user localStorage state (`lib/guide/storage.ts`); pure selection/cadence logic in `lib/guide/select-tip.ts` (unit-tested, `tests/unit/guide.test.ts`). Pages opt in with a one-line `data-tour="<token>"` attribute (on the BottomNav tabs, the New-Sale FAB, the dashboard Today card). Mounts once in `AppChrome`; Settings → "Helper tips" toggle re-enables after "Don't show tips". New `guide` i18n namespace × 5 locales. SW cache v88→v89. **Live phone test still recommended** (the spotlight/coachmark render path isn't exercised by tsc/unit/build).

**Phase 44 — App Shell Architecture / instant-open PWA — COMPLETE (2026-06-02), incl. the static App Shell + phone-verified.** 44a (resume-crash foundation), 44b (per-screen cache-first + the BUG-050 staleTimes resume-nav fix), AND the static **App Shell** (Stage 1 splash + Stage 2 data-free `(app)` shell + the dashboard increment) are all DONE and confirmed working on a real phone. **Cold START / app-kill is now solved:** `/`, `/sale`, `/dashboard` paint instantly from the SW cache on a cold open, with data hydrating cache-first. See the App Shell entry in "Most recent" for how it works.

Most recent:

Most recent change detail lives in [ARCHIVE.md](ARCHIVE.md) under "Recent change log (pre-archive detail)" — moved there to keep this file a concise reference. The phase list above is the index; ARCHIVE.md is the history.

When starting a new phase, append it here and update the file tree.

---

## Current File Tree

_Last updated: Phase 46 "Stocky" feature guide COMPLETE (2026-06-06)_

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
│   │   ├── layout.tsx, error.tsx, not-found.tsx, globals.css, favicon.ico
│   │   ├── page.tsx                       # App Shell — static DATA-FREE splash (start_url=/) + <LaunchRouter>; SW-precached
│   │   ├── auth/callback/route.ts
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                 # Wraps in LanguageProvider
│   │   │   ├── login/page.tsx             # Owner + Teller tabs
│   │   │   └── onboarding/page.tsx        # Language → Account → Shop
│   │   ├── (app)/
│   │   │   ├── layout.tsx                 # App Shell — DATA-FREE per locale; auth/lockout/locale server-side; chrome via <AppChrome>
│   │   │   ├── error.tsx
│   │   │   ├── dashboard/{page.tsx, loading.tsx}     # App Shell — 'use client' cache-first (GET /api/dashboard); data-free + SW-cached
│   │   │   ├── settings/page.tsx
│   │   │   ├── subscribe/page.tsx
│   │   │   ├── sale/{page.tsx, complete/page.tsx}
│   │   │   ├── expiry/{page.tsx, loading.tsx}
│   │   │   ├── stock-take/{page.tsx, loss/page.tsx, history/page.tsx}    # Phase 40 = loss; history = who-counted-what (owner-only)
│   │   │   ├── stock/{page.tsx, loading.tsx, [id]/page.tsx}
│   │   │   ├── products/{page.tsx, new/page.tsx, [id]/page.tsx}
│   │   │   ├── tellers/{page.tsx, loading.tsx, new/page.tsx}
│   │   │   ├── suppliers/{page.tsx, new/page.tsx, [id]/page.tsx, assign/page.tsx}
│   │   │   ├── checklist/{page.tsx, loading.tsx, history/page.tsx}
│   │   │   ├── documents/{page.tsx, loading.tsx, [type]/page.tsx}
│   │   │   ├── waste-pest/{page.tsx, pest/{page.tsx, new/page.tsx}, waste/page.tsx}
│   │   │   ├── inspection/{page.tsx, loading.tsx}
│   │   │   ├── sales/{page.tsx, history/page.tsx, statistics/page.tsx}    # Hub + drill-downs (Phase 42 = statistics)
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
│   │   │       ├── alerts/{page.tsx, new/page.tsx, [id]/page.tsx}    # Phase 37g
│   │   │       └── eft-reconcile/page.tsx                            # Admin EFT reconciliation (bank-statement upload)
│   │   └── api/
│   │       ├── auth/teller-login/route.ts
│   │       ├── account/{route.ts, export/route.ts}         # DELETE = self-delete; export = POPIA data export (2026-05-24)
│   │       ├── onboarding/route.ts
│   │       ├── catalog/importable/route.ts
│   │       ├── products/{route.ts, [id]/route.ts, popular/route.ts, bulk-import/route.ts, bulk-supplier/route.ts}
│   │       ├── sales/{route.ts, by-date/route.ts, statistics/route.ts, hub/route.ts}    # statistics = Phase 42; hub = /sales cache-first
│   │       ├── batches/{route.ts, [id]/route.ts}
│   │       ├── stock/{route.ts, expiry/route.ts}
│   │       ├── stock-take/{route.ts, history/route.ts}      # history = Phase 44b (cache-first)
│   │       ├── inventory/summary/route.ts                   # Phase 44b — hub count strip
│   │       ├── stock-loss/route.ts                          # Phase 40
│   │       ├── subscribe/{checkout/route.ts, notify/route.ts, status/route.ts}
│   │       ├── cron/{expire-subscriptions,prune-reminders,archive-old-sales}/route.ts   # archive-old-sales = Phase 45f
│   │       ├── summary/daily/route.ts
│   │       ├── dashboard/route.ts                           # App Shell — consolidated owner dashboard payload
│   │       ├── admin/
│   │       │   ├── overview/route.ts
│   │       │   ├── catalog/{route.ts, [id]/route.ts}
│   │       │   ├── shops/{route.ts, [id]/{route.ts, payments/route.ts, access/route.ts, notes/route.ts, subscription/route.ts}}
│   │       │   └── eft-reconcile/{route.ts, apply-one/route.ts}    # Admin EFT reconciliation
│   │       ├── external/v1/
│   │       │   ├── overview/route.ts
│   │       │   └── shops/{route.ts, [id]/{route.ts, sales/route.ts, stock/route.ts, expiry/route.ts}}
│   │       ├── reports/                                       # Phase 37d adds 5 PDF endpoints
│       │   ├── compliance-pdf/route.ts, monthly-sales-pdf/route.ts
│       │   ├── landlord-affidavit/route.ts                # 37d (Phase 41c removed trading-permit-summary)
│       │   ├── goods-declaration/route.ts                 # 37d
│       │   ├── food-safety-pack/route.ts                  # 37d
│       │   ├── fund-application-pack/route.ts             # 37d (SA + fund_interest gated)
│       │   ├── stock-loss-pdf/route.ts                    # Phase 40
│       │   └── sales-statistics-pdf/route.ts              # Phase 42
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
│   │       ├── admin/db-stats/route.ts                             # Phase 45f — DB-size widget (service-role db_size_stats())
│   │       └── tellers/[id]/training/route.ts                      # Phase 37c — Step 6 staff toggle
│   │   ├── legal/                          # Public legal pages — English-only, no auth/i18n (proxy.ts early-returns /legal)
│   │   │   ├── layout.tsx, privacy/page.tsx, terms/page.tsx
│   │   ├── shop-suspended/                  # Teller lockout screen — top-level (outside (app)) so no redirect loop (BUG-047 follow-up)
│   │   │   ├── page.tsx, ShopSuspendedActions.tsx
│   ├── components/
│   │   ├── auth/EmailOtpForm.tsx                  # 2026-05-26 — email + 6-digit OTP login (alt to Google)
│   │   ├── products/{CatalogImportSheet.tsx, BarcodeScanButton.tsx, ProductListRow.tsx}  # ProductListRow = Phase 44b shared row
│   │   ├── sale/{TellerSelector.tsx, CartItem.tsx, CartSummary.tsx, NewProductModal.tsx, ProductPicker.tsx}
│   │   ├── scanner/{BarcodeScanner.tsx, ScannerOverlay.tsx}
│   │   ├── admin/{AdminNav.tsx, ComplianceVerificationWidget.tsx, DbSizeWidget.tsx}   # DbSizeWidget = Phase 45f
│   │   ├── dashboard/
│   │   │   ├── WeeklySalesChart.tsx
│   │   │   ├── DashboardSummaryCards.tsx    # Phase 44b — cache-first Today/Low/Expiring (one /api/summary/daily snapshot)
│   │   │   ├── TodaySummaryView.tsx         # Phase 44b — shared presentational Today card (dashboard + /sales hub)
│   │   │   ├── ComplianceCardView.tsx       # App Shell — presentational compliance card (from /api/dashboard)
│   │   │   ├── JourneyProgressCardView.tsx  # App Shell — presentational journey card
│   │   │   ├── LatestSalesView.tsx          # App Shell — shared presentational latest-sales list
│   │   │   └── DashboardRealtime.tsx        # App Shell — cross-device sale → emitDataChanged() (replaces DashboardAutoRefresh)
│   │   │   # (server wrappers TodaySummary/WeeklyChartSection/TopProducts/LatestSales deleted 2026-06-04 — /sales hub is now cache-first)
│   │   ├── inventory/InventorySummaryStrip.tsx   # Phase 44b — cache-first hub count strip
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
│   │   │              SARSStep, UIFStep, FoodSafetyStep, SMMESAStep,
│   │   │              RightToTradeStep}.tsx   # RightToTradeStep = Phase 43 (foreign-national-only)
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
│   │   ├── NewSupplierModal.tsx
│   │   ├── ResumeGuard.tsx                  # Phase 44a — refresh session + probe on resume, then emit RESUME_READY
│   │   ├── LaunchRouter.tsx                 # App Shell — splash brain: local session → hard-nav to dest
│   │   ├── AppChrome.tsx                    # App Shell — client chrome + owner-gate/teller-lockout nets (data-free layout)
│   │   ├── LegalFooter.tsx                  # 'use client' — Terms/Privacy links under login + onboarding
│   │   ├── guide/                           # Phase 46→47 — "Stocky" feature guide (self-contained)
│   │   │   ├── StockyHelper.tsx             # orchestrator + resting button (mounted in TopAppBar): intro/sheet/spotlight/dot
│   │   │   ├── StockyTipSheet.tsx           # Phase 47 — "What can I show you here?" per-page tip sheet (portal)
│   │   │   ├── RobotBuddy.tsx               # inline SVG mascot (CSS-animated, reduced-motion aware)
│   │   │   ├── SpotlightOverlay.tsx         # portal: 4-panel dim + punch-out + ring + bubble (+ gotItOnly welcome variant)
│   │   │   ├── useTourTarget.ts             # resolve data-tour anchor → tracked DOMRect (poll + rAF, graceful miss)
│   │   │   └── GuideTipsToggle.tsx          # Settings "Helper tips" re-entry toggle (re-enable resets the welcome)
│   │   └── ui/                              # Design-system primitives (2026-05-19)
│   │       ├── Button.tsx, Card.tsx, PageHeader.tsx, SectionHeader.tsx
│   │       ├── FormField.tsx, Callout.tsx, Badge.tsx, EmptyState.tsx
│   │       ├── cx.ts, index.ts
│   ├── hooks/
│   │   ├── useActiveTeller.ts, useCart.ts, useScanner.ts, useUserRole.ts, useCachedData.ts  # useCachedData = Phase 44b cache-first engine
│   │   └── useOnlineStatus.ts, useOfflineSync.ts, useRefetchOnVisible.ts
│   ├── lib/
│   │   ├── supabase/{client.ts, server.ts, admin.ts}
│   │   ├── auth/{teller.ts, admin-guard.ts, shop-auth.ts, external-api-guard.ts, recent-users.ts,
│   │   │          route-access.ts,          # route allow-lists extracted from proxy.ts (testable; BUG-047)
│   │   │          claims.ts}                # Phase 44a — getAuthClaims(); shop-auth.ts adds getShopAuthFast (45e, reads)
│   │   ├── guide/{types.ts, catalog.ts, triggers.ts, select-tip.ts, storage.ts}  # Phase 46→47 — Stocky data + pure logic (listPageTips/hasActiveTip; no AI, no DOM)
│   │   ├── realtime/shop-channel.ts         # Phase 45d — subscribeShopBroadcast (per-shop Broadcast, replaces postgres_changes)
│   │   ├── subscription/expiry.ts           # pure isSubscriptionExpired — shared by owner gate + teller lockout
│   │   ├── payfast/index.ts
│   │   ├── db/
│   │   │   ├── products.ts, sales.ts, sales-history.ts, monthly-sales-report.ts
│   │   │   ├── stock-take.ts, stock-take-history.ts, stock.ts, stock-loss.ts, sales-statistics.ts, reports.ts, admin.ts, catalog.ts, batches.ts
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
│   │   │   ├── admin-alerts.ts                         # Phase 37g — service-role CRUD helpers
│   │   │   ├── shop.ts                                 # Cost pass — React.cache shop dedupe (+access_granted for teller lockout)
│   │   │   └── eft-reconcile.ts                        # Admin EFT reconciliation — renewal-aware extend + idempotent apply
│   │   ├── offline/{db.ts, sync.ts, clear-session-cache.ts}   # clear-session-cache = SECURITY-001 logout purge
│   │   ├── pdf/shared.ts                   # Phase 37d — shared jsPDF helpers + PII guard
│   │   ├── barcode/validate.ts             # BUG-030 — GS1 length + checksum validators
│   │   ├── eft/                            # Admin EFT reconciliation (format-agnostic core)
│   │   │   ├── types.ts, match.ts          # pure engine: renewal-aware extend, code match, months, dedupe
│   │   │   └── adapters/{index.ts, parse-ofx.ts, parse-csv.ts}   # OFX + content-detecting CSV (layout-drift resilient)
│   │   ├── checklist/stats.ts
│   │   ├── compliance/{document-status.ts, waste-pest-status.ts, score.ts, onboarding.ts,
│   │   │                journey.ts, goods-description.ts, fund.ts, reminders.ts,
│   │   │                nationality-divergence.ts}   # Phase 43 — citizen/foreigner firewall manifest
│   │   │                # fund.ts (37e), reminders.ts (37g — pure evaluator + bucket-key engine)
│   │   ├── i18n/
│   │   │   ├── types.ts, interpolate.ts, loader.ts, server.ts
│   │   │   └── translations/{en,so,am,zu,ur}/  (25 namespaces each — +guide Phase 46)
│   │   │       # common, auth, sale, sales, sales-statistics, dashboard, settings, stock,
│   │   │       # stock-loss, products, tellers, expiry, summary, suppliers, checklist, documents,
│   │   │       # waste-pest, inspection, inventory, manage, compliance-onboarding,
│   │   │       # compliance-journey, compliance-fund, compliance-reminders
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
│   │                                     ├── 027_reminder_product_types.sql
│   │                                     ├── 028_naturalised_and_sars_grace.sql
│   │                                     ├── 029_durban_coa_environmental_health_office.sql
│   │                                     ├── 030_phase_41d_seed_completeness.sql
│   │                                     ├── 031_compliance_verification_log.sql
│   │                                     ├── 032_stock_take_reason_and_realtime.sql
│   │                                     ├── 033_foreign_national_path_corrections.sql
│   │                                     ├── 034_cost_optimisation_indexes.sql
│   │                                     ├── 035_eft_deposits.sql
│   └──                                   └── 036_scaling_levers.sql
├── data/sa-products.csv
├── scripts/{set-admin.ts, seed-catalog.ts, seed-municipalities.ts,
│            generate-pwa-icons.mjs}                                # Rasterises brand SVGs → PNG icon set via sharp (BUG-021)
├── tasks/{todo.md, todo-archive.md, lessons.md, bugs.md,
│         compliance-facts-audit.md, pre-prod-external-setup.md}
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
    ├── stock-loss.test.ts
    ├── sales-statistics.test.ts
    ├── compliance-nationality-firewall.test.ts   # Phase 43 — fails build if citizen-only copy leaks to foreigners
    ├── barcode-scanner.test.ts
    ├── eft-reconcile.test.ts                      # EFT match engine + OFX/CSV adapters
    ├── subscription-expiry.test.ts                # shared isSubscriptionExpired helper (owner gate + teller lockout)
    ├── guide.test.ts                              # Phase 46 — Stocky tip selection + cadence gate + triggers
    └── route-access.test.ts                       # BUG-047 invariant: teller redirect targets are reachable
```
