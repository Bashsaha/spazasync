# Movestock — Task Tracking

## Phase 44 — App Shell Architecture / instant-open PWA (IN PROGRESS)

> **New-chat: read this whole section before continuing.** It is the source of
> truth for what's done, what's left, and HOW to do the rest. Phase 44 makes the
> app open instantly and fixes the resume-from-background crash. It is split into
> 44a (foundation — DONE) and 44b (per-screen cache-first rollout — IN PROGRESS).

### Context / why
Users reported: (1) ~15s cold open, (2) "we ran into a problem" on resume from
background, (3) tab won't load after backgrounding, (4) checklist intro fired at
random. Root cause of 1–3: every page was server-rendered with the user's data,
so every open/resume/navigation blocked on the network (auth + DB) before
painting. The fix is the Instagram/Twitter-Lite pattern: paint instantly from a
device-cached snapshot, revalidate in the background.

### Environment facts (already true — don't redo)
- **Asymmetric JWT signing keys ARE enabled** in Supabase (Current key = ECC
  P-256), so `getClaims()` verifies the JWT locally with NO network call. This is
  what makes the 44a resume fix fully effective.
- Every code-shipping commit MUST bump `CACHE` in [public/sw.js](public/sw.js)
  (currently **v72**). One bump per batch is fine.
- 44a/44b so far added NO DB migration and NO new i18n keys.

---

### 44a — Foundation (DONE — commit 5aa6fba)
- `getUser()` → `getClaims()` via [src/lib/auth/claims.ts](src/lib/auth/claims.ts)
  `getAuthClaims()` (local verify + degrade to local session on a blip) in the
  [(app) layout](src/app/(app)/layout.tsx) and [dashboard](src/app/(app)/dashboard/page.tsx).
- [src/components/ResumeGuard.tsx](src/components/ResumeGuard.tsx) (mounted in the
  app layout): on resume → probe `/manifest.json` → refresh session if near
  expiry → emit `RESUME_READY` ([src/lib/events.ts](src/lib/events.ts)).
- [useRefetchOnVisible](src/hooks/useRefetchOnVisible.ts) now revalidates on
  `RESUME_READY` (not raw visibility), so refresh never fires into a dead radio.
- Degrade-don't-crash: [getShopForRequest](src/lib/db/shop.ts) catches network
  rejection → null; layout tellers read degrades to a nameless shell.
- `experimental.staleTimes.dynamic = 30` in [next.config.ts](next.config.ts).
- 44c checklist intro: `everCompleted` server fact (hasAnyChecklist) gates the
  intro in [ChecklistReminderFab](src/components/ChecklistReminderFab.tsx).
- Logged as **BUG-049** in tasks/bugs.md. **Verified on a real phone by the user:
  resume crash gone, login works, slightly faster.**

---

### 44b — Per-screen cache-first rollout (IN PROGRESS)

**The engine:** [src/hooks/useCachedData.ts](src/hooks/useCachedData.ts) —
`useCachedData<T>(key, fetcher)` returns `{ data, loading, error, refresh }`.
Paints instantly from a `localStorage` snapshot, revalidates in the background,
re-fetches on `RESUME_READY` + `DATA_CHANGED`. `error` is true ONLY when there is
no cached data to show.

#### THE RECIPE — how to convert a simple client read-list page (follow exactly)
This is the mechanical transform used for every page below. Example diff shape:
1. Imports: remove `useCallback`/`useRefetchOnVisible` (and `useEffect`/`useState`
   if they become unused); add `import { useCachedData } from '@/hooks/useCachedData'`.
2. Replace the `const [data,setData]/[loading]/[errorKey]` + `loadX` callback +
   `useEffect(loadX)` + `useRefetchOnVisible(loadX)` block with:
   ```ts
   const { data, loading, error } = useCachedData<RespType>('unique-key', () =>
     fetch('/api/...', { cache: 'no-store' }).then((r) => {
       if (!r.ok) throw new Error('load failed')
       return r.json() as Promise<RespType>
     }),
   )
   const rows = data?.rows ?? []   // derive the fields the page read before
   ```
3. **Cache key** must be unique per dataset; **include query params that change
   the result** (e.g. `` `sales-by-date:${date}` ``, `` `sales-stats:${from}:${to}` ``).
4. Replace `errorKey`/`t(errorKey)` render refs with `error`/`t('error_load')`
   (use the namespace's existing load-error key — grep the file for which one).
5. Keep purely-local UI state (search text, expanded rows, tab, scanning).
6. **Mutations on a converted page** (delete/deactivate): DROP the optimistic
   `setRows(prev => ...)` (the hook owns `data`) and instead call
   `emitDataChanged()` after the successful write — the hook re-fetches and the
   row disappears. (See waste-pest/pest + how tellers should be done.)
7. If a derived empty array feeds a `useMemo` dep, use a module-level
   `const EMPTY: T[] = []` to keep the reference stable (see documents page).
8. Verify: `npx tsc --noEmit` → `npx vitest run` → `npx next build`; bump sw.js
   CACHE; commit `feat: Phase 44b batch N — <pages>`; push.

#### DONE (cache-first)
- Pre-existing: **sale** (useActiveTeller + cached picker), **settings** (own snapshot).
- Batch 1 (commit fad7a73): **stock**, **expiry**, **suppliers**.
- Batch 2 (commit cc4fb1e): **documents**, **checklist/history**,
  **sales/history** (date in key), **waste-pest/pest** (delete via emitDataChanged).
- Batch 3 (dashboard summary): **dashboard Today + Low-stock + Expiring cards**.
  New client `DashboardSummaryCards` reads one cached snapshot of
  `GET /api/summary/daily` (`'dashboard-summary'` key) and renders all three cards
  — replaced three Suspense-wrapped server components, one fetch not three. The
  Today card JSX was extracted into a shared presentational client view
  [TodaySummaryView](src/components/dashboard/TodaySummaryView.tsx) so the
  /sales hub (still server-streamed via [TodaySummary](src/components/dashboard/TodaySummary.tsx))
  and the cache-first dashboard share one markup. Deleted the now-dead
  LowStockAlert + ExpiringAlert server components. ComplianceCard,
  JourneyProgressCard, LatestSales, the onboarding modal, the subscription
  banner, and the DashboardAutoRefresh realtime path are untouched. SW v72→v73.
  **Phone-test still pending (user):** cold open + resume → the three cards paint
  instantly from cache, no spinner on the 2nd open.

- **Resume-navigation stall fix (BUG-050)** — the big lever: `staleTimes.dynamic`
  30→1800 + `static` 180→1800 in next.config.ts, so an already-visited tab
  repaints INSTANTLY from the in-memory Router Cache on resume (no RSC fetch into
  a sleeping radio). This made the remaining per-page conversions largely
  redundant for the "instant repeat-open" goal — they were finished anyway for
  cross-app-kill persistent data + cleaner freshness. SW v73→v74.
- Batch 4a (commit ba98de2): **products list** (search now client-side, debounced
  into the key) + **products/missing-cost** + **products/missing-supplier**.
  Shared [ProductListRow](src/components/products/ProductListRow.tsx); banners +
  profit flag from SW-cached `/api/settings`. SW v74→v75.
- Batch 4b (commit 6c4ffb9): **inventory hub** count strip (new
  `GET /api/inventory/summary`; page stays server for role-gating + tiles),
  **waste-pest hub** (status pills client-side from `/api/pest-control` +
  `/api/waste-management`), **stock-take/history** (new owner/admin
  `GET /api/stock-take/history`). SW v75→v76.
- Batch 5 (commit 461fde4): **tellers** (one cached `{tellers,grants}`; optimistic
  deactivate/revoke → `emitDataChanged()`), **suppliers/assign** (list cache-first,
  selection local), **sales/statistics** + **stock-take/loss** (date range in key).
  SW v76→v77.

#### Intentionally LEFT server-rendered (justified — not skipped by omission)
The `staleTimes` fix already makes every visited tab repaint instantly on resume,
so these were left server-rendered rather than risk regressing working/launch-
critical UI for a now-redundant data-paint gain:
- **manage hub** + **profile** — static-link menus (no data list); instant once
  the shell loads.
- **sales hub** — recharts-driven, already streams via Suspense; converting
  charts to cache-first is high-risk, low-value.
- **inspection / compliance/journey / compliance/fund** — engine/score-ring driven
  compliance UI (launch-critical); high conversion risk, low-frequency screens.
- **stock-take** — HEAVY local state (per-row typed counts + realtime products
  subscription + loss-reason pickers); realtime already keeps it fresh, and a
  background cache-first refresh could clobber typed-in counts.
- **Detail / prefilled-form pages** (stock/[id], products/[id], suppliers/[id],
  documents/[type]) — forms, not list reads; instant once the shell loads.
- **waste-pest/waste** — config FORM (formTouchedRef concern).
- **/admin/\*** — operator-only, not customer-facing.

### Phase completion — DONE (2026-06-01)
- All clean read-list pages are cache-first; the resume-navigation stall (BUG-050)
  is fixed at the Router-Cache level. File tree + Living Scope updated in CLAUDE.md.
- **Final real-phone pass still owed by user:** open every converted tab twice
  (2nd open instant), background 5+ min → resume → tap tabs (no 2–3 min stall),
  owner AND teller login.

### Verify (every batch)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green (780 baseline)
- [ ] `npx next build` clean
- [ ] bump `public/sw.js` CACHE
- [ ] commit `feat: Phase 44b batch N — <pages>` + push
- [ ] (user) phone-test the batch
