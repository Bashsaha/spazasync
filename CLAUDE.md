# SpazaSync — CLAUDE.md

## What this project is

SpazaSync is a mobile-first PWA for South African spaza shop and small retail owners. These owners currently calculate sales on a basic calculator and manage stock manually or not at all. SpazaSync replaces that entire workflow with a smartphone app that requires no technical skill.

**Core flow:** owner opens the app on their Android phone → scans a product barcode using their phone camera → product added to the sale → stock automatically deducted when the sale is completed → owner receives a daily WhatsApp summary of sales and stock levels.

**Target user:** someone with no technical background. Plain English. No jargon. Obvious UI. Works on a mid-range Android smartphone, no laptop or external hardware needed.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict mode |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL, RLS, Supabase Auth) |
| Messaging | Twilio WhatsApp Business API |
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
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold, subscription_status, trial_ends_at, subscription_ends_at, payfast_token, access_granted, admin_notes, created_at
- `shop_users` — maps auth users to shops with role (owner | teller)
- `tellers` — named teller entries; optional link to auth user_id; name unique per shop
- `products` — barcode (nullable), name, price, stock_qty; unique(shop_id, barcode) where barcode IS NOT NULL
- `sales` — total, teller_id, completed_at, offline_id for dedup, synced_at
- `sale_items` — product_id, quantity, unit_price, subtotal
- `stock_take_entries` — product_id, qty_before, qty_after, teller_id, taken_at
- `stock_adjustments` — product_id, qty_before, qty_after, delta, reason, adjusted_by, adjusted_at
- `admin_payments` — shop_id, amount, method (eft/cash/card/other), reference, notes, recorded_by, recorded_at (no RLS — admin client only)
- `barcode_catalog` — barcode (unique), name, category; RLS SELECT for all, writes via admin client only (Phase 16a)

### RLS helpers
- `user_in_shop(shop_id)` — SECURITY DEFINER function
- `user_is_owner(shop_id)` — SECURITY DEFINER function

### SQL functions
- `decrement_stock(p_product_id, p_qty)` — atomically decrement stock, clamp to 0

All shop-scoped tables have RLS enabled. `admin_payments` has no RLS (accessed only via service role client).

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
CRON_SECRET=
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
PAYFAST_SANDBOX=true
SUBSCRIPTION_PRICE_ZAR=349.99
NEXT_PUBLIC_APP_URL=
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
6. **Commit to GitHub** — stage all new/modified files, commit with message `feat: Phase N — <short description>`, push to `main`
7. **Output a completion confirmation** to the user listing each step done. Example: "Phase completion checklist: Glob scanned, file tree updated (added X files), Living Scope checked off, commit abc1234 pushed." This proves the protocol was followed.
8. Only then mark the todo item as complete
9. **STOP.** Do not start the next phase. Wait for user to say go.

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
- [ ] Phase 17c: Compliance — Report PDF Download
- [x] Phase 17d: Compliance — WhatsApp Expiry Warning

**Phase 17 context:** South Africa mandated spaza shop compliance (R638). Inspectors check registration, stock records, and expiry date monitoring. Phase 17 adds: (a) registration number + location fields + auto-generated shop codes, (b) per-batch expiry date tracking with FEFO deduction during sales, (c) one-button PDF compliance report (shop info, current inventory, expiry register, 30-day stock movement), (d) expiry warning line in existing daily WhatsApp summary. Implementation order: 17a → 17b → 17d → 17c. Full plan at `.claude/plans/fluffy-orbiting-sonnet.md`.

### Phase 1: Project Bootstrap — COMPLETE
What was built:
- Next.js 14 project scaffolded (TypeScript, Tailwind, App Router, src/ dir)
- All runtime and dev dependencies installed
- Configuration files: next.config.ts, tailwind.config.ts, postcss.config.mjs, tsconfig.json, vitest.config.ts, vercel.json
- Environment template: .env.local.example
- Database migration: supabase/migrations/001_initial_schema.sql
- Core types: src/types/index.ts
- Utility helpers: src/lib/utils/currency.ts, src/lib/utils/date.ts
- First unit test: tests/unit/currency.test.ts
- Task tracking: tasks/todo.md, tasks/lessons.md

### Phase 2: Auth, Roles & Onboarding — COMPLETE
What was built:
- src/lib/supabase/client.ts — browser Supabase client (createBrowserClient)
- src/lib/supabase/server.ts — server Supabase client with cookie handling
- src/lib/supabase/admin.ts — service role admin client (bypasses RLS)
- src/lib/auth/teller.ts — nameToSlug, buildTellerEmail, provisionTellerAccount, setOwnerMetadata
- src/lib/validation/schemas.ts — all Zod schemas for every phase
- src/middleware.ts — auth guard + role-based routing (teller→/sale, no role→/onboarding)
- src/app/page.tsx — root redirect (login/onboarding/dashboard/sale)
- src/app/layout.tsx — minimal root layout (PWA metadata, viewport, theme colour)
- src/app/(auth)/login/page.tsx — two-tab login: Owner (email+password) / Teller (code+name+password)
- src/app/(auth)/onboarding/page.tsx — two-step: create account → setup shop
- src/app/(app)/layout.tsx — authenticated app shell
- src/app/(app)/dashboard/page.tsx — dashboard with nav cards (placeholder for Phase 10)
- src/app/(app)/sale/page.tsx — sale page placeholder (full impl Phase 5)
- src/app/api/auth/teller-login/route.ts — validates shop+teller, returns synthetic email
- src/app/api/onboarding/route.ts — creates shop, shop_users, tellers, sets app_metadata

### Phase 3: Product Catalogue — COMPLETE
What was built:
- src/lib/db/products.ts — listProducts, getProduct, getProductByBarcode, createProduct, updateProduct, deleteProduct
- src/app/api/products/route.ts — GET (list + barcode/search filter), POST (create)
- src/app/api/products/[id]/route.ts — GET (by id), PATCH (update), DELETE
- src/app/(app)/products/page.tsx — searchable product list (Server Component, owner only)
- src/app/(app)/products/new/page.tsx — add product form (Client Component)
- src/app/(app)/products/[id]/page.tsx — edit/delete product form (Client Component)
- Note: running on Next.js 16 / React 19 — params and searchParams are Promises (awaited throughout)

### Phase 4: Teller Management — COMPLETE
What was built:
- src/lib/db/tellers.ts — listTellers, getMyTellerRecord, deactivateTeller
- src/app/api/tellers/route.ts — GET list, POST create (provisions auth + teller row + shop_users)
- src/app/api/tellers/me/route.ts — GET own teller record (used by useActiveTeller hook)
- src/app/api/tellers/[id]/route.ts — PATCH deactivate
- src/app/(app)/tellers/page.tsx — teller list with remove (Client Component)
- src/app/(app)/tellers/new/page.tsx — add teller form (name + password)
- src/components/sale/TellerSelector.tsx — teller picker shown to owners on sale page
- src/hooks/useActiveTeller.ts — owner: sessionStorage; teller: auto from /api/tellers/me
- src/app/(app)/sale/page.tsx — updated: owner sees TellerSelector, teller auto-selected

### Phase 5: Barcode Scanner + Sale Flow — COMPLETE
What was built:
- supabase/migrations/002_decrement_stock.sql — decrement_stock(p_product_id, p_qty) SQL function
- src/hooks/useCart.ts — addItem, removeItem, updateQty, clearCart with subtotal tracking
- src/hooks/useScanner.ts — wraps @zxing/browser; starts/stops camera; fires onScan once per open
- src/components/scanner/BarcodeScanner.tsx — full-screen camera overlay; closes after first scan
- src/components/scanner/ScannerOverlay.tsx — targeting reticle with corner markers
- src/components/sale/CartItem.tsx — qty +/− controls, remove on decrement to 0
- src/components/sale/CartSummary.tsx — sticky bottom bar with total + Complete Sale button
- src/components/sale/NewProductModal.tsx — bottom-sheet quick-create for unknown barcodes
- src/lib/db/sales.ts — completeSale: insert sale + items, decrement stock via RPC
- src/app/api/sales/route.ts — POST /api/sales with Zod validation
- src/app/(app)/sale/page.tsx — full implementation: scan → cart → complete flow
- src/app/(app)/sale/complete/page.tsx — sale confirmation screen with New Sale button

### Phase 6: Stock Take — COMPLETE
What was built:
- src/lib/db/stock-take.ts — saveStockTake: batch-fetch qty_before, batch-insert audit rows, update stock_qty per product
- src/app/api/stock-take/route.ts — POST /api/stock-take with Zod validation
- src/app/(app)/stock-take/page.tsx — owner counts each product, enters real qty; changed rows highlighted in orange; sticky Save button shows count; success screen after submit

### Phase 8: Stock Management — COMPLETE
What was built:
- supabase/migrations/003_stock_adjustments.sql — stock_adjustments audit table with RLS
- src/lib/db/stock.ts — listProductsWithStock (low_stock flag, sorted by qty ASC), adjustStock (clamp to 0, audit trail)
- src/app/api/stock/route.ts — GET /api/stock (list with threshold), POST /api/stock (adjust qty)
- src/types/index.ts — StockAdjustment + StockAdjustInput types added
- src/app/(app)/stock/page.tsx — owner stock overview: summary strip (total/low/out), search, All/Low tabs, product list with colour-coded qty badges
- src/app/(app)/stock/[id]/page.tsx — adjust stock form: Add/Remove mode toggle, quick amounts (+10/24/48/100), projected qty preview, reason dropdown, clamping warning
- Fixed pre-existing formatCurrency → formatZAR in CartItem.tsx, CartSummary.tsx, sale/complete/page.tsx

### Phase 9: WhatsApp Summaries — COMPLETE
What was built:
- src/lib/whatsapp/client.ts — Twilio client factory + sendWhatsApp(to, body)
- src/lib/whatsapp/format.ts — formatDailySummary: pure function, generates plain-text WhatsApp message
- src/lib/db/reports.ts — getDailySalesForShop + getLowStockForShop (admin client, explicit shop_id filtering)
- src/app/api/cron/daily-summary/route.ts — GET cron handler; fires 20:00 UTC (22:00 SAST); iterates all shops with WhatsApp numbers; per-shop errors isolated
- src/types/index.ts — DailySummaryData + LowStockItem types added
- src/app/(app)/dashboard/page.tsx — today's revenue/sales/tellers strip + low-stock alert widget (server component, no extra API route)
- vercel.json — single cron entry at 0 20 * * * (removed separate low-stock cron)
- tests/unit/whatsapp-format.test.ts — 9 tests for message formatter
- src/lib/utils/date.ts — fixed cron time comment (20:00 UTC = 22:00 SAST)

### Phase 10: Dashboard — COMPLETE
What was built:
- recharts v3 installed
- src/types/index.ts — WeeklyDataPoint + RecentSale + TopProduct types added
- src/lib/db/reports.ts — extended with getWeeklySalesForShop, getRecentSalesForShop, getTopProductsThisWeek
- src/lib/validation/schemas.ts — updateShopSettingsSchema added
- src/components/dashboard/WeeklySalesChart.tsx — client component; bar chart of last 7 days' revenue
- src/app/api/settings/route.ts — GET + PATCH shop settings (owner-only, admin client with ownership check)
- src/app/(app)/settings/page.tsx — settings form: shop name, WhatsApp number, low-stock threshold
- src/app/(app)/dashboard/page.tsx — full dashboard: today summary, low-stock alert, weekly chart, top products this week, latest sales list, settings nav card; all plain English labels

### Phase 7: Offline Support — COMPLETE
What was built:
- src/lib/offline/db.ts — IndexedDB via `idb`: enqueueSale, listPendingSales, removePendingSale, countPendingSales
- src/lib/offline/sync.ts — syncPendingSales: retry each queued sale via POST /api/sales; removes on 201 or 409 (dedup)
- src/hooks/useOnlineStatus.ts — tracks navigator.onLine with online/offline events
- src/hooks/useOfflineSync.ts — auto-syncs on reconnect; listens for visibilitychange + custom 'offlinequeue' event
- src/components/OfflineBanner.tsx — top banner: amber=offline, blue=syncing; hidden when online with no pending
- src/components/OfflineSyncProvider.tsx — client wrapper inserted into (app)/layout; owns sync state
- src/components/ServiceWorkerRegistrar.tsx — registers /sw.js from root layout (client component)
- public/manifest.json — PWA manifest (name, icons, start_url=/sale, standalone)
- public/sw.js — service worker: cache-first for /_next/static/, stale-while-revalidate for /api/products, network-first for pages
- public/icons/icon.svg + icon-maskable.svg — SVG app icons
- Updated src/app/layout.tsx — adds ServiceWorkerRegistrar
- Updated src/app/(app)/layout.tsx — wraps children in OfflineSyncProvider
- Updated src/app/(app)/sale/page.tsx — offline path: queue to IndexedDB, dispatch 'offlinequeue' event, redirect with &offline=1
- Updated src/app/(app)/sale/complete/page.tsx — shows "Sale Saved" + offline explanation when ?offline=1

### Phase 11: Polish & Hardening — COMPLETE
What was built:
- src/app/error.tsx — global React error boundary (wraps html/body; "Try again" button with autoFocus)
- src/app/not-found.tsx — 404 page with link back to Dashboard
- src/app/(app)/error.tsx — app-segment error boundary (inherits app layout context)
- src/components/Skeleton.tsx — shared animated skeleton primitive used across loading states
- src/app/(app)/dashboard/loading.tsx — skeleton loader for dashboard (streamed by Next.js)
- src/app/(app)/tellers/loading.tsx — skeleton loader for tellers list
- src/app/(app)/stock/loading.tsx — skeleton loader for stock overview
- src/lib/utils/rateLimit.ts — in-memory rate limiter (10/60s on teller-login; 3/60s on onboarding)
- src/components/ConfirmModal.tsx — bottom-sheet confirm dialog; replaces browser confirm()/alert()
- src/components/Toast.tsx — toast notification system with ToastProvider context + auto-dismiss
- src/hooks/useToast.ts — standalone toast hook (ToastProvider is the primary integration point)
- src/components/BottomNav.tsx — 5-tab owner bottom navigation; tellers excluded; active tab highlighted
- Updated src/app/(app)/layout.tsx — adds ToastProvider + BottomNav; passes role from JWT
- Updated src/app/(app)/tellers/page.tsx — ConfirmModal replaces confirm()/alert(); Skeleton inline loader
- Updated src/components/sale/CartSummary.tsx — fixed pb-safe-bottom → env(safe-area-inset-bottom)
- Updated src/app/layout.tsx — added viewportFit: 'cover' to viewport export
- Updated src/app/(app)/stock/page.tsx — added aria-label to search input
- Updated src/app/(app)/stock-take/page.tsx — added aria-label={`Count for ${p.name}`} to count inputs
- Updated src/app/api/auth/teller-login/route.ts — rate limiter applied
- Updated src/app/api/onboarding/route.ts — rate limiter applied
- Updated vercel.json — security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- 0 TypeScript errors, 25/25 tests passing

### Phase 12: Testing & Deployment — COMPLETE
What was built:
- Fixed security gap: `/api/sales` and `/api/stock-take` were missing auth checks — both now validate session via `supabase.auth.getUser()` before processing
- Added `Content-Security-Policy` header to vercel.json (all existing headers retained)
- tests/unit/validation.test.ts — 49 tests covering all 10 Zod schemas (happy + rejection paths)
- tests/unit/date.test.ts — 17 tests for SAST timezone helpers (formatSAST, startOfTodaySAST, isToday, etc.)
- tests/unit/rate-limit.test.ts — 7 tests for in-memory rate limiter (window reset, per-IP tracking, fake timers)
- tests/unit/security.test.ts — 15 tests verifying schemas reject injection strings, malformed UUIDs, type coercions
- README.md — full deployment guide: setup, env vars, Supabase migrations, Vercel deploy, security checklist
- 0 TypeScript errors, 113/113 tests passing, production build successful
- BUG-001: `/onboarding` added to PUBLIC_ROUTES — "Create your shop" was bouncing to login
- BUG-002: Created `src/app/auth/callback/route.ts` — Supabase email confirmation caused localhost 404
- BUG-003: Added `email-sent` step to onboarding state machine — email confirmation now shows on-page screen
- tasks/bugs.md — new bug tracker; CLAUDE.md updated to mandate reading it at session start

### Phase 13: QA Fixes & UX Improvements — COMPLETE
What was built:
- src/proxy.ts — replaces src/middleware.ts (Next.js 16 renamed middleware convention to proxy); added onboarding guard for users without roles
- next.config.ts — added turbopack.root to fix workspace root inference
- src/app/globals.css — removed dark mode CSS that caused invisible input text
- src/hooks/useOnlineStatus.ts — fixed hydration mismatch (initialize as true, read navigator.onLine in useEffect)
- Color scheme: changed all orange Tailwind classes to royal blue across 25+ files; theme-color #f97316 → #2563eb
- src/components/sale/ProductPicker.tsx — new manual product picker (bottom-sheet with debounced search)
- src/app/(app)/sale/page.tsx — added "Add Manually" button alongside "Scan"; integrates ProductPicker
- Product barcode now optional: src/types/index.ts (barcode: string | null), src/lib/validation/schemas.ts, src/lib/db/products.ts, product forms updated
- supabase/migrations/004_optional_barcode.sql — ALTER barcode DROP NOT NULL; partial unique index on (shop_id, barcode) WHERE barcode IS NOT NULL
- BUG-004 through BUG-010 logged in tasks/bugs.md
- Deleted src/middleware.ts (replaced by proxy.ts)

### Phase 14: Subscription & Payment (PayFast) — COMPLETE
What was built:
- supabase/migrations/005_subscriptions.sql — ALTER shops: add subscription_status, trial_ends_at, subscription_ends_at, payfast_token
- src/lib/payfast/index.ts — PayFast helpers: generateSignature, buildCheckoutParams, validateITN, isPayFastIP
- src/app/api/subscribe/checkout/route.ts — POST: generates PayFast checkout params for form POST redirect
- src/app/api/subscribe/notify/route.ts — POST: PayFast ITN webhook (validates signature + IP, updates subscription status, syncs all shop users' JWT metadata)
- src/app/api/subscribe/status/route.ts — GET: returns subscription status + days remaining
- src/app/(app)/subscribe/page.tsx — Subscribe page UI: pricing card (R349.99/month), PayFast checkout, success/cancel states
- src/app/api/cron/expire-subscriptions/route.ts — Daily cron (02:00 SAST): expires overdue trials and cancelled subscriptions
- Updated src/proxy.ts — subscription gate: redirects expired shops to /subscribe; /api/subscribe/notify added to PUBLIC_ROUTES
- Updated src/app/api/onboarding/route.ts — auto-grants 7-day trial (subscription_status='trialing', trial_ends_at) on shop creation
- Updated src/lib/auth/teller.ts — tellers inherit shop's sub_status; added updateShopUsersSubscription helper
- Updated src/types/index.ts — SubscriptionStatus type, SubscriptionInfo interface, extended Shop interface
- Updated src/app/(app)/settings/page.tsx — subscription status card (badge + days remaining + link to /subscribe)
- Updated src/app/api/settings/route.ts — includes subscription columns in GET select
- Updated src/app/(app)/dashboard/page.tsx — trial/subscription expiry warning banner (< 3 days remaining)
- Updated vercel.json — expire-subscriptions cron, PayFast in CSP connect-src + form-action
- Updated .env.local.example — PayFast env vars (PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX, SUBSCRIPTION_PRICE_ZAR, NEXT_PUBLIC_APP_URL)
- tests/unit/payfast.test.ts — 12 tests: signature generation, checkout params, IP validation, expiry logic
- Fixed pre-existing TS errors: barcode null safety in sale/page.tsx and stock/page.tsx
- Fixed pre-existing test: validation.test.ts barcode test updated for optional barcode (Phase 13)
- 0 TypeScript errors, 125/125 tests passing

### Phase 15a: Admin Dashboard — Role Infrastructure — COMPLETE
What was built:
- supabase/migrations/006_admin_dashboard.sql — ALTER shops: add access_granted, admin_notes; expand subscription_status CHECK to include 'manual_override'; CREATE TABLE admin_payments
- scripts/set-admin.ts — CLI script to promote any user to admin role (npx tsx scripts/set-admin.ts user@example.com)
- src/lib/auth/admin-guard.ts — requireAdmin() helper for server-side admin verification in API routes
- Updated src/types/index.ts — 'admin' added to UserRole; 'manual_override' added to SubscriptionStatus; access_granted + admin_notes added to Shop; AdminPayment, AdminShopListItem, AdminOverviewStats interfaces
- Updated src/proxy.ts — ADMIN_ROUTES block (non-admins redirected away from /admin/*); admin users skip subscription gate; authenticated admins redirect to /admin from public routes; access_granted check added to subscription gate
- Updated src/lib/auth/teller.ts — updateShopUsersSubscription now syncs access_granted to JWT metadata
- Updated src/lib/validation/schemas.ts — adminManualPaymentSchema, adminToggleAccessSchema, adminUpdateNotesSchema, adminStoreListQuerySchema
- Updated src/components/BottomNav.tsx — returns null for admin role
- 0 TypeScript errors, 125/125 tests passing

### Phase 15b: Admin Dashboard — Pages & API Routes — COMPLETE
What was built:
- src/lib/db/admin.ts — 6 admin DB helpers: getOverviewStats, listShops, getShopDetail, recordManualPayment, toggleShopAccess, updateShopNotes
- src/components/admin/AdminNav.tsx — client component: top nav (Overview | Shops), active link highlighting, sign-out
- src/app/api/admin/overview/route.ts — GET: aggregate stats (total/active/trialing/expired/manual/recent signups)
- src/app/api/admin/shops/route.ts — GET: paginated shop list with search and status filter
- src/app/api/admin/shops/[id]/route.ts — GET: full shop detail (owner email, payments, counts)
- src/app/api/admin/shops/[id]/payments/route.ts — POST: record manual payment, optionally activate subscription
- src/app/api/admin/shops/[id]/access/route.ts — PATCH: toggle access_granted, sync JWT metadata
- src/app/api/admin/shops/[id]/notes/route.ts — PATCH: update admin notes
- src/app/(app)/admin/layout.tsx — admin layout with AdminNav + wider max-w-4xl
- src/app/(app)/admin/page.tsx — server component: overview dashboard with 6 stat cards
- src/app/(app)/admin/shops/page.tsx — client component: shop list with search, status filter, pagination
- src/app/(app)/admin/shops/[id]/page.tsx — client component: shop detail with access toggle, admin notes, payment recording, payment history
- src/app/(app)/admin/loading.tsx + shops/loading.tsx — skeleton loaders
- Fixed pre-existing issue: installed missing dotenv dev dependency for scripts/set-admin.ts
- 0 TypeScript errors, 125/125 tests passing

### Phase 15c: Admin Dashboard — Subscription & Access Logic — COMPLETE
What was built:
- src/lib/validation/schemas.ts — added adminUpdateSubscriptionSchema (status + optional end dates)
- src/lib/db/admin.ts — added updateShopSubscription(): updates status + dates, syncs JWT metadata, auto-revokes access on expire
- src/app/api/admin/shops/[id]/subscription/route.ts — NEW: PATCH endpoint for admin to directly change subscription status and end dates
- src/app/api/cron/expire-subscriptions/route.ts — FIXED: now also expires manual_override shops when subscription_ends_at passes; sets access_granted=false on expiry
- src/app/(app)/admin/shops/[id]/page.tsx — UPDATED: subscription management UI with status dropdown, end date picker, and "Update Subscription" button
- 0 TypeScript errors, 125/125 tests passing

### Phase 15d: Admin Dashboard — Hardening & Polish — COMPLETE
What was built:
- src/lib/db/admin.ts — FIXED: listShops() replaced bulk listUsers (1000 cap) with per-owner getUserById via Promise.allSettled; added shopExists() helper
- src/lib/utils/statusBadge.ts — NEW: shared subscription status badge color map (extracted from 2 pages)
- src/app/api/admin/shops/[id]/access/route.ts — UPDATED: added shop existence check (404) + rate limiting (30/60s)
- src/app/api/admin/shops/[id]/notes/route.ts — UPDATED: added shop existence check (404) + rate limiting (30/60s)
- src/app/api/admin/shops/[id]/subscription/route.ts — UPDATED: added shop existence check (404) + rate limiting (30/60s)
- src/app/api/admin/shops/[id]/payments/route.ts — UPDATED: added shop existence check (404) + rate limiting (30/60s)
- src/app/(app)/admin/shops/page.tsx — UPDATED: uses shared statusBadge; error state with Retry button (replaces infinite spinner)
- src/app/(app)/admin/shops/[id]/page.tsx — UPDATED: ConfirmModal before access revocation; Toast feedback on all actions; notes char counter (2000 max); uses shared statusBadge; removed inline "Saved" state in favor of toasts
- src/components/admin/AdminNav.tsx — UPDATED: sign-out error handling with toast feedback
- tests/unit/admin.test.ts — NEW: 28 tests covering statusBadgeColors, all 5 admin Zod schemas
- 0 TypeScript errors, 153/153 tests passing

### Phase 15e: Admin Dual-Role — Shop Access for Admins — COMPLETE
What was built:
- scripts/set-admin.ts — UPDATED: explicit metadata merge preserves shop_id on promotion; logs dual-role vs admin-only status
- src/components/BottomNav.tsx — UPDATED: accepts hasShop prop; dual-role admins see 5 owner tabs + Admin tab
- src/app/(app)/layout.tsx — UPDATED: reads shop_id from metadata, passes hasShop to BottomNav
- src/components/admin/AdminNav.tsx — UPDATED: accepts hasShop prop; shows "My Shop" link to /dashboard
- src/app/(app)/admin/layout.tsx — UPDATED: async server component, reads user session, passes hasShop to AdminNav
- src/proxy.ts — UPDATED: clarifying comment for dual-role admin access (no functional change)
- CLAUDE.md Access Matrix updated to reflect admin dual-role access
- 0 TypeScript errors, 153/153 tests passing

### Phase 16a: Shared Barcode Catalog — Database + Backend Foundation — COMPLETE
What was built:
- supabase/migrations/007_barcode_catalog.sql — NEW: barcode_catalog table (barcode, name, category), RLS SELECT for all, no write policies (admin-only via service role)
- src/types/index.ts — UPDATED: added BarcodeCatalogEntry interface
- src/lib/validation/schemas.ts — UPDATED: added adminCatalogEntrySchema + adminCatalogSearchSchema
- src/lib/db/catalog.ts — NEW: getCatalogEntry (user client), listCatalogEntries, createCatalogEntry, updateCatalogEntry, deleteCatalogEntry (admin client)
- 0 TypeScript errors, 153/153 tests passing

### Phase 16b: Shared Barcode Catalog — Scan Flow Integration — COMPLETE
What was built:
- src/app/api/products/route.ts — UPDATED: GET with ?barcode= now falls back to barcode_catalog if shop product not found; response shape changed from Product[] to { products: Product[], catalog_suggestion?: { barcode, name } }
- src/app/(app)/sale/page.tsx — UPDATED: handleScan parses new response shape, passes catalogSuggestion to NewProductModal
- src/components/sale/NewProductModal.tsx — UPDATED: accepts suggestedName prop, pre-fills name field, shows hint text when catalog matched
- src/components/sale/ProductPicker.tsx — UPDATED: handles new response shape (json.products ?? json)
- src/app/(app)/stock-take/page.tsx — UPDATED: handles new response shape (data.products ?? data)
- CLAUDE.md Admin section updated to reflect dual-role (Phase 15e); file tree header fixed
- 0 TypeScript errors, 153/153 tests passing

### Phase 16c: Shared Barcode Catalog — Admin Management UI — COMPLETE
What was built:
- src/lib/db/catalog.ts — UPDATED: added getCatalogEntryById() for admin single-entry lookup
- src/components/admin/AdminNav.tsx — UPDATED: added "Catalog" nav link
- src/app/api/admin/catalog/route.ts — NEW: GET (list with search/pagination) + POST (create, 409 on duplicate barcode)
- src/app/api/admin/catalog/[id]/route.ts — NEW: GET (single entry), PATCH (update name/category), DELETE
- src/app/(app)/admin/catalog/page.tsx — NEW: catalog list with search, pagination, "Add Entry" button
- src/app/(app)/admin/catalog/new/page.tsx — NEW: add entry form (barcode, name, category)
- src/app/(app)/admin/catalog/[id]/page.tsx — NEW: edit/delete entry (barcode read-only, ConfirmModal on delete)
- src/app/(app)/admin/catalog/loading.tsx — NEW: skeleton loader
- All mutation API routes use requireAdmin() + checkRateLimit(30/60s) + schema validation
- Shops cannot write to the catalog — admin-only via service role client
- 0 TypeScript errors, 153/153 tests passing, production build succeeds

### Phase 16d: Shared Barcode Catalog — Pre-Live Database Seed — COMPLETE
What was built:
- data/sa-products.csv — 100 common South African products with real EAN-13 barcodes (600/601 prefix), sourced from Open Food Facts SA database
- scripts/seed-catalog.ts — CLI seed script: reads CSV, validates rows, batch upserts into barcode_catalog via Supabase admin client (ON CONFLICT DO NOTHING)
- Categories: Beverages, Snacks, Dairy, Bread, Condiments, Cereals, Spreads, Canned Food, Cooking Oil, Confectionery, Tea, Pasta
- Run with: `npx tsx scripts/seed-catalog.ts` (defaults to data/sa-products.csv)
- Idempotent: safe to re-run, duplicates silently skipped
- No app code changes, no new dependencies, no UI changes
- 0 TypeScript errors, 153/153 tests passing, production build succeeds

### Phase 17a: Compliance — Onboarding + Shop Field Improvements — COMPLETE
What was built:
- supabase/migrations/008_shop_fields.sql — NEW: ALTER shops ADD registration_number (TEXT), location (TEXT) — both nullable
- src/types/index.ts — UPDATED: Shop interface gains registration_number + location fields
- src/lib/validation/schemas.ts — UPDATED: onboardingSchema removes shopCode (now auto-generated), adds optional registrationNumber + location; updateShopSettingsSchema adds optional registration_number + location
- src/app/api/onboarding/route.ts — UPDATED: auto-generates shop code from name (first 4 alpha chars + 2 random digits, retry on collision); inserts registration_number + location; returns generated code
- src/app/(auth)/onboarding/page.tsx — UPDATED: removed shop code input; added optional Registration Number + Location fields; new "done" step shows generated code before redirecting
- src/app/api/settings/route.ts — UPDATED: GET + PATCH include registration_number + location columns
- src/app/(app)/settings/page.tsx — UPDATED: added Registration Number + Location input fields with helper text
- tests/unit/validation.test.ts — UPDATED: onboarding tests rewritten (no shopCode), added registration_number/location tests for both schemas
- 0 TypeScript errors, 53/53 validation tests passing (total test count adjusts: removed 3 shopCode tests, added 5 new field tests)

### Phase 17b: Compliance — Product Expiry Date Tracking (Batch System) — COMPLETE
What was built:
- supabase/migrations/009_product_batches.sql — NEW: product_batches table (id, shop_id, product_id, expiry_date, quantity), RLS via user_in_shop, decrement_stock_fefo SQL function (FEFO batch consumption)
- src/types/index.ts — UPDATED: added ProductBatch + AddBatchInput interfaces
- src/lib/validation/schemas.ts — UPDATED: added addBatchSchema (product_id, expiry_date YYYY-MM-DD, quantity)
- src/lib/db/batches.ts — NEW: listBatchesForProduct, addBatch (insert + increment stock), removeBatch (discard + decrement stock), getExpiryStats, listExpiringProducts
- src/lib/db/sales.ts — UPDATED: swapped decrement_stock → decrement_stock_fefo RPC (FEFO deduction is transparent to sale flow)
- src/app/api/batches/route.ts — NEW: GET (list batches for product), POST (add batch with expiry)
- src/app/api/batches/[id]/route.ts — NEW: DELETE (discard batch, decrement stock)
- src/app/api/stock/route.ts — UPDATED: returns expiring_count in GET response; ?expiring=1 returns expiring products list
- src/app/(app)/stock/[id]/page.tsx — UPDATED: added Expiry Batches section (batch list with color-coded status, add batch form, discard with confirmation)
- src/app/(app)/stock/page.tsx — UPDATED: added 4th summary card (Expiring count), 3rd tab (Expiring) with expired/expiring-soon product list
- tests/unit/batches.test.ts — NEW: 14 tests for addBatchSchema validation (format, boundaries, rejections)
- tests/unit/security.test.ts — FIXED: 2 pre-existing failures from Phase 17a shopCode removal (tests updated to test empty shopName/ownerName instead)
- 0 TypeScript errors, 171/171 tests passing, production build succeeds

### Phase 17d: Compliance — WhatsApp Expiry Warning — COMPLETE
What was built:
- src/types/index.ts — UPDATED: added ExpiringProductAlert interface (name, expired_qty, expiring_soon_qty, earliest_expiry)
- src/lib/db/reports.ts — UPDATED: added getExpiringProductsForShop() — admin client query for expired/expiring-soon batches per shop
- src/lib/whatsapp/format.ts — UPDATED: formatDailySummary() accepts optional expiringProducts param; renders ⏰ Expiry alert section with expired counts, expiring-soon counts, and earliest expiry dates
- src/app/api/cron/daily-summary/route.ts — UPDATED: calls getExpiringProductsForShop() in parallel with existing queries; passes results to formatter
- tests/unit/whatsapp-format.test.ts — UPDATED: 14 tests (9 existing updated for new param + 5 new expiry tests)
- 0 TypeScript errors, 176/176 tests passing, production build succeeds

---

## Current File Tree

_Last updated: Phase 17d complete_

```
spaza shop/
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
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (cache strategies)
│   └── icons/
│       ├── icon.svg                # App icon
│       └── icon-maskable.svg       # Maskable variant
├── src/
│   ├── proxy.ts                    # Auth guard + role-based routing (Next.js 16 proxy convention)
│   ├── app/
│   │   ├── layout.tsx              # Root layout (PWA meta, viewport, viewportFit=cover)
│   │   ├── error.tsx               # Global error boundary (Phase 11)
│   │   ├── not-found.tsx           # 404 page (Phase 11)
│   │   ├── page.tsx                # Root redirect logic
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── auth/
│   │   │   └── callback/route.ts   # Supabase email confirmation handler (exchanges code → session)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx      # Owner + Teller login tabs
│   │   │   └── onboarding/page.tsx # 2-step: account → shop setup (email-sent state for confirmation)
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # Authenticated shell (ToastProvider + BottomNav)
│   │   │   ├── error.tsx           # App-segment error boundary (Phase 11)
│   │   │   ├── dashboard/page.tsx  # Full dashboard: today summary, weekly chart, top products, latest sales, nav
│   │   │   ├── dashboard/loading.tsx  # Skeleton loader for dashboard
│   │   │   ├── settings/page.tsx   # Owner settings: shop name, WhatsApp number, low-stock threshold, subscription status
│   │   │   ├── subscribe/page.tsx # Subscription page: pricing, PayFast checkout, success/cancel states
│   │   │   ├── sale/
│   │   │   │   ├── page.tsx        # Full sale flow: scan → cart → complete
│   │   │   │   └── complete/page.tsx  # Sale confirmation screen
│   │   │   ├── stock-take/
│   │   │   │   └── page.tsx        # Count products, enter real qty, save
│   │   │   ├── stock/
│   │   │   │   ├── page.tsx        # Stock overview: summary strip, search, All/Low tabs
│   │   │   │   ├── loading.tsx     # Skeleton loader for stock list
│   │   │   │   └── [id]/page.tsx   # Adjust stock form (Add/Remove mode, quick amounts)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # Searchable product list (owner only)
│   │   │   │   ├── new/page.tsx    # Add product form
│   │   │   │   └── [id]/page.tsx   # Edit/delete product form
│   │   │   ├── tellers/
│   │   │   │   ├── page.tsx        # Teller list with remove (ConfirmModal, Skeleton)
│   │   │   │   ├── loading.tsx     # Skeleton loader for tellers list
│   │   │   │   └── new/page.tsx    # Add teller form
│   │   │   └── admin/
│   │   │       ├── layout.tsx      # Admin layout (AdminNav + max-w-4xl)
│   │   │       ├── loading.tsx     # Skeleton loader for admin overview
│   │   │       ├── page.tsx        # Admin overview: 6 stat cards + link to shops
│   │   │       ├── shops/
│   │   │       │   ├── loading.tsx     # Skeleton loader for shop list
│   │   │       │   ├── page.tsx        # Shop list: search, status filter, pagination
│   │   │       │   └── [id]/page.tsx   # Shop detail: info, access toggle, notes, payments
│   │   │       └── catalog/
│   │   │           ├── loading.tsx     # Skeleton loader for catalog list (Phase 16c)
│   │   │           ├── page.tsx        # Catalog list: search, pagination (Phase 16c)
│   │   │           ├── new/page.tsx    # Add catalog entry form (Phase 16c)
│   │   │           └── [id]/page.tsx   # Edit/delete catalog entry (Phase 16c)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── teller-login/route.ts  # Returns synthetic email
│   │       ├── onboarding/route.ts        # Creates shop + owner records
│   │       ├── products/
│   │       │   ├── route.ts               # GET list, POST create
│   │       │   └── [id]/route.ts          # GET by id, PATCH, DELETE
│   │       ├── sales/
│   │       │   └── route.ts               # POST — complete a sale (uses decrement_stock_fefo)
│   │       ├── batches/
│   │       │   ├── route.ts               # GET list batches for product, POST add batch (Phase 17b)
│   │       │   └── [id]/route.ts          # DELETE — discard batch (Phase 17b)
│   │       ├── stock/
│   │       │   └── route.ts               # GET list with low_stock flag + expiry count, POST adjust qty
│   │       ├── stock-take/
│   │       │   └── route.ts               # POST — save stock take
│   │       ├── subscribe/
│   │       │   ├── checkout/route.ts      # POST — generates PayFast checkout params
│   │       │   ├── notify/route.ts        # POST — PayFast ITN webhook handler
│   │       │   └── status/route.ts        # GET — subscription status + days remaining
│   │       ├── cron/
│   │       │   ├── daily-summary/route.ts # GET — 22:00 SAST daily; sends WhatsApp summaries
│   │       │   └── expire-subscriptions/route.ts # GET — 02:00 SAST daily; expires overdue trials/subs
│   │       ├── admin/
│   │       │   ├── overview/route.ts      # GET — admin aggregate stats
│   │       │   ├── catalog/
│   │       │   │   ├── route.ts           # GET — list catalog, POST — create entry (Phase 16c)
│   │       │   │   └── [id]/route.ts      # GET — single entry, PATCH — update, DELETE (Phase 16c)
│   │       │   └── shops/
│   │       │       ├── route.ts           # GET — paginated shop list with search/filter
│   │       │       └── [id]/
│   │       │           ├── route.ts       # GET — full shop detail
│   │       │           ├── payments/route.ts  # POST — record manual payment
│   │       │           ├── access/route.ts    # PATCH — toggle access_granted
│   │       │           ├── notes/route.ts     # PATCH — update admin notes
│   │       │           └── subscription/route.ts # PATCH — update subscription status + end dates (Phase 15c)
│   │       ├── settings/
│   │       │   └── route.ts               # GET + PATCH shop settings (owner only)
│   │       └── tellers/
│   │           ├── route.ts               # GET list, POST create
│   │           ├── me/route.ts            # GET own teller record
│   │           └── [id]/route.ts          # PATCH deactivate
│   ├── components/
│   │   ├── sale/
│   │   │   ├── TellerSelector.tsx         # Teller picker for owners
│   │   │   ├── CartItem.tsx               # Cart row with qty +/− controls
│   │   │   ├── CartSummary.tsx            # Sticky total + Complete Sale button
│   │   │   ├── NewProductModal.tsx        # Quick-create for unknown barcodes
│   │   │   └── ProductPicker.tsx          # Manual product picker (bottom-sheet with search)
│   │   ├── scanner/
│   │   │   ├── BarcodeScanner.tsx         # Full-screen camera overlay
│   │   │   └── ScannerOverlay.tsx         # Targeting reticle
│   │   ├── admin/
│   │   │   └── AdminNav.tsx               # Admin top nav: Overview | Shops | Catalog + sign out (Phase 15b, 16c)
│   │   ├── dashboard/
│   │   │   └── WeeklySalesChart.tsx       # Client component; bar chart of last 7 days (recharts)
│   │   ├── BottomNav.tsx                  # Owner bottom navigation bar (5 tabs)
│   │   ├── ConfirmModal.tsx               # Bottom-sheet confirm dialog (replaces browser confirm())
│   │   ├── Skeleton.tsx                   # Animated skeleton primitive for loading states
│   │   ├── Toast.tsx                      # Toast notification system + ToastProvider context
│   │   ├── OfflineBanner.tsx              # Amber/blue top banner (offline / syncing)
│   │   ├── OfflineSyncProvider.tsx        # Client wrapper; owns sync state
│   │   └── ServiceWorkerRegistrar.tsx     # Registers /sw.js on mount
│   ├── hooks/
│   │   ├── useActiveTeller.ts             # Active teller state (owner=pick, teller=auto)
│   │   ├── useCart.ts                     # Cart state (add/remove/updateQty/clear)
│   │   ├── useScanner.ts                  # @zxing/browser wrapper
│   │   ├── useOnlineStatus.ts             # Tracks navigator.onLine
│   │   ├── useOfflineSync.ts              # Auto-sync on reconnect + pending count
│   │   └── useToast.ts                    # (legacy standalone hook — Toast.tsx context is used)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client (with cookies)
│   │   │   └── admin.ts            # Service role client
│   │   ├── auth/
│   │   │   ├── teller.ts           # Synthetic email + provisioning + updateShopUsersSubscription
│   │   │   └── admin-guard.ts      # requireAdmin() — server-side admin auth verification (Phase 15a)
│   │   ├── payfast/
│   │   │   └── index.ts            # PayFast: signature, checkout params, ITN validation (Phase 14)
│   │   ├── db/
│   │   │   ├── products.ts         # Product CRUD helpers
│   │   │   ├── tellers.ts          # Teller query helpers
│   │   │   ├── sales.ts            # completeSale (insert + stock deduction)
│   │   │   ├── stock-take.ts       # saveStockTake (audit + update stock_qty)
│   │   │   ├── stock.ts            # listProductsWithStock + adjustStock (Phase 8)
│   │   │   ├── reports.ts          # getDailySalesForShop + getLowStockForShop (Phase 9)
│   │   │   ├── admin.ts            # Admin DB helpers: overview stats, list/detail shops, payments, access, notes (Phase 15b)
│   │   │   ├── catalog.ts          # Shared barcode catalog: getCatalogEntry, getCatalogEntryById + admin CRUD (Phase 16a, 16c)
│   │   │   └── batches.ts          # Product batch CRUD + expiry stats (Phase 17b)
│   │   ├── offline/
│   │   │   ├── db.ts               # IndexedDB via idb (enqueue/list/remove/count)
│   │   │   └── sync.ts             # syncPendingSales (retry queue → server)
│   │   ├── whatsapp/
│   │   │   ├── client.ts           # Twilio client factory + sendWhatsApp()
│   │   │   └── format.ts           # formatDailySummary() — pure text formatter
│   │   ├── validation/
│   │   │   └── schemas.ts          # All Zod schemas (all phases)
│   │   └── utils/
│   │       ├── currency.ts
│   │       ├── date.ts
│   │       ├── rateLimit.ts    # In-memory rate limiter for API routes (Phase 11)
│   │       └── statusBadge.ts  # Shared subscription status badge colors (Phase 15d)
│   └── types/
│       └── index.ts
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_decrement_stock.sql  # decrement_stock(p_product_id, p_qty) RPC
│       ├── 003_stock_adjustments.sql  # stock_adjustments audit table (Phase 8)
│       ├── 004_optional_barcode.sql  # barcode nullable + partial unique index (Phase 13)
│       ├── 005_subscriptions.sql    # subscription_status, trial_ends_at, subscription_ends_at, payfast_token (Phase 14)
│       ├── 006_admin_dashboard.sql  # access_granted, admin_notes, admin_payments table, manual_override status (Phase 15a)
│       ├── 007_barcode_catalog.sql  # barcode_catalog table — shared product name lookup (Phase 16a)
│       ├── 008_shop_fields.sql     # registration_number + location columns on shops (Phase 17a)
│       └── 009_product_batches.sql # product_batches table + decrement_stock_fefo function (Phase 17b)
├── data/
│   └── sa-products.csv             # 100 common SA products with EAN-13 barcodes for catalog seeding (Phase 16d)
├── scripts/
│   ├── set-admin.ts                # CLI: npx tsx scripts/set-admin.ts <email> — promotes user to admin (Phase 15a)
│   └── seed-catalog.ts             # CLI: npx tsx scripts/seed-catalog.ts [csv] — seeds barcode_catalog table (Phase 16d)
├── tasks/
│   ├── todo.md
│   ├── lessons.md
│   └── bugs.md                     # Bug tracker — read at every session start; update on every fix
└── tests/
    └── unit/
        ├── currency.test.ts        # 16 tests — formatZAR, parsePrice, calcSubtotal, calcTotal
        ├── whatsapp-format.test.ts # 14 tests — formatDailySummary + expiry alerts (Phase 17d)
        ├── validation.test.ts      # 49 tests — all 10 Zod schemas (Phase 12)
        ├── date.test.ts            # 17 tests — SAST timezone helpers (Phase 12)
        ├── rate-limit.test.ts      # 7 tests  — in-memory rate limiter (Phase 12)
        ├── security.test.ts        # 15 tests — schema rejection of malformed input (Phase 12)
        ├── payfast.test.ts         # 12 tests — PayFast signature, checkout params, IP validation, expiry logic (Phase 14)
        ├── admin.test.ts          # 28 tests — statusBadge, admin Zod schemas (Phase 15d)
        └── batches.test.ts        # 14 tests — addBatchSchema validation (Phase 17b)
```
