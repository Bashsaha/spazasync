# SpazaSync — Completed Phase Summaries

_Moved from CLAUDE.md to reduce context window usage. Read on-demand when historical context is needed._

---

**Phase 19 context:** Expiry dates are buried inside the stock adjustment page (`/stock/[id]`), requiring multiple hops to see them. Owners need a dedicated page showing all expiry-tracked products grouped by urgency (expired → expiring soon → OK) with expandable batch details. Additionally, `decrement_stock_fefo` silently consumes batches during sales with no audit trail — Phase 19b adds a `sale_batch_consumptions` table and modifies the SQL function to record which batches each sale consumed (fully automatic, zero teller burden). The system already knows expiry dates because owners enter them when adding stock; FEFO deduction is pure database logic. Implementation order: 19a first (UI only, no DB changes), then 19b (migration + sale flow). Full plan at `.claude/plans/sorted-prancing-dove.md`.

**Phase 20 context:** Site is extremely laggy and offline support is incomplete. Target users are on mid-range Android phones with inconsistent cellular data. Performance issues: Supabase client re-created on every call, ~60KB @zxing loaded even when scanner not open, manifest theme mismatch. Offline issues: no UNIQUE constraint on offline_id (duplicate sales), products not cached for offline browsing, no sync retry strategy, cart lost on crash, no sync error feedback. Full plan at `.claude/plans/velvety-floating-pond.md`. Implementation order: 20a (quick wins) → 20b (dedup safety) → 20c (offline resilience) → 20d (stock warnings + dashboard streaming).

---

### Phase 1: Project Bootstrap
Next.js 14 scaffolded with TypeScript, Tailwind, App Router. Config files, env template, initial DB migration (`001_initial_schema.sql`), core types, currency/date utils, first unit test, task tracking files.

### Phase 2: Auth, Roles & Onboarding
Supabase clients (browser/server/admin), teller provisioning with synthetic emails, Zod validation schemas, auth middleware (role-based routing), login page (owner + teller tabs), onboarding flow (account → shop setup), teller-login API, onboarding API.

### Phase 3: Product Catalogue
Product CRUD (DB helpers + API routes + UI pages). Searchable product list, add/edit/delete forms. Next.js 16/React 19 async params pattern used throughout.

### Phase 4: Teller Management
Teller CRUD (list/create/deactivate), TellerSelector component for owners on sale page, useActiveTeller hook (owner picks, teller auto-selected).

### Phase 5: Barcode Scanner + Sale Flow
`002_decrement_stock.sql` migration. useCart/useScanner hooks, BarcodeScanner camera overlay, CartItem/CartSummary components, NewProductModal for unknown barcodes, completeSale DB helper, sales API, full scan → cart → complete flow.

### Phase 6: Stock Take
saveStockTake DB helper (batch audit + stock update), stock-take API, stock take page with real qty entry, change highlighting, success screen.

### Phase 7: Offline Support
IndexedDB queue (idb), syncPendingSales retry logic, useOnlineStatus/useOfflineSync hooks, OfflineBanner/OfflineSyncProvider components, service worker (sw.js) with cache strategies, PWA manifest + icons. Sale page queues offline sales to IndexedDB.

### Phase 8: Stock Management
`003_stock_adjustments.sql` audit table. Stock list with low-stock flags, adjustStock with audit trail, stock overview page (summary strip, search, All/Low tabs), stock adjustment form (Add/Remove toggle, quick amounts, reason dropdown).

### Phase 9: WhatsApp Summaries
Twilio WhatsApp client, formatDailySummary text formatter, daily sales/low-stock report queries, cron handler at 22:00 SAST, dashboard wired with today's revenue/sales strip + low-stock alert. 14 tests for formatter.

### Phase 10: Dashboard
recharts bar chart (weekly sales), settings page (shop name, WhatsApp, threshold), full dashboard with today summary, low-stock alert, weekly chart, top products, latest sales.

### Phase 11: Polish & Hardening
Error boundaries (global + app segment), Skeleton loader component, loading states for dashboard/tellers/stock, rate limiter (teller-login + onboarding), ConfirmModal/Toast/ToastProvider, BottomNav (5-tab owner nav), security headers in vercel.json, aria-labels for accessibility.

### Phase 12: Testing & Deployment
Auth checks added to `/api/sales` and `/api/stock-take`, CSP header, 4 test suites (validation 49 tests, date 17, rate-limit 7, security 15), README deployment guide. BUG-001 to BUG-003 fixed (onboarding routing, email callback, email-sent state). `tasks/bugs.md` created.

### Phase 13: QA Fixes & UX Improvements
Renamed middleware.ts → proxy.ts (Next.js 16 convention), fixed dark mode invisible text, hydration mismatch fix, color scheme orange → royal blue, ProductPicker manual search component, barcode made optional (`004_optional_barcode.sql`), BUG-004 to BUG-010 logged.

### Phase 14: Subscription & Payment (PayFast)
`005_subscriptions.sql` migration. PayFast integration (signature, checkout, ITN webhook, IP validation), subscribe page (R349.99/month), expire-subscriptions cron (02:00 SAST), 7-day auto-trial on signup, subscription gate in proxy.ts, subscription status in settings/dashboard. 12 PayFast tests.

### Phase 15a–e: Admin Dashboard (complete group)
**15a — Role Infrastructure:** `006_admin_dashboard.sql` (access_granted, admin_notes, admin_payments table, manual_override status). set-admin.ts CLI, requireAdmin() guard, admin routing in proxy.ts, BottomNav hides for admin.
**15b — Pages & API Routes:** Admin DB helpers, AdminNav, 6 API routes (overview, shops list/detail, payments, access toggle, notes), admin pages (overview, shop list, shop detail), skeleton loaders.
**15c — Subscription & Access Logic:** Admin can update subscription status/dates directly, expire-subscriptions cron handles manual_override expiry.
**15d — Hardening & Polish:** Fixed listShops bulk user fetch (1000 cap → per-owner lookup), shared statusBadge util, rate limiting + 404 checks on all admin API routes, ConfirmModal/Toast on admin actions, 28 admin tests.
**15e — Dual-Role:** set-admin.ts preserves shop_id on promotion, BottomNav shows owner tabs + Admin tab for dual-role, AdminNav shows "My Shop" link.

### Phase 16a–d: Shared Barcode Catalog (complete group)
**16a — Database + Backend:** `007_barcode_catalog.sql` table, catalog DB helpers (user read + admin CRUD), Zod schemas.
**16b — Scan Flow Integration:** Product GET falls back to barcode_catalog for unknown barcodes, NewProductModal pre-fills suggested name from catalog.
**16c — Admin Management UI:** Catalog CRUD pages + API routes under /admin/catalog, AdminNav gains "Catalog" link.
**16d — Pre-Live Seed:** `data/sa-products.csv` (100 SA products with EAN-13 barcodes), `scripts/seed-catalog.ts` idempotent seeder.

### Phase 17a–d: Compliance (complete group)
**17a — Onboarding + Shop Fields:** `008_shop_fields.sql` (registration_number, location). Shop code auto-generated from name. Registration number + location in onboarding + settings.
**17b — Expiry Date Tracking:** `009_product_batches.sql` (product_batches table + decrement_stock_fefo FEFO function). Batch CRUD helpers, batches API, expiry section in stock adjustment page, Expiring tab in stock overview. 14 batch tests.
**17c — Report PDF Download:** jspdf + jspdf-autotable. Compliance PDF API (inventory, expiry register, 30-day stock movement). Download button in settings.
**17d — WhatsApp Expiry Warning:** getExpiringProductsForShop() query, expiry alert section in daily WhatsApp summary, 5 new formatter tests.

### Phase 18 + 18b: Expiry Date UX (complete group)
**18 — Plain English UX:** Renamed all batch jargon to plain English ("Expiry Dates", "Remove", "Add expiry date"). Optional expiry date field added to product creation and scan-create modal. Two-step creation pattern (product first, then batch) avoids double-counting.
**18b — Multi-Expiry + Name Uniqueness:** `010_product_name_unique.sql` case-insensitive unique index. ExpiryEntryList shared component for repeatable date+qty rows. Multi-expiry in all 3 creation flows (product form, scan modal, stock adjustment). Smart duplicate handling — scan modal shows existing product with "Add to sale" when catalog name matches existing shop product. API returns distinct error messages for name vs barcode duplicates.

### Phase 19a–b: Expiry Management (complete group)
**19a — Dedicated Expiry Page:** `listAllProductsWithBatches()` DB helper, `GET /api/stock/expiry` endpoint, `/expiry` page with 3 collapsible urgency sections (expired/expiring soon/OK), expandable product cards with plain English date labels, links to `/stock/[id]`. Dashboard + stock page link to `/expiry`. Types: `BatchDetail`, `ExpiryProductDetail`.
**19b — Batch Consumption Tracking:** `011_sale_batch_consumptions.sql` — new `sale_batch_consumptions` audit table (sale_id, batch_id, product_id, qty_consumed, expiry_date). `decrement_stock_fefo` now accepts optional `p_sale_id` and auto-records each batch consumption. `completeSale()` passes `sale.id` to RPC. Type: `SaleBatchConsumption`. Zero teller burden — fully automatic.

**Bug fixes (post-Phase 18b):**
- BUG-013: Adding stock with partial expiry dates dropped untracked units. Fixed: remainder added via `/api/stock`.
- BUG-014: BottomNav covered CartSummary's "Complete Sale" button on mobile. Fixed: `aboveNav` prop with z-50.
- Dashboard expiry alert: wired `getExpiringProductsForShop()` to dashboard (was only in WhatsApp cron).

### Phase 20a: Performance — Quick Wins
Supabase browser client cached as module-level singleton (`src/lib/supabase/client.ts`). `@zxing/browser` lazy-loaded via dynamic import in `useScanner.ts` — removes ~60KB from initial sale page bundle. PWA manifest `theme_color` corrected from orange `#f97316` to blue `#2563eb`.

### Phase 20b: Offline Dedup Safety
`012_offline_id_unique.sql` — partial unique index on `sales.offline_id` (WHERE NOT NULL) prevents duplicate offline sales on retry. Cleans up existing duplicates (keeps earliest). `src/app/api/sales/route.ts` now catches PostgreSQL `23505` unique violation and returns `{ status: 409 }` — sync client already handles this correctly.

### Phase 20a–d: Performance & Offline (complete group)
**20a — Quick Wins:** Supabase browser client cached as module-level singleton. `@zxing/browser` lazy-loaded via dynamic import (~60KB saved from initial bundle). PWA manifest `theme_color` corrected to blue.
**20b — Offline Dedup Safety:** `012_offline_id_unique.sql` partial unique index on `sales.offline_id`. API returns 409 on duplicate. Cleans up existing duplicates.
**20c — Offline Resilience:** IndexedDB v2 with `products` + `cart` stores. Cart crash recovery, sync engine with exponential backoff (1s→16s, max 5 retries), product cache for offline barcode scanning, red banner for failed sales with tap-to-retry.
**20d — Stock Warnings + Dashboard Streaming:** Dashboard split into 6 independent async server components wrapped in `<Suspense>` — each section streams in as its query completes instead of blocking on all 6. Sale page now shows stock warning badges on cart items (red for out/oversell, amber for low stock), toast on low-stock scan, and oversell warning on CartSummary. 6 new files in `src/components/dashboard/`, 3 modified sale components.
