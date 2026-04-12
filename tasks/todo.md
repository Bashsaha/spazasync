# SpazaSync — Task Tracking

## Phase 27c: Translate Core Pages (Sale + Dashboard + Stock + Summary)

Phase 27c was split into 3 sub-phases mid-implementation to avoid context-limit issues. Sub-phase 27c.1 shipped. 27c.2 and 27c.3 are the remaining work.

### Phase 27c.1 — Sale flow + stock list ✅ DONE
- [x] Expand `src/app/(app)/layout.tsx` LanguageProvider namespaces to include sale/dashboard/stock/summary
- [x] Add 7 new keys to `en/sale.json` (cart_each, cart_badge_out_of_stock, cart_badge_only_left, cart_badge_low_stock, cart_decrease_qty, cart_increase_qty, error_product_name_exists)
- [x] Translate `src/app/(app)/sale/page.tsx`
- [x] Translate `src/app/(app)/sale/complete/page.tsx`
- [x] Translate `src/components/sale/TellerSelector.tsx`
- [x] Translate `src/components/sale/CartItem.tsx` (add 'use client')
- [x] Translate `src/components/sale/CartSummary.tsx` (add 'use client')
- [x] Translate `src/components/sale/NewProductModal.tsx`
- [x] Translate `src/components/sale/ProductPicker.tsx`
- [x] Translate `src/app/(app)/stock/page.tsx` (errorKey refactor to keep error text locale-reactive)

### Phase 27c.2 — Remaining client + server pages
- [ ] Translate `src/app/(app)/stock/[id]/page.tsx` (complex — adjust mode toggle, REASONS array, expiry batches, success screen, ConfirmModal strings; review `en/stock.json` for missing keys first)
- [ ] Translate `src/app/(app)/stock-take/page.tsx`
- [ ] Translate `src/components/BottomNav.tsx` (common.json nav_* keys — verify owner tab labels)
- [ ] Translate `src/components/OfflineBanner.tsx` (common.json offline_banner_* keys)
- [ ] Translate `src/components/DailySummaryAlert.tsx` (summary.json)
- [ ] Dashboard server components — pattern: parent `src/app/(app)/dashboard/page.tsx` calls `getServerLocale()` and passes `locale` prop down; each child calls `getServerTranslations(locale, ['dashboard'])`
  - [ ] `src/app/(app)/dashboard/page.tsx`
  - [ ] `src/components/dashboard/TodaySummary.tsx`
  - [ ] `src/components/dashboard/LowStockAlert.tsx`
  - [ ] `src/components/dashboard/ExpiringAlert.tsx`
  - [ ] `src/components/dashboard/WeeklyChartSection.tsx`
  - [ ] `src/components/dashboard/TopProducts.tsx`
  - [ ] `src/components/dashboard/LatestSales.tsx`

### Phase 27c.3 — Publish 4 × 4 translation JSONs
- [ ] `src/lib/i18n/translations/{so,am,zu,ur}/sale.json` (mirror en/sale.json keys exactly — include the 7 new cart/error keys from 27c.1)
- [ ] `src/lib/i18n/translations/{so,am,zu,ur}/dashboard.json`
- [ ] `src/lib/i18n/translations/{so,am,zu,ur}/stock.json`
- [ ] `src/lib/i18n/translations/{so,am,zu,ur}/summary.json`
- [ ] Verify: `tsc --noEmit` + `vitest run` pass
- [ ] Manual smoke: switch language in /settings for each locale → reload → verify no English leakage on /sale, /dashboard, /stock, /stock-take, DailySummaryAlert
- [ ] Phase Completion Protocol (glob, file tree, Living Scope, commit, push, checklist)

### Plan reference
Full plan in `C:\Users\Gaming PC\.claude\plans\frolicking-orbiting-blum.md`. Key gotchas:
- Use `tPlural(key, count, { count })` for `_one` / `_other` plural keys — don't hardcode the suffix.
- Error state pattern: store `errorKey` string, call `t(errorKey)` at render time (NOT `setError(t('...'))`) so error text updates when user switches locale.
- Map param collisions: watch for `(...).map((t) => ...)` shadowing the `useTranslation` hook's `t`. Rename to `tabId` or similar.
- `en/stock.json` may not have keys for the `/stock/[id]` adjust page (Add Stock / Remove Stock / REASONS / expiry labels) — add any missing keys to all 5 locales.

---

Phases 1–26, 27a, 27b complete. See [todo-archive.md](todo-archive.md) for detailed task lists and reviews.
