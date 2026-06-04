# Movestock — Task Tracking

## CURRENT WORK — Post-Phase-45 scale + security hardening (2026-06-04)

> **New-chat: read this whole section first.** Source of truth for the in-flight
> work. Driven by the owner asking whether converting the rest of the app to
> client cache-first helps scale to ~100k users, what it costs on Vercel/Supabase,
> and whether any of it creates security holes. A 3-agent research pass (Vercel
> economics, Supabase economics/scaling, codebase rendering inventory) produced
> the verdict + plan below. Already shipped separately: **BUG-052** cluster
> (notification portal, per-user chrome mirror, checklist timeout/per-day key,
> `/sales` → `getShopAuthFast`) — committed `46dcf43`, SW v84.

### Research verdict (why we are NOT converting everything)
- **Client cache-first is a UX + repeat-read + egress optimization, NOT the lever
  that decides whether 100k users works.** On Vercel it saves nothing on a cold
  first load (extra `/api` + `_rsc` round-trip ≈ same/one-more invocation); the
  ONLY win is the service worker serving REPEAT opens off-device (also skipping
  `proxy.ts`, which Next 16 bills as a full Node function). On Supabase it removes
  ~50–80% of repeat-read COUNT + some egress, but only ~10–20% of the PEAK CPU
  that actually sets the compute tier.
- **The real 100k ceiling = Supabase compute CPU at peak (writes+RLS+aggregates)
  + connection discipline + realtime.** The biggest wins are already done (Phase
  45: Broadcast realtime, set-membership RLS, atomic `complete_sale`, `getClaims`
  local JWT, composite indexes, cold-archive). Cache-first ranks BELOW all of it.
- **Decision: targeted cache-first (just `/sales`), not blanket.** Do NOT convert
  detail/edit forms, `/admin/*`, `compliance/*` composites, or `stock-take`
  (realtime). Spend the rest of the effort on the actually-missing DB levers.

### Security finding (must fix — already present today)
**SECURITY-001 — cross-shop data exposure on shared devices via un-scoped client
caches that survive logout.** `useCachedData` writes `localStorage` snapshots
under `mvs_cache:<endpoint>` (NOT keyed by user); the SW caches `/api/*` GETs
under user-less URLs; IndexedDB caches products/settings/tellers/cart — and
**none are cleared on logout**. On a shared phone (owner+teller — the spaza norm),
the next user briefly sees the previous user/shop's cached data before
revalidation. RLS still prevents fetching NEW cross-shop data (no server breach),
but it's a real POPIA confidentiality issue at scale and the same root cause as
the BUG-052 "profile shows the teller" symptom. Converting more pages widens it.
Verified safe (no IDOR): the `?u=`/`?d=` params I added are ignored server-side.
`getShopAuthFast` on reads = ≤1h revocation latency on the user's OWN data (writes
use getUser; RLS blocks cross-shop) — accepted Phase 45e posture, not new.

### Plan — execution order (each commit pushed to master per always-push)

**[SECURITY-001] Logout/switch cache purge — FIRST (present issue, prereq for WS1)**
- [ ] New `clearShopDataCaches()` in `src/lib/offline/db.ts` — clears IndexedDB
      stores `products`, `cart`, `settings`, `tellers`. **MUST NOT touch
      `pending_sales`** (unsynced offline sales → data loss + cross-user sync risk).
- [ ] New `src/lib/offline/clear-session-cache.ts` `clearSessionCaches()` (async):
      (a) remove all `localStorage` keys with `mvs_cache:` prefix + `mvs_shell_identity`
          + `spaza_shop_settings` + the active-teller/teller-me keys; KEEP `mvs_locale`
          (pref, not data) + recent-users (switch-user feature);
      (b) `await clearShopDataCaches()`;
      (c) delete every cached `/api/*` entry across all Cache Storage caches
          (iterate `caches.keys()` → keep shell docs + static chunks).
- [ ] Call `clearSessionCaches()` in LogoutButton + SwitchUserButton (before redirect).
- [ ] Also call it in AppChrome.resolve() on the userId-mismatch branch (covers the
      silent token-swap path, not just explicit logout). Best-effort, non-blocking.
- [ ] Verify: tsc, tests, build. SW cache bump. Commit + push. Log in bugs.md as SECURITY-001.

**[WS1] `/sales` hub → client cache-first (the one slow/error page worth converting)**
- [ ] New `GET /api/sales/hub` composite (getShopAuthFast) returning: today summary,
      weekly chart series, top products, latest sales, profit flag. Reuse existing
      readers (reports.ts / summary / popular / latest).
- [ ] Convert `src/app/(app)/sales/page.tsx` to 'use client' + `useCachedData('sales-hub', …)`,
      rendering existing presentational views (TodaySummaryView, WeeklySalesChart,
      TopProducts view, LatestSalesView). Keep owner/admin gating (proxy blocks tellers
      from /sales; endpoint requires auth). Data-free HTML.
- [ ] Verify gating: teller cannot reach /sales (proxy), endpoint 401s unauthed.
      tsc/tests/build. SW bump. Commit + push.

**[WS2] Missing DB scaling levers — migration 036 + dashboard actions (highest scale ROI)**
- [ ] `supabase/migrations/036_scaling_levers.sql` (output raw SQL for user to run):
      `ALTER ROLE authenticated SET statement_timeout='8s'; ALTER ROLE anon SET statement_timeout='5s';`
      (DO NOT touch service_role — crons/archive need long runs);
      `CREATE INDEX IF NOT EXISTS idx_shop_users_user_id_shop ON shop_users(user_id) INCLUDE (shop_id);`
      (RLS set-membership subquery → index-only scan). Verify shop_users existing indexes first.
- [ ] Audit: grep for any direct `pg`/postgres connection (prepared-statement risk in
      transaction-mode pooling). App is supabase-js/PostgREST → expected clean; confirm.
- [ ] Document (chat, not code): enable Supabase usage/spend alerts (egress, Realtime
      msgs, compute) + Vercel Observability; right-size compute (Large/XL) before launch
      spike; defer read replicas; autovacuum health query on sales/sale_items.

**[WS3] Vercel cost hygiene — careful, low headroom (last, minor)**
- [ ] Review `proxy.ts` matcher: ONLY consider additional static/public asset
      extensions; NEVER exclude app routes or `/api/*`. Re-test access matrix
      (owner/teller/admin/expired) + PWA install (BUG-021/040 history). If no clearly-safe
      addition, leave as-is and document.
- [ ] Set `prefetch={false}` on a few low-value/data-heavy `<Link>`s if any obvious ones
      exist (RSC prefetch `_rsc` hits bypass CDN). Skip if risk > reward.

### Done-criteria
tsc clean, tests green, `next build` clean before each push; SW cache bumped on any
client change; bugs.md updated for SECURITY-001; CLAUDE.md "Most recent" bullet added
at the end. Browser/2-device verification owed by owner (auth render + shared-device
logout purge can't be unit-tested).

---

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
