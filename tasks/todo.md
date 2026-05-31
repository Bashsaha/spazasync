# Movestock — Task Tracking

## Phase 44 — App Shell Architecture (instant-open PWA) — PLANNED

### Why
Users report: (1) cold open takes ~15s, (2) resuming from background shows
"we ran into a problem", (3) tapping a tab after background won't load, (4) the
checklist intro fires at random. Issues 1–3 share one root cause: every page is
**server-rendered with the user's data baked in**, so every open / resume /
tab-switch must complete a network round-trip (auth + DB) before anything paints.
On a cheap Android with a sleepy radio that round-trip is where the 15s — and the
crash — lives. The previous BUG-048 pass treated symptoms (defer 600ms, auto-retry
the error screen); this phase fixes the cause.

### The fix (the "Instagram" pattern)
Render a **data-free app shell** (chrome + skeleton) the phone caches and shows
**instantly with zero network**, then load the user's data client-side and paint
**cache-first** (last-known real data shows immediately, fresh data updates it in
the background — stale-while-revalidate). This dissolves issues 1, 2, and 4-from-
the-list (resume crash + tab-won't-load) at the root, because pages stop
re-rendering on the server on every navigation. Issue 3 (checklist intro) is a
small independent fix folded in.

**Why BUG-040 no longer blocks this:** BUG-040 forbade caching pages that had
*user data baked in* (leaked across users on a shared phone / went stale). An
**empty** shell has no user data — nothing to leak, nothing to go stale. The rule
stands; it just doesn't apply to a data-free shell.

### Decisions locked with user
- Do the proper incremental rebuild, accepting a multi-session effort + launch
  delay, NOT quick fixes. (User: "rather delay launch than ship a slow app.")
- **Sale flow is build-priority #1** and the first thing warmed at runtime.
- Cost goes DOWN (more served from device, fewer server renders / auth calls).
- Better for cheap phones (the pattern was designed for low-end Android on 2G).
- Honest caveat accepted: the *first-ever* open after install still needs the
  network once to cache the shell; every open after is instant.
- Pre-launch checklist: no violations. `getClaims` + asymmetric JWT keys are a
  security *upgrade*; ResumeGuard is a bundled (CSP-safe) component.
- JWT asymmetric-keys decision: DEFERRED. Code will use `getClaims()` which
  safely falls back to the network call until the user enables asymmetric keys.

### Sub-phases (each independently shippable + phone-tested; STOP after each per phase gating)

#### 44a — Instant shell foundation + Sale-first  ← START HERE
Goal: the app opens to a usable shell **instantly** (no 15s wait, no resume crash),
with Sale ready first.
- [ ] Short spike (≤ build session) to lock the exact Next.js mechanism for a
      cacheable data-free shell. Two viable approaches — pick the more elegant:
      (A) keep `(app)/layout.tsx` a server component but render chrome WITHOUT
      awaiting user data; move shop-name / person-name / checklist-FAB / locale to
      client islands that hydrate from a `localStorage` snapshot then revalidate;
      (B) a dedicated client shell. Decide A vs B, document in lessons.md.
- [ ] Make the `(app)` initial server render **data-free** (skeleton chrome only),
      so the HTML is identical for every user and safe to cache.
- [ ] `public/sw.js`: serve the authed app-shell navigation **cache-first**
      (the HTML is now data-free). Keep network-first/offline.html only as the
      fallback for the un-cached first visit. Version bump. Verify no cross-user
      / cross-day leakage (the BUG-040 regression test mindset).
- [ ] Client session gate: tiny client check on shell mount — no session →
      `window.location.assign('/login')` (belt-and-braces; middleware still does
      the network-layer redirect). Real security stays server-side (RLS + API
      `getUser()`), unchanged.
- [ ] `(app)/layout.tsx`: replace the `auth.getUser()` network call with
      `supabase.auth.getClaims()` (local JWT verify; falls back to network until
      asymmetric keys are enabled). Removes the hanging call from the render path.
- [ ] New `ResumeGuard` client component (mounted in shell): on
      `visibilitychange → visible`, confirm connectivity via the existing
      `/manifest.json` HEAD probe (BUG-046), then `supabase.auth.refreshSession()`
      with a short timeout BEFORE any data refresh fires. Cures the documented
      Supabase tab-suspension client-corruption (GitHub #36046).
- [ ] Degrade-don't-crash: any remaining server reads in the shell wrapped so a
      transient failure renders the shell, never throws into `error.tsx`.
- [ ] `useRefetchOnVisible`: stop firing a full `router.refresh()` into a waking
      radio; let ResumeGuard own resume ordering (refresh session → probe → allow).
- [ ] Sale-first: ensure `/sale` paints instantly cache-first (largely done via
      `useActiveTeller` + cached picker) and is the first route warmed by
      `SaleDataWarmup`. Verify offline sale still works end-to-end.
- [ ] `next.config.ts`: add `experimental.staleTimes` (`dynamic: 30`) so idle
      tab back-and-forth reuses the cached payload (mutations still force-refresh
      via the DATA_CHANGED bus + realtime).
- [ ] **Phone test on a real mid-range Android**: cold open is fast; background
      5+ min → resume shows no error and loads; tap each tab after background —
      all load; owner AND teller login both work; check console for CSP errors.

#### 44b … (LAST STEP) — Convert remaining screens to cache-first client data
One screen per sub-phase, each shippable + phone-tested, in priority order:
- [ ] Dashboard — paint from cached snapshot, revalidate in background.
- [ ] Inventory hub + lists (products / stock / expiry).
- [ ] Remaining owner screens (settings, sales, manage, compliance, etc.).
Each: read last-known data from `localStorage`/IndexedDB → paint instantly →
background fetch → reconcile (guard against a slow fetch clobbering in-progress
edits, per the Settings cache-first precedent). Keep server-side RLS intact.

#### 44c — Checklist intro: only on the genuine first checklist (small, independent)
- [ ] Extend `/api/daily-checklist/status` to also return `everCompleted` (does
      ANY checklist row exist for the shop — `getChecklistStreakStatus` nearly
      does this already).
- [ ] `ChecklistReminderFab`: show the intro only when `everCompleted === false`.
      Drop the fragile localStorage-only gate as the authority (keep it only as a
      same-session nicety). Once they've ever completed one, it never shows again.

### Honest scope / risk
- Incremental + phone-tested per sub-phase + reversible → not a big-bang rewrite.
- The background data *fetch* still takes network time, but the user sees real
  cached data immediately and isn't blocked on it.
- 44a is the architectural unlock (instant open + resume fix); 44b is the long
  tail (one screen at a time); 44c is a quick win.

### Verify (per sub-phase, per protocol)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green
- [ ] `next build` clean
- [ ] Real-phone smoke test (build/tsc/unit do NOT exercise the resume/cold-open path)
- [ ] `public/sw.js` cache version bumped
- [ ] `tasks/bugs.md` updated (resume crash root cause + the BUG-040-vs-empty-shell clarification)
- [ ] Phase Completion Protocol: Glob scan → file tree → Living Scope → commit → push → checklist → STOP
