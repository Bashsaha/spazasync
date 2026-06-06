# Movestock

A mobile-first PWA for South African spaza shop and small-retail owners. Open the app on
an Android phone → scan a barcode → product is added to the sale → stock auto-deducts →
see an in-app daily summary each evening. Built for owners with no technical background on
mid-range phones with flaky data.

> **New to this codebase?** Read [ARCHITECTURE.md](ARCHITECTURE.md) first — it explains how
> the app is wired (auth, data flow, folder layout, compliance subsystem). [CLAUDE.md](CLAUDE.md)
> is the working reference (schema, conventions, workflow rules); [ARCHIVE.md](ARCHIVE.md) is the
> phase-by-phase build history.

---

## Features

- **Barcode scanning** — phone camera via `@zxing/browser`, no hardware scanner needed
- **Sale flow** — scan → cart → complete; stock auto-deducted (FEFO batch consumption)
- **Stock management** — stock take, manual adjustments, low-stock + expiry alerts, stock-loss report
- **Teller management** — owner creates teller accounts (6-digit PIN); tellers are locked to the sale screen
- **In-app daily summary** — today's revenue, sales count, and low-stock warnings on the dashboard
- **Offline support** — sales queued to IndexedDB when offline; synced on reconnect
- **Compliance module** — guided journey for SA spaza regulation (permits, CoA, CIPC, SARS) + R500M Spaza Shop Support Fund readiness
- **Subscriptions** — PayFast (recurring card) or manual EFT (admin reconciles bank statements)
- **PWA** — installable on Android; cache-first App Shell opens instantly

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL, Row-Level Security, Supabase Auth) |
| Payments | PayFast (cards) + manual EFT reconciliation |
| Deployment | Vercel + Vercel Cron |
| Validation | Zod |
| Barcode | `@zxing/browser` |
| Offline | IndexedDB via `idb` |
| Timezone | `date-fns-tz` (`Africa/Johannesburg`) |
| Testing | Vitest (~790 unit tests) |

See `package.json` for exact versions.

---

## Local Development

### 1. Clone & install

```bash
git clone <repo-url>
cd spaza-shop
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in the values — see [Environment Variables](#environment-variables) below. At minimum you
need the three Supabase variables to boot the app locally.

### 3. Apply the database schema

Movestock does **not** use the Supabase CLI to push migrations. Open your Supabase project →
**SQL Editor** and run every file in `supabase/migrations/` **in numeric order** (`001` → `037`).

> ⚠️ **Important:** A set of performance/scalability database objects (RPC functions, indexes,
> RLS-policy rewrites from "Phase 45") were applied directly to production and are **not** captured
> as numbered migrations. A fresh database is incomplete without them. See
> [supabase/RUNBOOK.md](supabase/RUNBOOK.md) before relying on a freshly-provisioned database.

Seed reference data (optional but recommended):

```bash
npx tsx scripts/seed-municipalities.ts   # compliance: metro offices + requirements
npx tsx scripts/seed-catalog.ts          # shared barcode catalogue
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
npm test             # ~790 unit tests
npm run build        # production build
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service-role key — **server-only, never `NEXT_PUBLIC_`** |
| `CRON_SECRET` | ✅ | Bearer token guarding `/api/cron/*` — `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public app origin (PayFast return/notify URLs) |
| `PAYFAST_MERCHANT_ID` / `_KEY` / `_PASSPHRASE` | for card payments | PayFast credentials |
| `PAYFAST_SANDBOX` | for card payments | `true` in dev/sandbox |
| `SUBSCRIPTION_PRICE_ZAR` | for payments | Monthly price (e.g. `349.99`) |
| `EFT_BANK_NAME` / `_ACCOUNT_HOLDER` / `_ACCOUNT_NUMBER` / `_BRANCH_CODE` / `_ACCOUNT_TYPE` | for EFT | Bank details shown on `/subscribe/eft` |
| `EXTERNAL_API_KEY` | for external API | Bearer token for the read-only business-portal API |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | recommended in prod | Durable rate limiting; falls back to in-memory when unset |

There is **no Twilio/WhatsApp integration** — daily summaries are shown in-app, not sent by message.

---

## Auth Model (quick reference)

| Role | Sign-in | Sees |
|---|---|---|
| **Owner** | Google OAuth | Full app; must select an active teller before scanning |
| **Teller** | Shop code + name + 6-digit PIN | `/sale` only (locked by middleware) |
| **Admin** | Promoted via `npx tsx scripts/set-admin.ts user@example.com` | `/admin/*` (+ shop pages if dual-role) |

Full detail (RLS scoping, synthetic teller emails, access matrix) is in [ARCHITECTURE.md](ARCHITECTURE.md)
and [CLAUDE.md](CLAUDE.md).

---

## Deploying to Vercel

1. Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new) (Next.js preset auto-detected).
2. Add every variable from the table above under **Settings → Environment Variables** (Production + Preview).
3. Vercel builds and deploys on each push to `master`. Cron schedules live in `vercel.json`
   (`/api/cron/expire-subscriptions`, `/api/cron/prune-reminders`, `/api/cron/archive-old-sales`).

### Post-deploy smoke test

- [ ] Sign in with Google → land on `/onboarding` → create a shop
- [ ] Create a teller, then test teller login (shop code + name + PIN) → lands on `/sale`
- [ ] Scan/add a product and complete a sale
- [ ] Confirm stock decremented on `/stock`
- [ ] Confirm the dashboard daily summary updates

> **Service worker:** Movestock is a PWA. Any deploy that ships user-facing code **must** bump the
> `CACHE` constant in `public/sw.js`, or returning users keep the old cached build. See the
> "Service Worker Cache Bump" rule in [CLAUDE.md](CLAUDE.md).

---

## Security

| Protection | Implementation |
|---|---|
| Authentication | Supabase Auth (JWT); write routes verify `getUser()` before processing |
| Authorisation | Row-Level Security on every table; route gating in `src/proxy.ts` (middleware) |
| Input validation | Zod schemas on every API route (`src/lib/validation/schemas.ts`) |
| Rate limiting | `checkRateLimit` — Upstash Redis (durable) with in-memory fallback |
| Cron protection | `CRON_SECRET` bearer token on `/api/cron/*` |
| HTTP headers | CSP (per-request nonce), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Secrets | Service-role key only in `src/lib/supabase/admin.ts`; verified absent from the client bundle |

The full pre-production checklist (auth, domain, SMTP, POPIA) lives in [CLAUDE.md](CLAUDE.md).

---

## Testing

```bash
npm test              # ~790 unit tests across tests/unit/
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Tests are organised by domain in `tests/unit/` (compliance, sales/reporting, validation/security,
i18n parity, EFT, barcode, etc.). There are currently **no** integration or end-to-end tests —
critical cross-module flows (sale → stock decrement, realtime, offline sync) are verified manually
on a real device.

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for the folder-purpose guide and how the layers fit together,
and [CLAUDE.md](CLAUDE.md) for the annotated file tree, schema, and conventions.
