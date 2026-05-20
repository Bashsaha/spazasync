# Movestock — Task Tracking

## Phase 42 — Sales Statistics (COMPLETE — 2026-05-20, 679/679 tests, tsc + build clean)

A new owner-facing analytics page inside the Sales tab: pick a date range, see a
sales graph, top sellers, lowest sellers, **most profitable products**, and
**non-movers** (products that have stock but sold nothing in the period).
"Corporate-grade reporting, for SMEs."

**Decisions locked with user:** rank top/lowest **by units sold** (revenue shown
on each row too); **include a PDF export** (corporate-style report).

### Scope
- Route: `/sales/statistics` — owner + dual-role admin only (tellers blocked,
  same as stock-loss / reports). Linked from the `/sales` hub as a card.
- Date range: 7d / 30d / 90d / custom presets (mirror `/stock-take/loss`).
- Profit numbers shown only when `shops.profit_tracking_enabled` (app-wide rule).
- No DB migration — reads existing `sales`, `sale_items`, `products`.

### Files to CREATE
- [ ] `src/lib/db/sales-statistics.ts`
  - Pure `shapeSalesStatistics(sales, saleItems, products, fromIso, toIso, profitOn)`:
    - aggregate units + revenue (+ profit when unit_cost present) per product
      → `ProductMovement { product_id, name, units_sold, revenue, profit|null }`
    - **trend buckets**: daily when range ≤ 31 days, else weekly (adaptive so the
      bar chart stays readable on a phone); reuses the `WeeklyDataPoint` shape
      `{ label, date, revenue, salesCount }`
    - **top_sellers**: top 10 products by units sold (desc)
    - **lowest_sellers**: bottom 10 by units sold among products with ≥1 unit sold
    - **top_profit**: top 10 by total profit (desc), among products with a known
      profit (cost_price set). Empty when profit tracking is off — section hidden.
    - **non_movers**: products with `stock_qty > 0` AND zero units sold in period
      AND `created_at <= range end` (so a product added after the range isn't
      flagged); sorted by stock_qty desc
    - totals: sales_count, units_sold, revenue, avg_sale_value, profit|null,
      products_missing_cost (so the page can nudge when profit ranking is partial)
  - `getSalesStatistics(shopId, fromIso, toIso, profitOn)` — fetcher using the
    admin client scoped by shopId (mirrors `lib/db/reports.ts`).
- [ ] `src/app/api/sales/statistics/route.ts` — `GET ?from&to`, owner/admin guard,
  date validation, returns JSON. Mirrors `src/app/api/stock-loss/route.ts`
  (incl. the SAST-day → UTC bound helper).
- [ ] `src/app/api/reports/sales-statistics-pdf/route.ts` — owner/admin PDF using
  `lib/pdf/shared.ts`: header (shop + range), summary, top-sellers table,
  lowest-sellers table, most-profitable table (only when profit on), non-movers
  table. Mirrors `stock-loss-pdf`.
- [ ] `src/app/(app)/sales/statistics/page.tsx` — client page (mirror stock-loss):
  BackButton→/sales, date-range card, summary tiles, trend chart, the four lists
  (top sellers, lowest sellers, most profitable [profit-on only], non-movers),
  PDF download button, loading/error/empty states. Reuses `WeeklySalesChart`,
  `PdfDownloadButton`, `useRefetchOnVisible`.
- [ ] `src/lib/i18n/translations/{en,so,am,zu,ur}/sales-statistics.json` (~35 keys).
  Non-EN: native for so/zu, simple native for am/ur, mirroring EN per precedent.
- [ ] `tests/unit/sales-statistics.test.ts` — covers units & profit ranking,
  non-mover detection (stock>0 & unsold; excludes zero-stock unsold and
  after-range products), daily↔weekly bucket boundary, profit with/without cost
  (products missing cost excluded from profit ranking), 2dp rounding.

### Files to EDIT
- [ ] `src/app/(app)/sales/page.tsx` — add a "Sales statistics" LinkCard.
- [ ] `src/lib/i18n/types.ts` — add `'sales-statistics'` to the union + count note.
- [ ] `src/app/(app)/layout.tsx` — add `'sales-statistics'` to `APP_SHELL_NAMESPACES`
  so the client page has its strings on first paint.
- [ ] `tests/unit/i18n.test.ts` — bump 23 → 24 (namespace list + loader `toBe(24)`).
- [ ] `public/sw.js` — cache bump v38 → v39.
- [ ] `CLAUDE.md` — file tree, Living Scope (Phase 42 note), i18n namespace count 23→24.

### Verify
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green (incl. new + i18n parity)
- [ ] Phase Completion Protocol (Glob scan → tree → Living Scope → commit → push → checklist)

### Out of scope (call out, don't build)
- Per-teller breakdowns, category analytics, profit-margin charts, CSV export.
- No changes to compliance copy → no `compliance-facts-audit.md` update needed.
