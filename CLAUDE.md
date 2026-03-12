# SpazaSync — CLAUDE.md

## What this project is

SpazaSync is a mobile-first PWA for South African spaza shop and small retail owners. These owners currently calculate sales on a basic calculator and manage stock manually or not at all. SpazaSync replaces that entire workflow with a smartphone app that requires no technical skill.

**Core flow:** owner opens the app on their Android phone → scans a product barcode using their phone camera → product added to the sale → stock automatically deducted when the sale is completed → owner receives a daily WhatsApp summary of sales and stock levels.

**Target user:** someone with no technical background. Plain English. No jargon. Obvious UI. Works on a mid-range Android smartphone, no laptop or external hardware needed.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router, TypeScript strict mode |
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
- Sees: **only the sale page** — middleware locks all other routes
- Auto-selected as the active teller (no TellerSelector shown)
- No cross-shop data visibility (RLS + synthetic email scoping)

### Shop Code
- Short identifier chosen by owner at onboarding (e.g. `CAPE99`, `MLUNGU01`)
- Stored in `shops.code` — globally unique, 6–10 chars, uppercase alphanumeric
- Used on teller login screen

### Access Matrix

| Route | Owner | Teller |
|---|---|---|
| /dashboard | ✓ | ✗ |
| /sale | ✓ | ✓ |
| /stock-take | ✓ | ✗ |
| /products | ✓ | ✗ |
| /stock | ✓ | ✗ |
| /tellers | ✓ | ✗ |
| /settings | ✓ | ✗ |

---

## Database Schema

### Tables
- `shops` — id, name, code (unique), whatsapp_number, low_stock_threshold
- `shop_users` — maps auth users to shops with role (owner | teller)
- `tellers` — named teller entries; optional link to auth user_id; name unique per shop
- `products` — barcode, name, price, stock_qty; unique(shop_id, barcode)
- `sales` — total, teller_id, completed_at, offline_id for dedup
- `sale_items` — product_id, quantity, unit_price, subtotal
- `stock_take_entries` — product_id, qty_before, qty_after, teller_id, taken_at

### RLS helpers
- `user_in_shop(shop_id)` — SECURITY DEFINER function
- `user_is_owner(shop_id)` — SECURITY DEFINER function

All tables have RLS enabled. Every query is shop-scoped.

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
```

---

## Workflow Orchestration Rules

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

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

## Living Project Awareness Rules (CRITICAL)

### File Structure Awareness
- This CLAUDE.md file contains the **ground-truth file structure** at all times
- After every completed phase, run a Glob scan and update the file tree below to reflect reality
- Any new file created, renamed, or deleted must be reflected here before the phase is marked complete
- At the start of every new session, read this file fully before taking any action — mandatory, not optional

### Phase Completion Protocol
At the end of every phase, before marking it complete:
1. Glob scan the project root
2. Compare against the file tree below
3. Update the file tree to match reality
4. Check off the completed phase in the Living Scope section
5. Add a "What was built" note under the phase entry
6. **Commit to GitHub** — stage all new/modified files, commit with message `feat: Phase N — <short description>`, push to `main`
7. Only then mark the todo item as complete

### Session Start Protocol
At the start of every session:
1. Read this file fully — mandatory
2. Note which phases are complete (Living Scope below)
3. Note the current real file structure (File Tree below)
4. Review tasks/lessons.md
5. Pick up from where the project left off

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
- [ ] Phase 11: Polish & Hardening
- [ ] Phase 12: Testing & Deployment

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

---

## Current File Tree

_Last updated: Phase 10 complete_

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
│   ├── middleware.ts               # Auth guard + role-based routing
│   ├── app/
│   │   ├── layout.tsx              # Root layout (PWA meta, viewport)
│   │   ├── page.tsx                # Root redirect logic
│   │   ├── globals.css
│   │   ├── favicon.ico
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx      # Owner + Teller login tabs
│   │   │   └── onboarding/page.tsx # 2-step: account → shop setup
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # Authenticated shell
│   │   │   ├── dashboard/page.tsx  # Full dashboard: today summary, weekly chart, top products, latest sales, nav
│   │   │   ├── settings/page.tsx   # Owner settings: shop name, WhatsApp number, low-stock threshold
│   │   │   ├── sale/
│   │   │   │   ├── page.tsx        # Full sale flow: scan → cart → complete
│   │   │   │   └── complete/page.tsx  # Sale confirmation screen
│   │   │   ├── stock-take/
│   │   │   │   └── page.tsx        # Count products, enter real qty, save
│   │   │   ├── stock/
│   │   │   │   ├── page.tsx        # Stock overview: summary strip, search, All/Low tabs
│   │   │   │   └── [id]/page.tsx   # Adjust stock form (Add/Remove mode, quick amounts)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx        # Searchable product list (owner only)
│   │   │   │   ├── new/page.tsx    # Add product form
│   │   │   │   └── [id]/page.tsx   # Edit/delete product form
│   │   │   └── tellers/
│   │   │       ├── page.tsx        # Teller list with remove
│   │   │       └── new/page.tsx    # Add teller form
│   │   └── api/
│   │       ├── auth/
│   │       │   └── teller-login/route.ts  # Returns synthetic email
│   │       ├── onboarding/route.ts        # Creates shop + owner records
│   │       ├── products/
│   │       │   ├── route.ts               # GET list, POST create
│   │       │   └── [id]/route.ts          # GET by id, PATCH, DELETE
│   │       ├── sales/
│   │       │   └── route.ts               # POST — complete a sale
│   │       ├── stock/
│   │       │   └── route.ts               # GET list with low_stock flag, POST adjust qty
│   │       ├── stock-take/
│   │       │   └── route.ts               # POST — save stock take
│   │       ├── cron/
│   │       │   └── daily-summary/route.ts # GET — 22:00 SAST daily; sends WhatsApp summaries
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
│   │   │   └── NewProductModal.tsx        # Quick-create for unknown barcodes
│   │   ├── scanner/
│   │   │   ├── BarcodeScanner.tsx         # Full-screen camera overlay
│   │   │   └── ScannerOverlay.tsx         # Targeting reticle
│   │   ├── dashboard/
│   │   │   └── WeeklySalesChart.tsx       # Client component; bar chart of last 7 days (recharts)
│   │   ├── OfflineBanner.tsx              # Amber/blue top banner (offline / syncing)
│   │   ├── OfflineSyncProvider.tsx        # Client wrapper; owns sync state
│   │   └── ServiceWorkerRegistrar.tsx     # Registers /sw.js on mount
│   ├── hooks/
│   │   ├── useActiveTeller.ts             # Active teller state (owner=pick, teller=auto)
│   │   ├── useCart.ts                     # Cart state (add/remove/updateQty/clear)
│   │   ├── useScanner.ts                  # @zxing/browser wrapper
│   │   ├── useOnlineStatus.ts             # Tracks navigator.onLine
│   │   └── useOfflineSync.ts              # Auto-sync on reconnect + pending count
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client (with cookies)
│   │   │   └── admin.ts            # Service role client
│   │   ├── auth/
│   │   │   └── teller.ts           # Synthetic email + provisioning
│   │   ├── db/
│   │   │   ├── products.ts         # Product CRUD helpers
│   │   │   ├── tellers.ts          # Teller query helpers
│   │   │   ├── sales.ts            # completeSale (insert + stock deduction)
│   │   │   ├── stock-take.ts       # saveStockTake (audit + update stock_qty)
│   │   │   ├── stock.ts            # listProductsWithStock + adjustStock (Phase 8)
│   │   │   └── reports.ts          # getDailySalesForShop + getLowStockForShop (Phase 9)
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
│   │       └── date.ts
│   └── types/
│       └── index.ts
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_decrement_stock.sql  # decrement_stock(p_product_id, p_qty) RPC
│       └── 003_stock_adjustments.sql  # stock_adjustments audit table (Phase 8)
├── tasks/
│   ├── todo.md
│   └── lessons.md
└── tests/
    └── unit/
        └── currency.test.ts        # 16 tests passing
```
