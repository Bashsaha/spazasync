# SpazaSync — CLAUDE.md

## What this project is

SpazaSync is a mobile-first PWA for South African spaza shop and small retail owners. These owners currently calculate sales on a basic calculator and manage stock manually or not at all. SpazaSync replaces that entire workflow with a smartphone app that requires no technical skill.

**Core flow:** owner opens the app on their Android phone → scans a product barcode using their phone camera → product added to the sale → stock automatically deducted when the sale is completed → owner sees an in-app daily summary of sales and stock levels each evening.

**Target user:** someone with no technical background. Plain English. No jargon. Obvious UI. Works on a mid-range Android smartphone, no laptop or external hardware needed.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict mode |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL, RLS, Supabase Auth) |
| Deployment | Vercel (+ Vercel Cron Jobs) |
| Validation | Zod |
| Testing | Vitest |
| Barcode scanning | `@zxing/browser` — phone camera, no hardware |
| Offline | IndexedDB via `idb` library |
| Timezone | `date-fns-tz` with `Africa/Johannesburg` |

---

## Auth Model

### Owner
- Logs in with: **email + password** (Supabase email auth)
- Sees: full app (dashboard, products, stock, stock take, tellers, settings, sale)
- On sale page: must select which teller is serving before scanning

### Teller
- Logs in with: **shop code + display name + password**
- Synthetic email under the hood: `{name-slug}@shop-{shop-code}.spazasync.app`
- Password created by owner; teller receives it out-of-band
- Sees: **only the sale page** — proxy.ts locks all other routes
- Auto-selected as the active teller (no TellerSelector shown)
- No cross-shop data visibility (RLS + synthetic email scoping)

### Admin
- Logs in with: **email + password** (same Supabase email auth)
- Promoted via CLI script: `npx tsx scripts/set-admin.ts user@example.com`
- Sees: `/admin/*` routes — platform-level dashboard for managing all stores
- **Dual-role (Phase 15e):** if promoted from an existing owner, retains `shop_id` and can access all shop pages too
- Skips subscription gate entirely
- Admin-only data access via service role (admin) client; shop data via RLS (if linked to a shop)

### Shop Code
- Short identifier chosen by owner at onboarding (e.g. `CAPE99`, `MLUNGU01`)
- Stored in `shops.code` — globally unique, 6–10 chars, uppercase alphanumeric
- Used on teller login screen

### Access Matrix

| Route | Owner | Teller | Admin (dual-role) |
|---|---|---|---|
| /dashboard | ✓ | ✗ | ✓ (if linked to shop) |
| /sale | ✓ | ✓ | ✓ (if linked to shop) |
| /stock-take | ✓ | ✗ | ✓ (if linked to shop) |
| /products | ✓ | ✗ | ✓ (if linked to shop) |
| /stock | ✓ | ✗ | ✓ (if linked to shop) |
| /tellers | ✓ | ✗ | ✓ (if linked to shop) |
| /settings | ✓ | ✗ | ✓ (if linked to shop) |
| /admin/* | ✗ | ✗ | ✓ |

---

## Database Schema

### Tables
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold, language (default 'en', CHECK en/so/am/zu/ur), subscription_status, trial_ends_at, subscription_ends_at, payfast_token, access_granted, admin_notes, registration_number, location, created_at
- `shop_users` — maps auth users to shops with role (owner | teller)
- `tellers` — named teller entries; optional link to auth user_id; name unique per shop
- `products` — barcode (nullable), name, price, stock_qty; unique(shop_id, barcode) where barcode IS NOT NULL; unique(shop_id, LOWER(name)) case-insensitive
- `product_batches` — shop_id, product_id, expiry_date, quantity; tracks per-batch expiry dates with FEFO deduction; RLS via user_in_shop(shop_id)
- `sales` — total, teller_id, completed_at, offline_id for dedup, synced_at
- `sale_items` — product_id, quantity, unit_price, subtotal
- `stock_take_entries` — product_id, qty_before, qty_after, teller_id, taken_at
- `stock_adjustments` — product_id, qty_before, qty_after, delta, reason, adjusted_by, adjusted_at
- `admin_payments` — shop_id, amount, method (eft/cash/card/other), reference, notes, recorded_by, recorded_at (RLS enabled, no policies — service role only)
- `sale_batch_consumptions` — sale_id, batch_id, product_id, qty_consumed, expiry_date; audit trail for FEFO batch deductions during sales; RLS via sales.shop_id join
- `barcode_catalog` — barcode (unique), name, category; RLS SELECT for all, writes via admin client only (Phase 16a)
- `suppliers` — shop_id, name, contact_number, type (wholesaler/distributor/farmer/other), location; unique(shop_id, LOWER(name)); RLS via user_in_shop(shop_id) (Phase 30a)
- `goods_received` — shop_id, product_id, supplier_id (nullable), quantity, notes, received_by, received_at; RLS via user_in_shop(shop_id); text-only audit trail logged on every stock top-up (Phase 30b)
- `products.supplier_id` — last-known supplier, nullable FK to suppliers (ON DELETE SET NULL) (Phase 30b)

### RLS helpers
- `user_in_shop(shop_id)` — SECURITY DEFINER function
- `user_is_owner(shop_id)` — SECURITY DEFINER function

### SQL functions
- `decrement_stock(p_product_id, p_qty)` — atomically decrement stock, clamp to 0
- `decrement_stock_fefo(p_product_id, p_qty, p_sale_id DEFAULT NULL)` — FEFO batch consumption: deducts from earliest-expiring batches first; when p_sale_id provided, records each consumption in sale_batch_consumptions

All tables have RLS enabled. `admin_payments` and `barcode_catalog` writes are service-role-only (no user-facing policies).

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

## Workflow Orchestration Rules

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 1b. Phase Gating (CRITICAL)
- **NEVER auto-start the next phase.** After completing a phase, STOP.
- Update CLAUDE.md with what was built in that phase (file tree, Living Scope, phase notes).
- Then WAIT for the user to explicitly say "start phase N" or "go" before continuing.
- This applies to ALL multi-phase work — no exceptions.

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how
- **After fixing any bug: add an entry to `tasks/bugs.md`** with symptom, root cause, fix, and a prevention rule. This is mandatory — not optional.
- Before touching auth/routing/middleware/API routes, read `tasks/bugs.md` and apply all listed prevention rules.

### 7. Phase Summary Rule (CRITICAL)
- After an **entire phase group** is fully implemented and verified (e.g., all of Phase 15a–15e, all of Phase 16a–16d, etc.), **summarize the detailed "What was built" notes** into a concise 2–4 line summary per phase.
- The summary must retain: key files/migrations created, important architectural decisions, and notable bug fixes — but drop per-file NEW/UPDATED annotations and line-by-line details.
- This prevents CLAUDE.md from growing unboundedly while preserving enough context for future sessions.
- Individual sub-phases should keep full detail until the entire phase group is complete.

### 8. i18n Coverage Rule (CRITICAL)
- SpazaSync supports 5 locales: `en` (English), `so` (Somali), `am` (Amharic), `zu` (IsiZulu), `ur` (Urdu).
- **Any time a user-facing string is added, changed, or removed in `src/lib/i18n/translations/en/*.json`, the SAME key MUST be added/changed/removed in all other locale directories** (`so/`, `am/`, `zu/`, `ur/`) **in the same phase**. Missing keys in a non-English locale are a phase-blocker — the phase cannot be marked complete.
- Translations must be native (not copy-pasted English). Use the plain-English SpazaSync tone: short, friendly, no jargon. If you genuinely can't translate (e.g. a brand name), fall back to English with a comment explaining why.
- Every new page or component that renders user-visible text MUST use `useTranslation()` (client components) or `getServerTranslations()` (server components). NEVER hardcode English strings in JSX or component files.
- The i18n key-parity test (`tests/unit/i18n.test.ts`) enforces parity automatically. If it fails, stop and fill in the missing locales before continuing.
- When adding a new namespace JSON file (e.g. `en/foo.json`), also add `so/foo.json`, `am/foo.json`, `zu/foo.json`, `ur/foo.json` in the same commit.

---

## Task Management Rules

1. **Plan First:** Write plan to tasks/todo.md with checkable items
2. **Verify Plan:** Check in before starting implementation
3. **Track Progress:** Mark items complete as you go
4. **Explain Changes:** High-level summary at each step
5. **Document Results:** Add review section to tasks/todo.md
6. **Capture Lessons:** Update tasks/lessons.md after corrections

---

## Core Principles

- **Simplicity First:** Make every change as simple as possible. Impact minimal code.
- **No Laziness:** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact:** Changes should only touch what's necessary. Avoid introducing bugs.

---

## Git Safety Rules (CRITICAL — NO EXCEPTIONS)

### NEVER allowed — under any circumstances, even if asked:
- `git push --force` or `git push -f` (overwrites remote history — can destroy the entire codebase)
- `git reset --hard` on any branch that has been pushed
- `git branch -D main` or `git branch -D master` (deleting the main branch)
- `git clean -fd` or `git clean -fx` (permanently deletes untracked files)
- `rm -rf .git` (destroys the entire repo)
- Deleting or overwriting the remote repository via `gh repo delete` or any GitHub API call
- `git checkout .` or `git restore .` on a broad scope (discards all uncommitted work)
- Any command that batch-deletes files, branches, or commits without explicit user review of EACH item

### ALWAYS allowed:
- `git add` (staging files)
- `git commit` (creating new commits — never amend unless user explicitly asks)
- `git push` (normal push to remote — no force flags)
- `git status`, `git log`, `git diff` (read-only inspection)
- `git branch <name>` (creating new branches)
- `git checkout <branch>` or `git switch <branch>` (switching branches)
- `git stash` / `git stash pop` (temporary storage)

### Requires EXPLICIT user confirmation before running:
- `git reset` of any kind (explain what will happen first)
- `git rebase` (explain what will happen first)
- Deleting any branch (`git branch -d`)
- Any `gh` command that modifies the remote (creating PRs is fine, deleting things is not)

### Defensive habits:
- Before any destructive git operation, run `git log --oneline -5` and `git status` and show the output to the user
- If unsure whether a command is safe, ASK the user first
- Prefer creating new commits over amending or rebasing
- Never run a command you found online without understanding exactly what it does

---

## Living Project Awareness Rules (CRITICAL)

### File Structure Awareness
- This CLAUDE.md file contains the **ground-truth file structure** at all times
- After every completed phase, run a Glob scan and update the file tree below to reflect reality
- Any new file created, renamed, or deleted must be reflected here before the phase is marked complete
- At the start of every new session, read this file fully before taking any action — mandatory, not optional

### Phase Completion Protocol
At the end of every phase, before marking it complete — execute EVERY step, in order, no skipping:
1. **Glob scan** the project root — actually run the Glob tool, don't guess from memory
2. **Compare** against the file tree below — diff what's on disk vs what CLAUDE.md says
3. **Update** the file tree to match reality
4. **Check off** the completed phase in the Living Scope section
5. **Add a "What was built"** note under the phase entry
6. **Supabase migration check** — if the phase includes a new migration file, output the raw SQL for the user to paste into the Supabase SQL Editor, then verify the migration was applied using the Supabase REST API (see Supabase Access Rules below). Do NOT mark the phase complete until verified.
7. **Commit to GitHub** — stage all new/modified files, commit with message `feat: Phase N — <short description>`, push to `main`
8. **Output a completion confirmation** to the user listing each step done. Example: "Phase completion checklist: Glob scanned, file tree updated (added X files), Living Scope checked off, commit abc1234 pushed." This proves the protocol was followed.
9. Only then mark the todo item as complete
10. **STOP.** Do not start the next phase. Wait for user to say go.

### Supabase Access Rules
- **You CAN read** Supabase data via the REST API using the service role key from `.env.local`. Use `curl` with the `apikey` and `Authorization` headers to query tables, check if tables exist, or verify migrations were applied.
- **You CANNOT write** to Supabase (run migrations, create tables, modify functions). Only the user can do this by pasting SQL into the Supabase SQL Editor.
- **Migration workflow:** (1) write the `.sql` migration file locally, (2) output the raw SQL to the user so they can paste it into Supabase SQL Editor, (3) after the user confirms or you verify via REST API that the table/function exists, mark the migration as applied.
- **Verification pattern:** `curl -s "https://<project>.supabase.co/rest/v1/<table>?select=id&limit=0"` with service role headers — returns `[]` if table exists, returns an error if it doesn't.

### Session Start Protocol
At the start of every session:
1. Read this file fully — mandatory (not skim — READ)
2. Note which phases are complete (Living Scope below)
3. Note the current real file structure (File Tree below)
4. Review tasks/lessons.md
5. **Read tasks/bugs.md** — mandatory before touching auth, routing, API routes, or middleware. Apply all prevention rules listed there.
6. Pick up from where the project left off
7. **Output a checklist acknowledgment** to the user confirming steps 1-6 were done. Example: "Session start checklist: read CLAUDE.md, noted Phase X complete, reviewed lessons.md (N lessons), read bugs.md (N bugs), picking up at Phase Y." This is not optional — it proves the protocol was followed, not skimmed.

---

## Living Scope

- [x] Phase 1: Project Bootstrap
- [x] Phase 2: Auth, Roles & Onboarding
- [x] Phase 3: Product Catalogue
- [x] Phase 4: Teller Management
- [x] Phase 5: Barcode Scanner + Sale Flow
- [x] Phase 6: Stock Take
- [x] Phase 7: Offline Support
- [x] Phase 8: Stock Management
- [x] Phase 9: WhatsApp Summaries
- [x] Phase 10: Dashboard
- [x] Phase 11: Polish & Hardening
- [x] Phase 12: Testing & Deployment
- [x] Phase 13: QA Fixes & UX Improvements
- [x] Phase 14: Subscription & Payment (PayFast)
- [x] Phase 15a: Admin Dashboard — Role Infrastructure
- [x] Phase 15b: Admin Dashboard — Pages & API Routes
- [x] Phase 15c: Admin Dashboard — Subscription & Access Logic
- [x] Phase 15d: Admin Dashboard — Hardening & Polish
- [x] Phase 15e: Admin Dual-Role — Shop Access for Admins
- [x] Phase 16a: Shared Barcode Catalog — Database + Backend Foundation
- [x] Phase 16b: Shared Barcode Catalog — Scan Flow Integration
- [x] Phase 16c: Shared Barcode Catalog — Admin Management UI
- [x] Phase 16d: Shared Barcode Catalog — Pre-Live Database Seed
- [x] Phase 17a: Compliance — Onboarding + Shop Field Improvements
- [x] Phase 17b: Compliance — Product Expiry Date Tracking (Batch System)
- [x] Phase 17c: Compliance — Report PDF Download
- [x] Phase 17d: Compliance — WhatsApp Expiry Warning
- [x] Phase 18: Expiry Date UX — Make It Obvious & Plain English
- [x] Phase 18b: Multiple Expiry Dates on Product Creation + Product Name Uniqueness
- [x] Phase 19a: Expiry Management — Dedicated Expiry Page
- [x] Phase 19b: Expiry Management — Batch Consumption Tracking on Sales
- [x] Phase 20a: Performance — Singleton Client, Lazy Scanner, Theme Fix
- [x] Phase 20b: Offline Dedup Safety — Migration + API 409
- [x] Phase 20c: Offline Resilience — Cart, Product Cache, Sync Improvements
- [x] Phase 20d: Stock Warnings + Dashboard Streaming
- [x] Phase 21: UX Polish — Plain English & Non-Technical User Improvements
- [x] Phase 22: Smart Catalog Import + Top Sellers in Sale
- [x] Phase 23: Barcode Scan Buttons — Products & Stock Pages
- [x] Phase 24: Performance + Offline Hardening
- [x] UX Tweak: Floating "Start Sale" Button
- [x] Phase 25: Secure External API for Business Portal
- [x] Phase 26: In-App Daily Summary (Replace WhatsApp)
- [x] Phase 27a: i18n Infrastructure + Database + API
- [x] Phase 27b: Language Selection UI + Auth Page Translations
- [x] Phase 27c: Translate Core Pages (Sale + Dashboard + Stock + Summary)
- [x] Phase 27d: Translate Remaining Pages + RTL Foundation
- [x] Phase 27e: Polish, Offline Hardening, Tests
- [x] Phase 28: Profit Tracking (Opt-In Toggle)
- [x] Phase 29: Profit Tracking UX — Missing Cost Price Alerts
- [x] Phase 30a: Supplier Directory — Database + API + Pages
- [x] Phase 30b: Traceability — Link Suppliers to Products & Stock + Goods Received Log
- [ ] Phase 30c: Compliance PDF — Supplier Traceability Section

All phases 1–29 complete. See [ARCHIVE.md](ARCHIVE.md) for detailed phase summaries.

### Phase 28 — Profit Tracking (2026-04-15)
**What was built:** Opt-in `shops.profit_tracking_enabled` toggle. When on: `products.cost_price` becomes required on create/edit and `(unit_price - unit_cost) * qty` surfaces on TodaySummary (swap Tellers → Profit) and DailySummaryAlert modal. `sale_items.unit_cost` is snapshotted at sale time via `completeSale` so historical profit is immune to later cost edits. New migration `014_profit_tracking.sql`; new `tests/unit/profit.test.ts` (19 tests). All five locales (en/so/am/zu/ur) received profit/cost keys. Rule 8 (i18n Coverage) added to Workflow Orchestration Rules.

### Phase 29 — Profit Tracking UX: Missing Cost Price Alerts (2026-04-17)
**What was built:** When profit tracking is enabled and products are missing a cost price, amber alert banners now appear on the Stock page, Count Stock page, and Daily Summary modal — each linking to the Products page. The settings page missing-cost count now auto-refreshes via `visibilitychange` listener when the user returns from editing products. Stock API (`GET /api/stock`) and Daily Summary API (`GET /api/summary/daily`) extended with `profit_tracking_enabled` and `products_missing_cost` fields. All five locales (en/so/am/zu/ur) updated with `missing_cost_alert` and `missing_cost_btn` keys in both `stock.json` and `summary.json`. No new files or migrations. 272 tests pass, TypeScript clean.

### Phase 30a — Supplier Directory (2026-04-18)
**What was built:** Foundation for Supplier Records & Traceability. New `suppliers` table with RLS (`user_in_shop(shop_id)`), case-insensitive unique name per shop. New `/suppliers` section (list page, `new` add form, `[id]` edit/delete) accessible via an emerald "My Suppliers" card on the Settings page (not added to BottomNav — 6 items is already max for non-technical users). Full CRUD API at `/api/suppliers` and `/api/suppliers/[id]` using shared `getShopAuth` + `parseBody` patterns. New `suppliers` i18n namespace in all five locales (en/so/am/zu/ur) with ~30 keys. New TypeScript types `Supplier` + `CreateSupplierInput`, Zod `createSupplierSchema` + `updateSupplierSchema`. New migration `015_suppliers.sql`. 280 tests pass (8 new from suppliers namespace parity), TypeScript clean.

### Phase 30b — Traceability: Suppliers linked to Products + Goods Received Log (2026-04-18)
**What was built:** Migration `016_goods_received.sql` adds `products.supplier_id` (nullable FK with ON DELETE SET NULL) and a new `goods_received(id, shop_id, product_id, supplier_id, quantity, notes, received_by, received_at)` table — text-only audit trail, no invoice photos (decided against due to Supabase Storage/egress cost). Optional Supplier dropdown added to product create/edit forms. Stock → Add mode now shows a Supplier dropdown (pre-filled from the product's last supplier) and, on successful adjust, best-effort POSTs to `/api/goods-received` + PATCHes `products.supplier_id` if changed. New `src/lib/db/goods-received.ts` (`logGoodsReceived`, `listGoodsReceived` with product+supplier joins) and new API route `src/app/api/goods-received/route.ts` (GET list with filters, POST create). New Zod `createGoodsReceivedSchema`. i18n parity maintained: 4 new keys in `products.json` and 2 in `stock.json` across all 5 locales. 280 tests pass, TypeScript clean.

---

## Current File Tree

_Last updated: Phase 30b (2026-04-18)_

```
spaza shop/
├── ARCHIVE.md                     # Completed phase summaries (moved from CLAUDE.md)
├── CLAUDE.md
├── README.md
├── next-env.d.ts
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── vitest.config.ts
├── .env.local.example
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── offline.html                # Offline fallback page (self-contained)
│   ├── sw.js                       # Service worker (precache + cache strategies)
│   └── icons/
│       ├── icon.svg                # App icon
│       └── icon-maskable.svg       # Maskable variant
├── src/
│   ├── proxy.ts                    # Auth guard + role-based routing (Next.js 16 proxy convention)
│   ├── app/
│   │   ├── layout.tsx              # Root layout (PWA meta, viewport, viewportFit=cover)
│   │   ├── error.tsx               # Global error boundary
│   │   ├── not-found.tsx           # 404 page
│   │   ├── page.tsx                # Root redirect logic
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── auth/
│   │   │   └── callback/route.ts   # Supabase email confirmation handler
│   │   ├── (auth)/
│   │   │   ├── layout.tsx          # Auth layout — wraps auth pages in LanguageProvider
│   │   │   ├── login/page.tsx      # Owner + Teller login tabs (i18n + compact LanguagePicker)
│   │   │   └── onboarding/page.tsx # Language step → Account → shop setup (i18n throughout)
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # Authenticated shell (LanguageProvider + ToastProvider + BottomNav + DailySummaryAlert)
│   │   │   ├── error.tsx           # App-segment error boundary
│   │   │   ├── dashboard/page.tsx  # Streaming dashboard: Suspense-wrapped sections, instant shell
│   │   │   ├── dashboard/loading.tsx
│   │   │   ├── settings/page.tsx   # Owner settings: language picker, shop info, threshold, subscription, compliance PDF
│   │   │   ├── subscribe/page.tsx  # Subscription page: pricing, PayFast checkout
│   │   │   ├── sale/
│   │   │   │   ├── page.tsx        # Full sale flow: scan → cart → complete
│   │   │   │   └── complete/page.tsx
│   │   │   ├── expiry/
│   │   │   │   ├── page.tsx        # Dedicated expiry page: grouped by urgency, expandable batches
│   │   │   │   └── loading.tsx
│   │   │   ├── stock-take/
│   │   │   │   └── page.tsx        # Count products, enter real qty, save
│   │   │   ├── stock/
│   │   │   │   ├── page.tsx        # Stock overview: summary strip, search, All/Low/Expiring tabs
│   │   │   │   ├── loading.tsx
│   │   │   │   └── [id]/page.tsx   # Adjust stock form (Add/Remove mode, multi-expiry in add mode)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # Searchable product list (owner only)
│   │   │   │   ├── new/page.tsx    # Add product form (multi-expiry dates)
│   │   │   │   └── [id]/page.tsx   # Edit/delete product form
│   │   │   ├── tellers/
│   │   │   │   ├── page.tsx        # Teller list with remove
│   │   │   │   ├── loading.tsx
│   │   │   │   └── new/page.tsx    # Add teller form
│   │   │   ├── suppliers/
│   │   │   │   ├── page.tsx        # Supplier list (Phase 30a)
│   │   │   │   ├── new/page.tsx    # Add supplier form (name required, rest optional)
│   │   │   │   └── [id]/page.tsx   # Edit/delete supplier
│   │   │   └── admin/
│   │   │       ├── layout.tsx      # Admin layout (AdminNav + max-w-4xl)
│   │   │       ├── loading.tsx
│   │   │       ├── page.tsx        # Admin overview: stat cards
│   │   │       ├── shops/
│   │   │       │   ├── loading.tsx
│   │   │       │   ├── page.tsx    # Shop list: search, status filter, pagination
│   │   │       │   └── [id]/page.tsx # Shop detail: info, access toggle, notes, payments, subscription
│   │   │       └── catalog/
│   │   │           ├── loading.tsx
│   │   │           ├── page.tsx    # Catalog list: search, pagination
│   │   │           ├── new/page.tsx # Add catalog entry form
│   │   │           └── [id]/page.tsx # Edit/delete catalog entry
│   │   └── api/
│   │       ├── auth/
│   │       │   └── teller-login/route.ts
│   │       ├── onboarding/route.ts
│   │       ├── catalog/
│   │       │   └── importable/route.ts    # GET catalog items not yet in shop's products
│   │       ├── products/
│   │       │   ├── route.ts               # GET list (+ catalog fallback), POST create
│   │       │   ├── [id]/route.ts          # GET, PATCH, DELETE
│   │       │   ├── popular/route.ts       # GET top 10 product IDs by sales (last 30 days)
│   │       │   └── bulk-import/route.ts   # POST bulk-import from catalog (price required)
│   │       ├── sales/
│   │       │   └── route.ts               # POST — complete sale (uses decrement_stock_fefo)
│   │       ├── batches/
│   │       │   ├── route.ts               # GET list, POST add batch
│   │       │   └── [id]/route.ts          # DELETE — discard batch
│   │       ├── stock/
│   │       │   ├── route.ts               # GET list + expiry count, POST adjust qty
│   │       │   └── expiry/route.ts        # GET all products with expiry batches, grouped by urgency
│   │       ├── stock-take/
│   │       │   └── route.ts
│   │       ├── subscribe/
│   │       │   ├── checkout/route.ts
│   │       │   ├── notify/route.ts        # PayFast ITN webhook
│   │       │   └── status/route.ts
│   │       ├── cron/
│   │       │   └── expire-subscriptions/route.ts # 02:00 SAST — expire overdue trials/subs
│   │       ├── summary/
│   │       │   └── daily/route.ts         # GET daily summary (sales + low stock + expiring) for in-app alert
│   │       ├── admin/
│   │       │   ├── overview/route.ts
│   │       │   ├── catalog/
│   │       │   │   ├── route.ts           # GET list, POST create
│   │       │   │   └── [id]/route.ts      # GET, PATCH, DELETE
│   │       │   └── shops/
│   │       │       ├── route.ts           # GET paginated list
│   │       │       └── [id]/
│   │       │           ├── route.ts       # GET shop detail
│   │       │           ├── payments/route.ts
│   │       │           ├── access/route.ts
│   │       │           ├── notes/route.ts
│   │       │           └── subscription/route.ts
│   │       ├── external/
│   │       │   └── v1/
│   │       │       ├── overview/route.ts       # GET platform stats
│   │       │       └── shops/
│   │       │           ├── route.ts            # GET paginated shop list
│   │       │           └── [id]/
│   │       │               ├── route.ts        # GET shop detail
│   │       │               ├── sales/route.ts  # GET sales snapshot
│   │       │               ├── stock/route.ts  # GET products + stock levels
│   │       │               └── expiry/route.ts # GET expiring products
│   │       ├── reports/
│   │       │   └── compliance-pdf/route.ts
│   │       ├── settings/
│   │       │   └── route.ts               # GET + PATCH shop settings
│   │       ├── tellers/
│   │       │   ├── route.ts               # GET list, POST create
│   │       │   ├── me/route.ts
│   │       │   └── [id]/route.ts          # PATCH deactivate
│   │       ├── suppliers/
│   │       │   ├── route.ts               # GET list, POST create (Phase 30a)
│   │       │   └── [id]/route.ts          # GET, PATCH, DELETE
│   │       └── goods-received/
│   │           └── route.ts               # GET list (with filters), POST create (Phase 30b)
│   ├── components/
│   │   ├── products/
│   │   │   ├── CatalogImportSheet.tsx     # Bottom-sheet: search catalog, set prices, bulk import
│   │   │   └── BarcodeScanButton.tsx      # Scan barcode → find/add product (client component for server page)
│   │   ├── sale/
│   │   │   ├── TellerSelector.tsx
│   │   │   ├── CartItem.tsx               # Stock warning badges (threshold prop)
│   │   │   ├── CartSummary.tsx            # Sticky total + Complete Sale (aboveNav, oversell warning)
│   │   │   ├── NewProductModal.tsx        # Quick-create (multi-expiry, smart duplicate handling)
│   │   │   └── ProductPicker.tsx          # Manual product picker (bottom-sheet search)
│   │   ├── scanner/
│   │   │   ├── BarcodeScanner.tsx
│   │   │   └── ScannerOverlay.tsx
│   │   ├── admin/
│   │   │   └── AdminNav.tsx               # Overview | Shops | Catalog + sign out
│   │   ├── dashboard/
│   │   │   ├── WeeklySalesChart.tsx        # recharts bar chart (client component)
│   │   │   ├── TodaySummary.tsx           # Async server — today's revenue/sales/tellers
│   │   │   ├── LowStockAlert.tsx          # Async server — low/out-of-stock alert
│   │   │   ├── ExpiringAlert.tsx          # Async server — expiring products alert
│   │   │   ├── WeeklyChartSection.tsx     # Async server — wraps WeeklySalesChart
│   │   │   ├── TopProducts.tsx            # Async server — top products this week
│   │   │   └── LatestSales.tsx            # Async server — recent sales + empty state
│   │   ├── LanguagePicker.tsx               # Language selection (full + compact variants)
│   │   ├── ExpiryEntryList.tsx             # Repeatable expiry date + qty rows (shared)
│   │   ├── BottomNav.tsx                   # Owner nav (5 tabs + Admin for dual-role)
│   │   ├── ConfirmModal.tsx
│   │   ├── Skeleton.tsx
│   │   ├── Toast.tsx                       # Toast system + ToastProvider
│   │   ├── OfflineBanner.tsx
│   │   ├── OfflineSyncProvider.tsx
│   │   ├── ServiceWorkerRegistrar.tsx
│   │   ├── DailySummaryAlert.tsx          # In-app daily summary (9pm SAST banner + modal)
│   │   └── LanguageProvider.tsx           # i18n React Context + useTranslation() hook
│   ├── hooks/
│   │   ├── useActiveTeller.ts
│   │   ├── useCart.ts
│   │   ├── useScanner.ts
│   │   ├── useOnlineStatus.ts
│   │   └── useOfflineSync.ts
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                  # Browser client
│   │   │   ├── server.ts                  # Server client (with cookies)
│   │   │   └── admin.ts                   # Service role client
│   │   ├── auth/
│   │   │   ├── teller.ts                  # Synthetic email + provisioning + subscription sync
│   │   │   ├── admin-guard.ts             # requireAdmin()
│   │   │   ├── shop-auth.ts              # getShopAuth() — shared user + shopId extraction
│   │   │   └── external-api-guard.ts     # requireExternalApi() — Bearer token + rate limit
│   │   ├── payfast/
│   │   │   └── index.ts                   # Signature, checkout, ITN validation
│   │   ├── db/
│   │   │   ├── products.ts
│   │   │   ├── sales.ts                   # completeSale (uses decrement_stock_fefo)
│   │   │   ├── stock-take.ts
│   │   │   ├── stock.ts
│   │   │   ├── reports.ts                 # Daily sales, low stock, weekly, top products, expiring alerts
│   │   │   ├── admin.ts                   # Admin: overview, shops, payments, access, notes, subscription
│   │   │   ├── catalog.ts                 # Barcode catalog CRUD
│   │   │   ├── batches.ts                 # Product batch CRUD + expiry stats
│   │   │   ├── suppliers.ts               # Supplier CRUD (Phase 30a)
│   │   │   ├── goods-received.ts          # Goods received log + list with joins (Phase 30b)
│   │   │   └── compliance-report.ts       # Compliance PDF data fetcher
│   │   ├── offline/
│   │   │   ├── db.ts                      # IndexedDB via idb
│   │   │   └── sync.ts                    # syncPendingSales
│   │   ├── i18n/
│   │   │   ├── types.ts                   # SupportedLocale, LOCALE_META, TranslationNamespace
│   │   │   ├── interpolate.ts             # t(), tPlural() — string interpolation helpers
│   │   │   ├── loader.ts                  # loadTranslation(), loadTranslations() — dynamic import + cache
│   │   │   ├── server.ts                  # getServerLocale(), getServerTranslations() — for server components
│   │   │   └── translations/
│   │   │       ├── en/                    # English namespace files (11 JSON files)
│   │   │       │   ├── common.json, auth.json, sale.json, dashboard.json, settings.json
│   │   │       │   └── stock.json, products.json, tellers.json, expiry.json, summary.json, suppliers.json
│   │   │       ├── so/                    # Somali  (11 namespaces — adds suppliers in Phase 30a)
│   │   │       ├── am/                    # Amharic (11 namespaces — adds suppliers in Phase 30a)
│   │   │       ├── zu/                    # IsiZulu (11 namespaces — adds suppliers in Phase 30a)
│   │   │       └── ur/                    # Urdu    (11 namespaces — adds suppliers in Phase 30a)
│   │   ├── validation/
│   │   │   └── schemas.ts                 # All Zod schemas
│   │   └── utils/
│   │       ├── api.ts                    # parseBody() — shared JSON parse + Zod validation
│   │       ├── currency.ts
│   │       ├── date.ts
│   │       ├── rateLimit.ts
│   │       └── statusBadge.ts
│   └── types/
│       └── index.ts
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_decrement_stock.sql
│       ├── 003_stock_adjustments.sql
│       ├── 004_optional_barcode.sql
│       ├── 005_subscriptions.sql
│       ├── 006_admin_dashboard.sql
│       ├── 007_barcode_catalog.sql
│       ├── 008_shop_fields.sql
│       ├── 009_product_batches.sql
│       ├── 010_product_name_unique.sql
│       ├── 011_sale_batch_consumptions.sql
│       ├── 012_offline_id_unique.sql
│       ├── 013_shop_language.sql
│       ├── 014_profit_tracking.sql    # Phase 28 — profit tracking toggle + cost columns
│       ├── 015_suppliers.sql           # Phase 30a — suppliers table + RLS
│       └── 016_goods_received.sql      # Phase 30b — products.supplier_id + goods_received table + RLS
├── data/
│   └── sa-products.csv                    # 100 SA products with EAN-13 barcodes
├── scripts/
│   ├── set-admin.ts                       # Promote user to admin
│   └── seed-catalog.ts                    # Seed barcode_catalog from CSV
├── tasks/
│   ├── todo.md                            # Current/next phase only
│   ├── todo-archive.md                    # Completed phase tasks (moved from todo.md)
│   ├── lessons.md
│   └── bugs.md                            # Bug tracker — read at session start
└── tests/
    └── unit/
        ├── currency.test.ts               # 16 tests
        ├── validation.test.ts             # 48 tests
        ├── date.test.ts                   # 17 tests
        ├── rate-limit.test.ts             # 7 tests
        ├── security.test.ts              # 14 tests
        ├── payfast.test.ts               # 12 tests
        ├── admin.test.ts                 # 28 tests
        ├── batches.test.ts              # 14 tests
        ├── i18n.test.ts                  # 97 tests — t(), tPlural(), key completeness + placeholder preservation
        └── profit.test.ts                # 19 tests — computeProfit() + cost_price/profit_tracking_enabled schema
```
