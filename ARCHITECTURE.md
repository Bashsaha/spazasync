# Architecture

This document explains **how Movestock is wired** so a developer can find their way around
without reading 45 phases of history. For schema details and conventions see
[CLAUDE.md](CLAUDE.md); for build history see [ARCHIVE.md](ARCHIVE.md).

---

## 1. The big picture

Movestock is a **Next.js 16 App Router** PWA backed by **Supabase** (Postgres + Auth + RLS).
There is no separate backend service — Next.js Route Handlers (`src/app/api/**`) are the API,
and Postgres Row-Level Security is the real data-access boundary.

```
Browser (PWA, service worker)
        │  HTTPS
        ▼
Edge middleware  ──► src/proxy.ts        (auth gate + role routing + CSP nonce)
        │
        ▼
Next.js App Router
   ├─ Server Components (app/**/page.tsx)         ── render HTML, may call lib/db directly
   ├─ Client Components ('use client')            ── fetch /api/*, cache-first via useCachedData
   └─ Route Handlers (app/api/**/route.ts)        ── the API layer
        │
        ▼
   src/lib/db/*  +  src/lib/compliance/*          (queries + pure business logic)
        │
        ▼
   Supabase (Postgres + RLS)  ◄── RLS is the security boundary, not the middleware
```

**Key principle: layers don't leak.** Components never call Supabase directly; they hit
`/api/*` or receive data from a Server Component. Business logic lives in `src/lib`, not in
pages. There are zero `: any` usages and zero stray `console.log`s in `src/` — keep it that way.

---

## 2. Request lifecycle

1. **Middleware** (`src/proxy.ts`, registered as Next.js middleware via its `config.matcher`).
   - Decodes the Supabase session from cookies (local JWT read — no network call in the steady state).
   - Routes by role: owners → full app, tellers → `/sale` only, admins → `/admin/*`.
   - Enforces the **owner subscription gate** (expired owner → `/subscribe`).
   - Generates a **per-request CSP nonce** and threads it onto the request + response headers.
   - Early-returns for public paths (`/legal`, `/api/cron`, service worker, manifest, static assets)
     so they're reachable without auth. **The middleware is routing, not the security boundary** —
     RLS + per-route auth guards enforce data access.

2. **Server Component or Route Handler** runs. Read-heavy pages either render server-side
   (calling `lib/db`) or ship a client component that fetches `/api/*`.

3. **Auth is re-checked at the data layer.** Every shop-scoped API route calls a guard
   (below) before touching data; RLS independently filters every row by the caller's shop.

### Which auth helper do I use? (`src/lib/auth/`)

| Helper | Verifies | Use on |
|---|---|---|
| `getShopAuth()` | `getUser()` — full network validation | **Writes** (anything that mutates) |
| `getShopAuthFast()` | local JWT (`getClaims()`) | **Reads** (GET routes, hot paths) — Phase 45e |
| `getAuthClaims()` | local JWT, degrades to cookie session | Server Component **render gating** in layouts |
| `requireAdmin()` | `getUser()` + admin role | `/api/admin/*` |
| `requireExternalApi()` | `EXTERNAL_API_KEY` bearer | `/api/external/v1/*` |

Rule of thumb: **fast/local verification for reads, full `getUser()` for writes.** RLS is the
backstop either way, so a stale-but-valid JWT on a read can't expose another shop's data.

---

## 3. Auth & identity model

Three roles, all on Supabase Auth:

- **Owner** — signs in with **Google OAuth**. Full app. Must select an active teller before
  scanning on `/sale`. Has a `shop_users` row with `role = 'owner'`.
- **Teller** — signs in with **shop code + display name + 6-digit PIN**. Backed by a *synthetic*
  email `{slug}@shop-{code}.spazasync.app` so Supabase Auth can hold the credential. Locked to
  `/sale` by middleware. RLS + the synthetic email scope it to one shop.
- **Admin** — promoted with `scripts/set-admin.ts`. Sees `/admin/*`. **Dual-role:** an admin
  promoted from an owner keeps their `shop_id` and can use shop pages too. Admin data is read
  with the service-role client; shop data still goes through RLS.

`shops.code` (6–10 uppercase alphanumeric, globally unique) is the teller-login key, chosen at
onboarding. The full access matrix is in [CLAUDE.md](CLAUDE.md#auth-model).

---

## 4. Data-flow patterns (read this before adding a screen)

Movestock is offline-tolerant and "opens instantly," so reads follow specific patterns:

- **Server-rendered pages** call `lib/db` directly and return HTML. Used for role-gated /
  detail / form pages where instant-cold-open isn't critical.
- **Client cache-first pages** use the `useCachedData` hook (`src/hooks/useCachedData.ts`):
  paint instantly from a `localStorage` snapshot → revalidate in the background → reconcile.
  This is the standard for list/dashboard screens.
- **The App Shell** (`src/app/page.tsx` + `LaunchRouter` + `AppChrome`) is a static, data-free
  shell the service worker precaches, so a cold tap paints before any network call. Per-shop
  chrome hydrates client-side from a `localStorage` mirror.
- **Mutations** call `/api/*`, then fire `emitDataChanged()` on the in-tab event bus
  (`src/lib/events.ts`). Cache-first screens listen and refetch.
- **Realtime** (`src/lib/realtime/shop-channel.ts`) uses Supabase **Broadcast** (not
  `postgres_changes`) on a per-shop topic — a DB AFTER-trigger broadcasts on writes. Clients also
  refetch on focus as a fallback. (Phase 45d — chosen to avoid an always-on socket per owner.)
- **Offline** (`src/lib/offline/*`, `src/hooks/useOfflineSync.ts`): sales queue to IndexedDB
  and sync on reconnect; products are cached for offline browsing.

### Service worker (`public/sw.js`)
PWA shell + selected `/api/*` GETs are cached (stale-while-revalidate); mutations invalidate the
matching cache entry. **Every deploy shipping user-facing code must bump the `CACHE` constant** or
returning users keep the old build.

---

## 5. Folder-purpose guide

```
src/
├── proxy.ts                  Next.js middleware: auth gate, role routing, CSP nonce
├── app/
│   ├── (auth)/               login + onboarding (public-ish)
│   ├── (app)/                authenticated shell; layout.tsx holds the auth/lockout/locale gate
│   ├── legal/                public privacy + terms (no auth, no i18n)
│   ├── shop-suspended/       teller lockout screen (top-level so it can't loop the (app) layout)
│   ├── page.tsx              static App Shell splash (start_url)
│   └── api/                  the API layer — one folder per resource
├── components/
│   ├── ui/                   design-system primitives — ALWAYS build pages from these
│   ├── dashboard/ sale/ products/ compliance-*/ ...   feature-grouped components
│   └── *.tsx                 shared chrome (TopAppBar, BottomNav, modals, providers)
├── hooks/                    client hooks (useCart, useScanner, useCachedData, useOfflineSync, ...)
├── lib/
│   ├── supabase/             three clients: client.ts (browser), server.ts (RSC/route), admin.ts (service-role)
│   ├── auth/                 the guards in §2 + route allow-lists + recent-users
│   ├── db/                   one module per domain — the ONLY place that queries Postgres
│   ├── compliance/           pure business logic (score, journey, fund, reminders) — no DB, unit-tested
│   ├── eft/                  bank-statement reconciliation engine + OFX/CSV adapters (pure core)
│   ├── pdf/                  shared jsPDF helpers (+ a PII guard)
│   ├── offline/              IndexedDB cache + sync + logout purge
│   ├── realtime/             per-shop Broadcast subscription
│   ├── i18n/                 5 locales × 24 namespaces + loader/server helpers
│   ├── validation/schemas.ts all Zod schemas
│   └── utils/                currency, date (SAST), rate limiting, status badges
└── types/                    shared TypeScript types
```

**"Which file gives me X?"**
- Today's sales / reports → `lib/db/sales.ts`, `lib/db/reports.ts`, `lib/db/sales-statistics.ts`
- Stock / batches / expiry → `lib/db/stock.ts`, `lib/db/batches.ts`, `lib/db/stock-loss.ts`
- Compliance score → `lib/compliance/score.ts`; journey state → `lib/compliance/journey.ts`;
  fund eligibility → `lib/compliance/fund.ts`; dashboard nudges → `lib/compliance/reminders.ts`
- Pure logic is split from DB I/O on purpose so it can be unit-tested without Supabase
  (e.g. `lib/db/stock-loss.ts` wraps the DB; `shapeStockLoss()` inside it is the pure, tested core).

---

## 6. Compliance subsystem (the largest feature area)

A guided path that helps a spaza owner become legally compliant and apply for the R500M Spaza
Shop Support Fund. The flow:

```
Onboarding (capture nationality, municipality, employees, fund interest)
   → Journey hub  (per-step plan: Food Safety → CIPC → SARS → CoA → Trading Permit → UIF → SMMESA)
   → Documents    (status per doc type, expiry tracking)
   → Fund readiness (can I apply now? green/amber/red)
   → Reminders    (dashboard nudges: expiring docs, idle journey, fund-qualified, ...)
```

- **SA-citizen vs foreign-national paths diverge** (different portals, documents, fund
  eligibility). A firewall manifest (`lib/compliance/nationality-divergence.ts`) plus a build-failing
  test (`tests/unit/compliance-nationality-firewall.test.ts`) prevent citizen-only copy (fund,
  BizPortal, "SA ID") from leaking into foreign-national screens.
- **Every external fact** (fees, deadlines, .gov.za URLs) is inventoried with a source + verify
  date in `tasks/compliance-facts-audit.md`, re-verified on a 30-day cadence. Touch compliance
  copy → update that file in the same change.
- Municipality data (metro offices + requirements) lives in DB tables seeded by
  `scripts/seed-municipalities.ts`.

---

## 7. Database & migrations

- Schema lives in `supabase/migrations/001…037`. **Apply them by hand in the Supabase SQL Editor**
  in numeric order (the project does not use `supabase db push`).
- All tables have RLS. Shop-scoped policies use the set-membership form
  `shop_id IN (SELECT shop_id FROM shop_users WHERE user_id = auth.uid())` (evaluated once per
  statement — the documented Supabase scaling fix).
- **⚠️ Schema-drift hazard:** "Phase 45" scalability objects (the `complete_sale` /
  `shop_daily_summary` / `expire_due_shops` RPCs, several indexes, the broadcast trigger, the
  cold-archive tables, and the RLS rewrites) were applied **directly to production and are NOT in
  the migrations folder.** A fresh database is missing them. See
  [supabase/RUNBOOK.md](supabase/RUNBOOK.md). Closing this gap (capturing them as migration `038`)
  is tracked cleanup.
- The full table catalogue is in [CLAUDE.md](CLAUDE.md#database-schema).

---

## 8. Internationalisation

5 locales (`en`, `so`, `am`, `zu`, `ur`) × 24 namespaces under
`src/lib/i18n/translations/`. Every user-facing string uses `useTranslation()` (client) or
`getServerTranslations()` (server) — never hardcode. Any EN string added/changed must be mirrored
in all four other locales in the same change; `tests/unit/i18n.test.ts` enforces key parity.

---

## 9. Testing

~790 Vitest unit tests in `tests/unit/`, organised by domain. The pure-logic modules
(`lib/compliance/*`, `lib/eft/*`, shaping functions in `lib/db/*`) are the heavily-tested core.
There are **no integration or e2e tests** — sale→stock, realtime, and offline sync are verified
manually on a device. Adding a Playwright e2e layer for the critical owner/teller flows is the
biggest open testing gap.

---

## 10. Conventions checklist (before you open a PR)

- Build UI from `src/components/ui/` primitives — don't hand-write Tailwind for buttons/cards/inputs.
- Queries go in `lib/db`; pure logic in `lib/compliance` (or a `shape*` function); pages are assembly.
- New/changed user-facing string → update all 5 locales.
- New compliance fact → update `tasks/compliance-facts-audit.md`.
- Shipped user-facing code → bump `CACHE` in `public/sw.js`.
- After fixing a bug → add an entry to `tasks/bugs.md`.
- Run `npm test` and `npx tsc --noEmit` before pushing.
