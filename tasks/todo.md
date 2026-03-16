# SpazaSync — Task Tracking

## Current Session

_Update this file at the start of every session with what you're working on._

---

## Phase 1: Project Bootstrap — COMPLETE ✓

- [x] Bootstrap Next.js 14 (TypeScript, Tailwind, App Router, src/ dir)
- [x] Install all dependencies
- [x] Create CLAUDE.md
- [x] Create tasks/todo.md and tasks/lessons.md
- [x] Write config files (next.config.ts, tailwind.config.ts, vitest.config.ts, vercel.json, .env.local.example)
- [x] Write supabase/migrations/001_initial_schema.sql
- [x] Scaffold src/types/index.ts, src/lib/utils/currency.ts, src/lib/utils/date.ts
- [x] Write tests/unit/currency.test.ts
- [x] Glob scan → CLAUDE.md file tree updated → Phase 1 checked off

### Review
All Phase 1 files created and verified. `npm run dev` starts clean. Vitest passes currency tests. Ready for Phase 2.

---

## Phase 2: Auth, Roles & Onboarding — COMPLETE ✓

- [x] Supabase client/server/admin helpers
- [x] src/middleware.ts — auth guard + role-based route lock (teller→/sale, no role→/onboarding)
- [x] Login page — two tabs: Owner (email+password) / Teller (shop code + name + password)
- [x] Onboarding page — 2-step: create account → setup shop (name, code, owner name, WhatsApp)
- [x] API: POST /api/auth/teller-login — validates shop+teller, returns synthetic email
- [x] API: POST /api/onboarding — creates shop, shop_users (owner), tellers (owner entry), sets app_metadata
- [x] lib/auth/teller.ts — nameToSlug, buildTellerEmail, provisionTellerAccount, setOwnerMetadata
- [x] lib/validation/schemas.ts — all Zod schemas for all phases
- [x] 0 TypeScript errors, 16/16 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 2 checked off

### Review
All auth infrastructure complete. Owner signs up → onboards → lands on dashboard. Teller logs in with shop code + name + password → locked to /sale. Middleware enforces roles via app_metadata JWT claims. Ready for Phase 3.

---

## Phase 3: Product Catalogue — COMPLETE ✓

- [x] src/lib/db/products.ts — listProducts, getProduct, getProductByBarcode, createProduct, updateProduct, deleteProduct
- [x] API: GET /api/products (list + ?search= + ?barcode= filters), POST /api/products
- [x] API: GET/PATCH/DELETE /api/products/[id]
- [x] src/app/(app)/products/page.tsx — searchable product list (owner only)
- [x] src/app/(app)/products/new/page.tsx — add product form
- [x] src/app/(app)/products/[id]/page.tsx — edit/delete product form
- [x] 0 TypeScript errors, 16/16 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 3 checked off

### Review
Product CRUD complete. Owner can list/search products, add (barcode + name + price + stock), edit, and delete. RLS via Supabase session ensures shop isolation. Zod validates all API inputs. Duplicate barcode returns 409. Note: project is Next.js 16/React 19 — params/searchParams are Promises. Ready for Phase 4.

---

## Phase 4: Teller Management — COMPLETE ✓

- [x] src/lib/db/tellers.ts — listTellers, getMyTellerRecord, deactivateTeller
- [x] API: GET /api/tellers, POST /api/tellers (provisions auth + teller + shop_users with rollback)
- [x] API: GET /api/tellers/me — own teller record for teller login auto-select
- [x] API: PATCH /api/tellers/[id] — deactivate teller
- [x] src/app/(app)/tellers/page.tsx — teller list with remove
- [x] src/app/(app)/tellers/new/page.tsx — add teller form (name + password)
- [x] src/components/sale/TellerSelector.tsx — shown on sale page for owners
- [x] src/hooks/useActiveTeller.ts — owner: sessionStorage pick; teller: auto from /api/tellers/me
- [x] src/app/(app)/sale/page.tsx — owner sees TellerSelector; teller sees auto-selected name
- [x] 0 TypeScript errors, 16/16 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 4 checked off

### Review
Teller management complete. Owner adds teller (name + password) → Supabase auth account provisioned with synthetic email → teller record + shop_users row created (with rollback on failure). Sale page shows TellerSelector for owners (sessionStorage); tellers auto-selected from their session. Ready for Phase 5.

---

## Phase 5: Barcode Scanner + Sale Flow — COMPLETE ✓

- [x] supabase/migrations/002_decrement_stock.sql — decrement_stock RPC
- [x] src/hooks/useScanner.ts — wraps @zxing/browser, fires onScan once per open
- [x] src/hooks/useCart.ts — add/remove/updateQty/clear with subtotal tracking
- [x] src/components/scanner/BarcodeScanner.tsx — full-screen camera overlay
- [x] src/components/scanner/ScannerOverlay.tsx — targeting reticle
- [x] src/components/sale/CartItem.tsx — qty +/− controls
- [x] src/components/sale/CartSummary.tsx — sticky total + Complete Sale button
- [x] src/components/sale/NewProductModal.tsx — unknown barcode → quick-create
- [x] src/lib/db/sales.ts — completeSale (insert sale + items + decrement stock)
- [x] API: POST /api/sales — Zod-validated sale endpoint
- [x] src/app/(app)/sale/page.tsx — full scan → cart → complete flow
- [x] src/app/(app)/sale/complete/page.tsx — confirmation with New Sale button
- [x] Glob scan → CLAUDE.md updated → Phase 5 checked off

### Review
Full sale flow implemented. Owner/teller scans barcode → product looked up by barcode → added to cart; unknown barcode triggers NewProductModal quick-create. Cart shows items with qty controls. Complete Sale calls POST /api/sales → inserts sale + items → decrements stock via decrement_stock RPC. Redirects to /sale/complete showing total. Stock deduction is atomic per-product (CHECK constraint prevents negative stock). Ready for Phase 6.

---

## Phase 6: Stock Take — COMPLETE ✓

- [x] src/lib/db/stock-take.ts — saveStockTake: batch-fetch qty_before, batch-insert audit rows, update each product's stock_qty
- [x] src/app/api/stock-take/route.ts — POST /api/stock-take with Zod validation
- [x] src/app/(app)/stock-take/page.tsx — owner sees all products, enters real qty, changed rows highlighted, sticky Save button
- [x] Glob scan → CLAUDE.md updated → Phase 6 checked off

### Review
Stock take complete. Owner opens /stock-take → sees all products with current stock → types actual counted qty for each (blanks skipped) → saves. DB records stock_take_entries (before + after) for audit trail and updates products.stock_qty. Changed rows highlighted in orange on the form. Success screen shows count of updated products. Ready for Phase 7.

---

## Phase 7: Offline Support — COMPLETE ✓

- [x] src/lib/offline/db.ts — IndexedDB via idb (enqueue, list, remove, count pending sales)
- [x] src/lib/offline/sync.ts — syncPendingSales: POST each queued sale, remove on 201/409
- [x] src/hooks/useOnlineStatus.ts — online/offline via native events
- [x] src/hooks/useOfflineSync.ts — auto-sync on reconnect, visibilitychange + offlinequeue event
- [x] src/components/OfflineBanner.tsx — top banner (amber=offline, blue=syncing)
- [x] src/components/OfflineSyncProvider.tsx — client wrapper in (app)/layout
- [x] src/components/ServiceWorkerRegistrar.tsx — registers /sw.js from root layout
- [x] public/manifest.json — PWA manifest
- [x] public/sw.js — cache-first (static), stale-while-revalidate (/api/products), network-first (pages)
- [x] public/icons/icon.svg + icon-maskable.svg — SVG app icons
- [x] Updated 4 existing files (layouts, sale page, sale complete page)
- [x] Glob scan → CLAUDE.md updated → Phase 7 checked off

### Review
Offline support complete. When offline: sale queued to IndexedDB, banner shown, /sale/complete shows "Sale Saved" message. When back online: auto-sync fires, pending sales POSTed to /api/sales (offline_id deduplicates). SW caches /api/products stale-while-revalidate so barcode scanning works offline. App is installable as PWA (manifest + SW). Ready for Phase 8.

---

## Phase 8: Stock Management — COMPLETE ✓

- [x] supabase/migrations/003_stock_adjustments.sql — audit table with RLS
- [x] src/lib/db/stock.ts — listProductsWithStock (low_stock flag, sorted by qty ASC), adjustStock (clamped, audit)
- [x] src/app/api/stock/route.ts — GET /api/stock, POST /api/stock
- [x] src/types/index.ts — StockAdjustment + StockAdjustInput types
- [x] src/app/(app)/stock/page.tsx — overview: summary strip, search, All/Low tabs, colour badges
- [x] src/app/(app)/stock/[id]/page.tsx — adjust form: Add/Remove toggle, quick amounts, clamping warning, reason dropdown
- [x] Fixed pre-existing formatCurrency → formatZAR in 3 sale files
- [x] 0 TypeScript errors, 16/16 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 8 checked off

### Review
Stock management complete. Owner opens /stock → sees all products ordered by lowest stock first, with summary strip (total/low/out). Taps any product → /stock/[id] → chooses Add or Remove mode → enters qty (or uses quick-add buttons: +10/24/48/100) → optional reason → saves. Stock clamped to ≥0. Every adjustment creates an audit row in stock_adjustments. A stock take prompt appears if 3+ products are out of stock. Ready for Phase 9.

---

## Phase 9: WhatsApp Summaries — COMPLETE ✓

- [x] vercel.json — single cron at 0 20 * * * (22:00 SAST); removed separate low-stock cron
- [x] src/types/index.ts — DailySummaryData + LowStockItem types
- [x] src/lib/whatsapp/client.ts — Twilio client factory + sendWhatsApp()
- [x] src/lib/whatsapp/format.ts — formatDailySummary() pure formatter
- [x] src/lib/db/reports.ts — getDailySalesForShop + getLowStockForShop (admin client, explicit shop_id)
- [x] src/app/api/cron/daily-summary/route.ts — iterates all shops, per-shop error isolation
- [x] src/app/(app)/dashboard/page.tsx — today revenue/sales/tellers strip + low-stock alert widget
- [x] tests/unit/whatsapp-format.test.ts — 9 new tests (25/25 total passing)
- [x] 0 TypeScript errors, 25/25 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 9 checked off

### Review
WhatsApp summaries complete. Nightly cron (22:00 SAST) fetches all shops with a WhatsApp number, generates a daily sales recap + low-stock warnings per shop, and sends via Twilio. Shop scoping is doubly enforced: admin client queries explicitly filter by shop.id, and the loop sends each message to that shop's own whatsapp_number only. Dashboard now shows today's revenue, sale count, teller count, and a tappable low-stock alert card. Ready for Phase 10.

---

## Phase 10: Dashboard — COMPLETE ✓

- [x] recharts installed
- [x] src/types/index.ts — WeeklyDataPoint + RecentSale + TopProduct types
- [x] src/lib/db/reports.ts — getWeeklySalesForShop, getRecentSalesForShop, getTopProductsThisWeek
- [x] src/lib/validation/schemas.ts — updateShopSettingsSchema
- [x] src/components/dashboard/WeeklySalesChart.tsx — bar chart client component
- [x] src/app/api/settings/route.ts — GET + PATCH (admin client + ownership check)
- [x] src/app/(app)/settings/page.tsx — owner settings form
- [x] src/app/(app)/dashboard/page.tsx — full dashboard with all sections; plain English throughout
- [x] 0 TypeScript errors, 25/25 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 10 checked off

### Review
Full dashboard complete. Owner opens /dashboard → sees today's money/sales/tellers summary, low-stock alert (if any), 7-day bar chart, top 5 products sold this week, 10 most recent sales, and nav cards including new Settings link. All text uses plain South African English (no jargon). Settings page lets owner update shop name, WhatsApp number, and low-stock alert threshold; shop code is shown read-only. Ready for Phase 11.

---

## Phase 11: Polish & Hardening — COMPLETE ✓

- [x] src/app/error.tsx + src/app/not-found.tsx + src/app/(app)/error.tsx — error boundaries and 404 page
- [x] src/components/Skeleton.tsx — shared skeleton primitive
- [x] src/app/(app)/dashboard/loading.tsx + tellers/loading.tsx + stock/loading.tsx — skeleton loaders
- [x] src/lib/utils/rateLimit.ts — in-memory rate limiter
- [x] Apply rate limit to /api/auth/teller-login (10/60s) and /api/onboarding (3/60s)
- [x] src/components/ConfirmModal.tsx — bottom-sheet confirm modal
- [x] Updated tellers/page.tsx — ConfirmModal replaces confirm()/alert(); inline Skeleton loader
- [x] src/components/Toast.tsx + src/hooks/useToast.ts — toast system
- [x] src/components/BottomNav.tsx — 5-tab owner bottom nav
- [x] Updated src/app/(app)/layout.tsx — ToastProvider + BottomNav + role prop
- [x] Fixed CartSummary.tsx safe-area inset (pb-safe-bottom → env(safe-area-inset-bottom))
- [x] Added viewportFit: 'cover' to root layout viewport export
- [x] Added aria-label to stock search input and stock-take count inputs
- [x] Added security headers to vercel.json
- [x] 0 TypeScript errors, 25/25 tests passing
- [x] Glob scan → CLAUDE.md updated → Phase 11 checked off

### Review
Polish & Hardening complete. App now has proper error boundaries (no more blank white crashes), animated skeleton loaders on all data-heavy pages, a native-feeling bottom navigation bar for owners, a styled ConfirmModal replacing all browser confirm()/alert() dialogs, toast notifications wired in via context, a rate-limited login and onboarding endpoint, corrected safe-area insets for phones with home indicators, accessibility labels on all interactive inputs, and security headers on every response. 0 TypeScript errors, 25/25 tests passing. Ready for Phase 12.

---

## Phase 12: Testing & Deployment — COMPLETE ✓

- [x] Security audit: fixed missing auth check on /api/sales (unauthenticated POST was possible)
- [x] Security audit: fixed missing auth check on /api/stock-take
- [x] Added Content-Security-Policy header to vercel.json
- [x] tests/unit/validation.test.ts — 49 tests covering all 10 Zod schemas
- [x] tests/unit/date.test.ts — 17 tests for SAST timezone helpers
- [x] tests/unit/rate-limit.test.ts — 7 tests for in-memory rate limiter (vi.useFakeTimers)
- [x] tests/unit/security.test.ts — 15 tests verifying schema rejection of malicious input
- [x] npm test → 113/113 passing
- [x] npm run build → 0 TypeScript errors, production build successful
- [x] README.md — full deployment guide + security checklist
- [x] Glob scan → CLAUDE.md updated → Phase 12 checked off

### Review
Testing & Deployment complete. Found and fixed two critical security gaps (missing auth on /api/sales and /api/stock-take). Added Content-Security-Policy header. Expanded test suite from 25 to 113 tests across 6 files — all pure functions, validation schemas, date utilities, and rate limiter are now covered. Production build passes cleanly. README contains full Vercel deployment steps, environment variable table, Supabase migration instructions, and a security checklist. SpazaSync is production-ready.

---

## Phase 15b: Admin Dashboard — Pages & API Routes — COMPLETE ✓

- [x] src/lib/db/admin.ts — 6 admin DB helpers (overview stats, list/detail shops, payments, access toggle, notes)
- [x] src/components/admin/AdminNav.tsx — admin top nav (Overview | Shops + sign out)
- [x] src/app/api/admin/overview/route.ts — GET aggregate stats
- [x] src/app/api/admin/shops/route.ts — GET paginated shop list with search/status filter
- [x] src/app/api/admin/shops/[id]/route.ts — GET full shop detail
- [x] src/app/api/admin/shops/[id]/payments/route.ts — POST record manual payment
- [x] src/app/api/admin/shops/[id]/access/route.ts — PATCH toggle access_granted
- [x] src/app/api/admin/shops/[id]/notes/route.ts — PATCH update admin notes
- [x] src/app/(app)/admin/layout.tsx — admin layout (AdminNav + max-w-4xl)
- [x] src/app/(app)/admin/loading.tsx + shops/loading.tsx — skeleton loaders
- [x] src/app/(app)/admin/page.tsx — overview dashboard (6 stat cards)
- [x] src/app/(app)/admin/shops/page.tsx — shop list (search, filter, pagination)
- [x] src/app/(app)/admin/shops/[id]/page.tsx — shop detail (info, access toggle, notes, payments)
- [x] Fixed pre-existing: installed missing dotenv dev dependency
- [x] 0 TypeScript errors, 125/125 tests passing, build succeeds
- [x] Glob scan → CLAUDE.md updated → Phase 15b checked off

### Review
Admin dashboard pages and API routes complete. 14 new files created. Admin overview shows aggregate stats (total/active/trialing/expired/manual override/new this week). Shop list supports search by name/code, status filter, and pagination. Shop detail shows full info + quick stats + access toggle + admin notes + payment recording with optional subscription activation. All API routes use requireAdmin() guard + admin client (service role, no RLS). JWT metadata synced on access toggle and payment activation via updateShopUsersSubscription().

---

## Phase 15c: Admin Dashboard — Subscription & Access Logic — COMPLETE ✓

- [x] Added adminUpdateSubscriptionSchema to validation schemas
- [x] Added updateShopSubscription() to src/lib/db/admin.ts
- [x] Created PATCH /api/admin/shops/[id]/subscription route
- [x] Updated expire cron to handle manual_override expiry + revoke access_granted on expire
- [x] Updated shop detail page with subscription management UI (status dropdown, date picker, update button)
- [x] 0 TypeScript errors, 125/125 tests passing, build succeeds
- [x] Glob scan → CLAUDE.md updated → Phase 15c checked off

### Review
Admin subscription management complete. Admin can now directly change any shop's subscription status (trialing/active/cancelled/expired/manual_override) and set custom end dates from the shop detail page. The expire cron now handles all three expirable statuses (trialing, cancelled, manual_override) and revokes access_granted on expiry. JWT metadata is synced on every subscription change.

---

## Phase 15d: Admin Dashboard — Hardening & Polish — COMPLETE ✓

- [x] Fixed listShops() user paging bug — replaced bulk listUsers (1000 cap) with per-owner getUserById
- [x] Added shopExists() helper + 404 checks in all 4 admin mutation API routes
- [x] Extracted shared statusBadge colors into src/lib/utils/statusBadge.ts
- [x] Applied rate limiting (30/60s) to all 4 admin mutation routes
- [x] Added ConfirmModal before access revocation on shop detail page
- [x] Replaced console.error/inline "Saved" text with Toast feedback on all shop detail actions
- [x] Added notes character counter (2000 max, color-coded)
- [x] Added error state with Retry button on shops list page
- [x] Fixed AdminNav sign-out error handling with toast feedback
- [x] Created tests/unit/admin.test.ts — 28 tests (statusBadge + 5 admin Zod schemas)
- [x] 0 TypeScript errors, 153/153 tests passing, build succeeds
- [x] Glob scan → CLAUDE.md updated → Phase 15d checked off

### Review
Admin dashboard hardened and polished. Fixed critical scaling bug in owner email resolution (no longer capped at 1000 users). All mutation routes now validate shop existence before operating and are rate-limited. Access revocation requires confirmation dialog. All async actions provide toast feedback. Notes textarea has live character counter. Shop list shows error state with retry instead of infinite spinner. 28 new admin tests added.
