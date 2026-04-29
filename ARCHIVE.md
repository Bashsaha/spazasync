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

### Phase 21: UX Polish — Plain English & Non-Technical Users
Renamed BottomNav "Tellers" → "Staff", "Stock Take" → "Count Stock". Dashboard "Shop code:" relabeled "Staff login code: (give this to your staff)". Expiry page got inline "Remove expired stock" button (links to `/stock/[id]?mode=remove&qty=N`) and "Manage stock" replacing tiny link; stock adjust page reads URL params to pre-fill Remove mode + qty (Suspense-wrapped for `useSearchParams`). Reason labels rewritten plain English. Compliance Report card moved to top of Settings + new "Inspector coming?" dashboard card.

### Phase 22: Smart Catalog Import + Top Sellers in Sale
Products page: "Import from catalog" bottom-sheet → navigates to `/products/new` with name + barcode pre-filled (price still mandatory). Sale ProductPicker shows "Top sellers" section above "All products" (top 10 by qty sold last 30 days). New routes: `/api/catalog/importable`, `/api/products/bulk-import`, `/api/products/popular`. New component `CatalogImportSheet.tsx`. No migration.

### Phase 23: Barcode Scan Buttons — Products & Stock Pages
"Scan" buttons added to Products header (→ edit existing or add new with barcode + catalog name pre-filled), Add Product page (next to barcode input), and Stock header (→ adjust page or toast error if not found). New `BarcodeScanButton.tsx` self-contained client component for use in server-rendered pages. Reuses existing `BarcodeScanner` + `/api/products?barcode=`.

### Phase 24: Performance + Offline Hardening
IndexedDB v3: added `settings` + `tellers` stores, 30-min product cache TTL. Service Worker v2: precaches app shell (`/sale`, `/login`, `/dashboard`, `/offline.html`); SW update notification banner. Sale page uses cached `low_stock_threshold` before network. TellerSelector falls back to IndexedDB. Online sale POST failures auto-queue offline (no data loss). ProductPicker warns when using stale offline cache. jspdf dynamic import in compliance PDF route. New file `public/offline.html`. No migrations.

### UX Tweak: Floating "Start Sale" FAB
Blue floating action button bottom-right on all pages except `/sale`, positioned above BottomNav, hidden for tellers. Modified BottomNav.tsx only.

### Phase 25: Secure External API for Business Portal
Bearer token auth via `EXTERNAL_API_KEY` env var (server-to-server, same pattern as cron). Auth guard `src/lib/auth/external-api-guard.ts`. `/api/external` added to PUBLIC_ROUTES (Bearer auth bypasses cookie session). Rate limited 60 req/min per IP. 6 read-only GET endpoints under `/api/external/v1/`: overview, shops list/detail, shops/:id/sales, /stock, /expiry. Reuses admin client + existing reports.ts helpers. New `ShopProduct` type. No migrations.

### Phase 26: In-App Daily Summary (Replace WhatsApp)
Removed all WhatsApp/Twilio code (deleted `src/lib/whatsapp/`, daily-summary cron, twilio dep, WhatsApp fields from onboarding/settings/schemas/env/vercel.json). New `GET /api/summary/daily` (auth via `getShopAuth()`). New `DailySummaryAlert.tsx` — 9pm SAST localStorage-tracked slide-down banner → modal with revenue, top sellers, low stock, expiring (hidden for tellers). `shops.whatsapp_number` column kept nullable.

### Phase 27a–e: Internationalization (complete group)
**27a — Infrastructure:** Custom lightweight i18n — JSON namespace files + React Context (`LanguageProvider`) + `t()`/`tPlural()` helpers. New `src/lib/i18n/` (types, interpolate, loader with English fallback, server.ts). Migration `013_shop_language.sql` — `shops.language` (TEXT, default 'en', CHECK en/so/am/zu/ur). 10 English namespace JSONs. Updated types, Zod schemas, settings/onboarding APIs, IndexedDB cache. LanguageProvider wired into `(app)/layout.tsx`. No UI changes yet.
**27b — Selection UI + Auth:** New `LanguagePicker.tsx` (full + compact variants). New `(auth)/layout.tsx` wraps auth pages in LanguageProvider. Onboarding gained 'language' step before signup. Login + Settings translated; Settings auto-PATCH on language change. 8 new JSONs ({so,am,zu,ur}/common+auth).
**27c — Core Pages:** Translated sale flow (TellerSelector, NewProductModal, ProductPicker, CartItem, CartSummary), stock list + adjust + stock-take pages, BottomNav (`labelKey`), OfflineBanner (4 plural variants), DailySummaryAlert, dashboard tree (parent `getServerLocale()` once, children parallelize data + `getServerTranslations()` via `Promise.all`). Introduced `errorKey`/`errorRaw` state pattern so errors re-render on locale change. Plural suffix contract `_one`/`_other`. Published 16 JSONs.
**27d — Remaining Pages + RTL:** Translated products (new/edit), tellers (renamed shadowing `t` map var → `teller`), subscribe (features `.map()` over key array), settings (`statusLabel()` helper + `message: { type; key?; raw? }`), expiry (extracted `useRelativeExpiryLabel()` hook closing over `t`/`tPlural`/`locale`; `groupColors` keyed by `labelKey`), `ExpiryEntryList`, `CatalogImportSheet`, `BarcodeScanButton`, `(app)/error.tsx`. Server components: `products/page.tsx` + `not-found.tsx` use `Promise.all` pattern. `(app)/layout.tsx` preloads all 9 namespaces. `dir="rtl"` set by LanguageProvider for Urdu (deep `ml-`/`mr-` → `ms-`/`me-` audit deferred). Global `error.tsx` left in English as defensive fallback. 16 more JSONs published. Compliance PDF stays English-only (regulatory).
**27e — Polish, Fonts, Offline, Tests:** `next/font/google` self-hosts Noto Sans Ethiopic + Noto Nastaliq Urdu under `/_next/static/media/` (covered by SW cache-first handler — no `/public/fonts/` needed). `globals.css` applies via `:lang(am)`/`:lang(ur)`. SW cache bumped to v3, `/settings` precached. English fallback in `loader.ts:29-36`. New `tests/unit/i18n.test.ts` (97 tests) covers `t()`, `tPlural()`, and key/placeholder completeness for every non-en locale × namespace — caught missing keys in `am`/`ur`/`zu` common.json (Phase 27d keys) and `zu` missing the `_one`/`_other` plural split. Verification: tsc clean, vitest 253/253 green, next build succeeds.

### Phase 28: Profit Tracking (2026-04-15)
Migration `014_profit_tracking.sql` — opt-in `shops.profit_tracking_enabled` toggle + `products.cost_price` + `sale_items.unit_cost` snapshot. When on: cost required on product create/edit; profit `(unit_price - unit_cost) * qty` surfaces on TodaySummary (swap Tellers → Profit) and DailySummaryAlert. Cost snapshotted at sale time so historical profit is immune to later edits. New `tests/unit/profit.test.ts` (19 tests). i18n parity across 5 locales. Rule 8 (i18n Coverage) added.

### Phase 29: Profit Tracking UX — Missing Cost Price Alerts (2026-04-17)
Amber alert banners on Stock, Count Stock, and Daily Summary modal when profit tracking is on and products lack cost prices, each linking to Products page. Settings missing-cost count auto-refreshes via `visibilitychange`. Stock + Daily Summary APIs extended with `profit_tracking_enabled` + `products_missing_cost`. No new files or migrations.

### Phase 30a–c: Suppliers + Traceability (complete group)
**30a — Supplier Directory:** Migration `015_suppliers.sql` (RLS via `user_in_shop`, case-insensitive unique name per shop). New `/suppliers` section, full CRUD API, new `suppliers` i18n namespace. Surfaced via emerald Settings card (not BottomNav — 6 max).
**30b — Traceability:** Migration `016_goods_received.sql` adds `products.supplier_id` (nullable FK ON DELETE SET NULL) + `goods_received` audit table (text-only, no photos — Supabase Storage cost stance). Optional Supplier dropdown on product forms; Stock Add mode pre-fills last supplier and POSTs goods-received on adjust.
**30c — Compliance PDF Section:** Compliance PDF gains "4. Supplier Traceability Report" — Supplier Directory + 30-day Goods Received table. PDF stays English-only (regulatory). No new files.

### Phase 31: Daily Compliance Checklist (2026-04-19)
Migration `017_daily_checklists.sql` — `daily_checklists` (UPSERT per shop per date) + `shops.has_fridge`/`has_freezer`. New `/checklist` + `/checklist/history` pages, `ChecklistStatus` server component on dashboard (green pill / blue prompt / amber reminder via 10 AM SAST cutoff). Compliance PDF gains Section 5 (30-day gap-filled log). New `checklist` i18n namespace + pure helpers in `src/lib/checklist/stats.ts`. Decision: in-app reminder only (no Web Push, avoids VAPID infra).

### Phase 32: Business Compliance Profile (2026-04-21)
Migration `018_business_documents.sql` — `business_documents` (UNIQUE(shop_id, document_type), upsert pattern). New `/documents` hub + adaptive per-type edit forms (5 SA compliance docs: Municipal/CoA/CIPC/Business License/Owner ID). Pure helper `src/lib/compliance/document-status.ts` powers traffic-light badge (red expired, amber expiring ≤30d / 60d for permits, green valid, grey empty). New `DocumentComplianceStatus` dashboard server component, Settings card, Compliance PDF Section 6. Decisions: text-only (no photos, POPIA + cost), SA-citizen ID stored as boolean only (no digits).

### Phase 33: Waste Management & Pest Control Log (2026-04-22)
Migration `019_waste_pest.sql` — `daily_checklists.waste_bins_ok` column + `pest_control_logs` (multi-row visit log) + `waste_management` (singleton with `last_confirmed_date` for monthly stamp). New `/waste-pest` hub + `/pest` + `/waste` sub-pages. Pure helpers in `src/lib/compliance/waste-pest-status.ts` (90-day pest threshold, 30-day waste staleness). Two new dashboard reminder components, Compliance PDF Section 7. New `waste-pest` i18n namespace.

### Phase 34a: Compliance Score & Inspection Readiness (2026-04-22)
**No migrations** — pure composition over Phases 17–33. New pure helper `src/lib/compliance/score.ts` (`computeComplianceScore`, weights checklist 25 + expiry 20 + suppliers 20 + documents 20 + waste/pest 15, bands green ≥80 / amber ≥50 / red <50). New `/inspection` page (score badge + 7-row pre-check + Download PDF). `ComplianceScoreCard` injected at top of dashboard. `MonthlyComplianceAlert` once-per-month modal (mirrors Phase 26 pattern — no WhatsApp). Compliance PDF gains Section 1 (score) — existing sections renumbered. New `inspection` i18n namespace.

### Phase 34b: SpazaSync → Movestock Rebrand (2026-04-23)
Pure text replacement — no behavioural changes. PWA manifest, page titles, login/onboarding h1, AdminNav, PayFast item_name, Compliance PDF footer, package.json, README, all 5 locales. SW cache bumped to `movestock-v1` (clean refresh acceptable on rebrand). **Intentionally NOT renamed** (commented in code): `spazasync.app` synthetic teller email domain, IndexedDB `DB_NAME = 'spazasync'`, localStorage `spazasync_lang` — renaming would invalidate live accounts / lose offline data / reset language settings.

### UX Tweak — ConfirmModal i18n + Onboarding Polish (2026-04-23)
Three real fixes: (1) `ConfirmModal.tsx` had hardcoded English `Cancel`/`Confirm` — refactored to use `useTranslation('common')`; all 5 callers needed no changes. (2) Onboarding tap-to-copy shop code button (silent fail if clipboard blocked). (3) Tellers empty-state hint added. New i18n keys across 5 locales.

### UX Tweak — Auto-Suggests & Smart Defaults (2026-04-23)
Sale page scan-button spinner; `+5` quick-tap on CartItem; "In your cart" pinned section + clear-search in ProductPicker; spinner SVG in NewProductModal; stock adjust pre-fills today's date in expiry rows; stock-take "{counted} of {total}" + "All correct" one-tap mark-all button; checklist API returns `previousTemps` from most recent past row to pre-fill fridge/freezer inputs. 7 new i18n keys across 5 locales.

### UX Tweak — Inline "Add supplier" modal (2026-04-24)
New `NewSupplierModal.tsx` bottom-sheet wired into `stock/[id]`, `products/new`, `products/[id]`. Fixes broken mid-flow where "Manage suppliers" link dumped users to `/suppliers` whose back-button hardcoded to `/settings`. On save, supplier pushed into local state (sorted) and auto-selected. One new i18n key across 5 locales; modal reuses existing `suppliers` namespace.

### UX Tweak — Auto-refresh lists + filtered missing-cost view (2026-04-24)
(1) `/products?missing_cost=1` filtered view — `listProducts(search, { missingCost })`. All four "missing cost" banners now link to filter. Amber banner + "Show only missing" toggle + "No cost" pill on rows; green "all done" empty state. (2) New `src/hooks/useRefetchOnVisible.ts` (visibilitychange + focus + pageshow + custom `movestock:data-changed` event) + `src/lib/events.ts` `emitDataChanged()`. Wired into 7 list pages and all relevant mutation handlers. `cache: 'no-store'` + `router.refresh()` on product mutations. 7 new i18n keys.

### Phase 35a–c: Sales History (complete group)
**35a — Sales History Page:** New `/sales` (now `/sales/history` after Phase 36a) with date picker, prev/next-day, drill-down per sale (line items + profit). Pure `computeSaleProfit(items)` returns null when ANY line lacks `unit_cost` (propagates to daily totals). New `src/lib/db/sales-history.ts`, `GET /api/sales/by-date`. New `sales` i18n namespace. **No migration** — derived from existing tables.
**35b — Teller Name Display + gate hardening:** Supabase REST audit found 12 historical null-teller rows (online path, 2026-03-24 → 2026-04-24). Added second gate at sale page for `role === 'teller' && !activeTeller` (block UI with localised "sign out and back in" message). Schema kept nullable on purpose — offline-queue replay needs it. BUG-016 logged.
**35c — Monthly Sales & Profit PDF:** New `src/lib/db/monthly-sales-report.ts` (`getMonthlySalesReport` + pure `aggregateMonthlyReport`) — null-cost propagation matches daily helper. `GET /api/reports/monthly-sales-pdf?year=YYYY&month=MM` (jspdf dynamic import, role guard). PDF: summary + per-teller + per-day + all-sales detail. Profit columns hidden when tracking off. PDF body English-only (matches compliance PDF precedent). 5 new i18n keys for buttons.

### UX Tweak — Owner teller auto-select on /sale (2026-04-25)
Onboarding already auto-creates teller row for owner with `user_id = auth.user.id`, but `useActiveTeller` never auto-selected it — owners had to tap their own name every session. Two-part fix: (1) extended owner branch in `useActiveTeller.ts` to fetch `/api/tellers` and auto-select matching `user_id`. (2) Submit-time guard in sale page reshows "Select who is serving" if `activeTeller` is null at POST time. No new i18n keys, no migration.

### Phase 36a–c: Navigation Restructure + Switch User + Access Requests (complete group)
**36a — Navigation Restructure:** No schema. **5-tab BottomNav** (was 6 + 9 duplicate dashboard cards): Home / Sales / Inventory / Manage / Settings. Extended FAB ("🛒 New Sale" pill, was plain `+`). New unified `ComplianceCard.tsx` replaces 5 separate dashboard alerts (alerts state OR all-clear+PDF link, both link to `/inspection`). New `/inventory` + `/manage` hubs. `/sales` rewritten as hub (drill-down moved to `/sales/history`). Dashboard slimmed to 5 informational cards. Proxy bug fix — `pathname.startsWith('/sale')` was matching new `/sales` hub; tightened to exact-match. Two new i18n namespaces (`inventory`, `manage`); `dashboard.json` rewritten in 5 locales (16 card_* keys removed, 10 unified compliance keys added).
**36b — Switch User:** No schema. New sticky `TopAppBar.tsx` on every authenticated page (shop name + avatar dropdown with "Switch user" → `signOut()` + `/login`). New `src/lib/auth/recent-users.ts` localStorage helper (up to 3 entries, **never password**). New `RecentUsersRow` on `/login` — tappable chips prefill non-secret fields, password always re-typed. Login state lifted to `LoginPage` so chips can prefill. Onboarding records new owner. 5 new i18n keys.
**36c — Teller Access Requests + Realtime:** Migration `020_access_requests.sql` — `access_requests` table (status pending/granted/denied/revoked/expired, `expires_at`) + RLS + `ALTER PUBLICATION supabase_realtime ADD TABLE access_requests`. **Tellers default to bare-minimum** (sales only) and request inventory access; auto-expires after 4h (checked at read time, no cron). Proxy rewrite: two lists (`TELLER_ALWAYS_ALLOWED` + `TELLER_GRANTED_ONLY`); `/inventory` always reachable so request UI works. New `NotificationBell.tsx` — Supabase JS Realtime channel on `access_requests` filtered by `shop_id`, refetches pending list on any INSERT/UPDATE; bell + Grant/Deny modal in TopAppBar (owner/admin only). Tellers get 2-tab BottomNav (🧾 Sales + 📦 Inventory) for the first time. New `TellerAccessRequestPanel` on `/inventory` for ungranted tellers. `/tellers` page gains "Active access" section with revoke button. Decisions: realtime over polling (zero Vercel invocations), `resolved_by` is free UUID not FK (avoids RLS complications), tellers get same 5 inventory tiles as owners (per-action gating deferred). 3 new i18n key sets across `inventory`/`manage`/`tellers`.

