# Movestock — Task Tracking

## Phase 35 — Sales History + Monthly Sales & Profit PDF

Owner-facing reporting layer. Three sub-phases, each shippable independently. **DO NOT auto-start a sub-phase — wait for explicit go-ahead between each one per the Phase Gating rule.**

### Context

- The dashboard's `LatestSales` card ([src/components/dashboard/LatestSales.tsx:33](src/components/dashboard/LatestSales.tsx#L33)) already renders `{sale.teller_name ?? '—'}`. User reports "it does not show the teller's name" — means joined `teller_name` is coming back null for some sales. Most likely legacy sales with `teller_id = null` (the TellerSelector is mandatory on `/sale` now but wasn't always). Need to investigate + fix display.
- `sale_items.unit_cost` is snapshotted at sale time ([Phase 28 — CLAUDE.md](CLAUDE.md)). So per-sale profit = Σ(`(unit_price − unit_cost) × quantity`) for each line item. Works retroactively for sales made after Phase 28.
- Compliance PDF ([src/app/api/reports/compliance-pdf/route.ts](src/app/api/reports/compliance-pdf/route.ts)) is the reference pattern for PDF generation — dynamic `jspdf` + `jspdf-autotable` import inside the route.
- Owners are non-technical. Date picker must be big, obvious, plain-English. No jargon like "date range" — say "Pick a day".

---

### Phase 35a — Sales History Page (daily drill-down) ✅ DONE

**Goal:** owner picks any date, sees every sale for that date with full detail. Lives at `/sales`.

- [x] Decide: "Sales" as 6th BottomNav tab OR linked via a dashboard card. **Dashboard card only.**
- [x] New DB helper `src/lib/db/sales-history.ts` — `listSalesForDate`, `computeSaleProfit`, `computeDailyTotals`.
- [x] New page `src/app/(app)/sales/page.tsx` (client, native date picker, URL state, totals strip, collapsible sale rows).
- [x] New API route `src/app/api/sales/by-date/route.ts` — `GET ?date=YYYY-MM-DD`.
- [x] Dashboard nav card "Sales History" + "See all →" in LatestSales card.
- [x] Wire `useRefetchOnVisible` + `emitDataChanged()` on sale-completion POST for live refresh.
- [x] New `sales` i18n namespace (30 keys) across all 5 locales.
- [x] `'sales'` added to `TranslationNamespace` union + `LanguageProvider` namespaces array.
- [x] Types: `SaleWithDetails`, `SaleItemWithProduct`, `DailySalesTotals`.
- [x] i18n parity test updated (15 → 16 namespaces).
- [x] Typecheck clean, 389 tests pass.

**Acceptance:** open /sales → today's sales appear → pick yesterday → yesterday's sales load → tap a sale → line items with profit visible → all 5 locales render native strings. ✅

**Notes for future sub-phases:**
- LatestSales no longer shows bare `—` for null-teller sales — it renders localised "No teller recorded". Phase 35b can still investigate *why* some sales land with `teller_id = null` (likely legacy + potentially offline-sync edge case) and add a prevention rule.
- Offline sale completion doesn't currently emit `data-changed` (happens via background sync). Low priority — the `visibilitychange` listener catches it anyway.

---

### Phase 35b — Teller Name Display Fix

**Goal:** dashboard `LatestSales` + new /sales page never show a bare `—` for teller — either show the real name or a clear "No teller recorded" fallback. Root-cause investigation first, then fix.

- [ ] Query Supabase REST to check how many sales have `teller_id IS NULL` (service role, read-only):
  `curl -s "$URL/rest/v1/sales?select=id&teller_id=is.null&limit=5"` — if >0, some sales genuinely have no teller.
- [ ] Check whether `src/lib/db/sales.ts` `completeSale` requires teller_id: if optional, leave as-is (owners may sell without selecting a teller in some flows). If mandatory, the null rows are purely legacy.
- [ ] Decision tree:
  - If null-teller rows are legacy only → display "No teller recorded" (i18n `sale_no_teller`) instead of `—`.
  - If new sales are still landing without teller → check `TellerSelector` guard + offline sync path (`src/lib/offline/sync.ts`) — offline sales may be syncing without teller_id. Fix at the write site.
- [ ] Update `LatestSales.tsx`: `{sale.teller_name ?? t('sale_no_teller')}` — pass locale down, import `getServerTranslations` for server component.
- [ ] Update the new /sales page to use the same fallback (/sales is client, so `useTranslation`).
- [ ] Add a brief `tasks/bugs.md` entry documenting the investigation outcome + the prevention rule ("always require teller_id when completing a sale" or "legacy sales will show 'No teller recorded'").

**Acceptance:** no `—` or empty text visible anywhere sales are listed. Null-teller sales render "No teller recorded" in the user's language.

---

### Phase 35c — Monthly Sales & Profit PDF

**Goal:** one downloadable PDF per calendar month covering every sale, profit, and per-teller summary. Same visual style as the compliance PDF so the owner recognises it.

- [ ] New DB helper `src/lib/db/monthly-sales-report.ts`:
  - `getMonthlySalesReport(shopId, year, month)` returns `{ shop, month, sales, perDay, perTeller, totals, profitTrackingEnabled }`.
  - `sales`: array of `{ date, time, teller_name, items: [{ name, qty, unit_price, unit_cost, line_profit }], total, profit }`.
  - `perDay`: array of `{ date, sale_count, revenue, profit }`.
  - `perTeller`: array of `{ teller_name, sale_count, revenue, profit }` — top-of-report summary so owner can see "who sold what".
  - `totals`: `{ total_sales, total_revenue, total_profit, days_with_sales }`.
- [ ] New API route `src/app/api/reports/monthly-sales-pdf/route.ts` — `GET ?year=YYYY&month=MM`. Streams a `Blob` with `Content-Disposition: attachment; filename="movestock-sales-{year}-{month}.pdf"`.
  - Follow compliance-pdf pattern: `const jsPDFMod = (await import('jspdf')).default; const autoTableMod = (await import('jspdf-autotable')).default;` — keeps cold-start lean.
  - Layout:
    1. Header: "Movestock — Sales Report" · shop name · month label (e.g. "April 2026").
    2. Summary box: `Total sales: N · Revenue: R… · Profit: R… · Active days: N/30`.
    3. Per-teller table: Teller · Sales · Revenue · Profit. Sorted by revenue desc.
    4. Per-day table: Date · Weekday · Sales · Revenue · Profit. Chronological. Highlight best/worst day in amber/green.
    5. Detailed sales log: Date · Time · Teller · Items (summarised as "3× Bread, 2× Milk") · Total · Profit. One row per sale, paginated by autoTable.
    6. Footer: "Generated DD MMM YYYY HH:mm · Movestock — Small Business Dashboard"
  - When profit tracking is off, hide profit columns entirely (don't show "—").
- [ ] Button on /sales page: "Download this month's report (PDF)". Also a "Previous month" button (so end-of-April you can grab March's report). Visible on the last day of the month especially (but always available).
- [ ] Subscription gate: same pattern as compliance PDF — if `subscription_status !== 'active'` AND not in trial, return 402. (Check how the compliance PDF handles this.)
- [ ] Test stub `tests/unit/monthly-sales-report.test.ts` — 3–5 unit tests for the aggregation helper (empty month, mixed profit-tracked and untracked items, per-teller roll-up).
- [ ] 3 new i18n keys in `sales.json`: `download_pdf_btn`, `download_pdf_prev_month_btn`, `download_pdf_generating`. (Button labels — PDF body itself is English-only, matches compliance PDF precedent.)

**Acceptance:** download button produces a PDF that opens in any mobile PDF viewer, totals match the /sales page when summed across the month, profit ties out to `Σ((unit_price - unit_cost) × qty)` across all line items for sales in that month.

---

## Phase Completion Protocol Reminder

After each sub-phase (35a, 35b, 35c): run the full protocol in CLAUDE.md — Glob, file-tree diff, Living Scope check-off, "What was built" note, commit, push, checklist output. **STOP** after each — wait for user to say "start 35b" / "start 35c".

---

Phases 1–34b + recent UX Tweaks complete. See [ARCHIVE.md](../ARCHIVE.md) for detailed phase summaries.
