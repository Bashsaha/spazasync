# Movestock

A mobile-first PWA for South African spaza shop and small retail owners. Scan barcodes, track sales, manage stock, and receive daily WhatsApp summaries — all from a smartphone.

---

## Features

- **Barcode scanning** — phone camera via `@zxing/browser`, no hardware needed
- **Sale flow** — scan → cart → complete; stock auto-deducted
- **Stock management** — stock take, manual adjustments, low-stock alerts
- **Teller management** — owner creates teller accounts; tellers see only the sale screen
- **WhatsApp summaries** — daily sales recap + low-stock warnings sent via Twilio at 22:00 SAST
- **Offline support** — sales queued to IndexedDB when offline; synced on reconnect
- **PWA** — installable on Android via manifest + service worker

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Styling | Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL, RLS) |
| Messaging | Twilio WhatsApp Business API |
| Deployment | Vercel + Vercel Cron Jobs |
| Validation | Zod |
| Testing | Vitest (125 tests) |

---

## Local Development

### 1. Clone & install

```bash
git clone <repo-url>
cd spaza-shop
npm install
```

### 2. Set up environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values — see the [Environment Variables](#environment-variables) section below.

### 3. Run Supabase migrations

In your Supabase project dashboard → SQL Editor, run all migrations in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_decrement_stock.sql
supabase/migrations/003_stock_adjustments.sql
supabase/migrations/004_optional_barcode.sql
supabase/migrations/005_subscriptions.sql
supabase/migrations/006_admin_dashboard.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, never expose to the client** |
| `TWILIO_ACCOUNT_SID` | Twilio account SID (starts with `AC`) |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender number (e.g. `whatsapp:+14155238886`) |
| `CRON_SECRET` | Random secret used to protect the cron endpoint — generate with `openssl rand -hex 32` |

---

## Deploying to Vercel

### Prerequisites

- [Supabase](https://supabase.com) project with migrations applied and email auth enabled
- [Twilio](https://twilio.com) account with a WhatsApp-enabled number
- [Vercel](https://vercel.com) account

### Steps

1. **Push to GitHub** (or connect your repo to Vercel directly)

2. **Import the project in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) → Import Git repository
   - Framework preset: **Next.js** (auto-detected)

3. **Set environment variables in Vercel**
   - Project → Settings → Environment Variables
   - Add all 7 variables from the table above
   - Set them for **Production** (and Preview if desired)

4. **Deploy**
   - Vercel builds and deploys automatically on each push to `main`
   - The cron job (`/api/cron/daily-summary`) runs at 20:00 UTC (22:00 SAST) daily — configured in `vercel.json`

### Post-deploy checklist

- [ ] Open `/onboarding` and create an owner account
- [ ] Create a teller and test teller login (shop code + name + password)
- [ ] Scan a product barcode and complete a sale
- [ ] Visit `/stock` to verify stock was deducted
- [ ] Trigger the WhatsApp summary manually: `GET /api/cron/daily-summary` with `Authorization: Bearer <CRON_SECRET>`

---

## Security

### What's in place

| Protection | Implementation |
|---|---|
| Authentication | Supabase Auth (JWT); all API routes check `auth.getUser()` before processing |
| Authorisation | Row-Level Security on all Supabase tables; teller-only route `/sale` enforced in middleware |
| Input validation | Zod schemas on every API route — rejects malformed UUIDs, injection strings, and out-of-range values |
| Rate limiting | In-memory rate limiter on `/api/auth/teller-login` (10 req/60s) and `/api/onboarding` (3 req/60s) |
| Cron protection | `CRON_SECRET` bearer token required on `/api/cron/daily-summary` |
| HTTP headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` |
| Service role key | Used only in server-side admin client (`src/lib/supabase/admin.ts`) — never exposed to the browser |

### Security checklist before going live

- [ ] Generate a strong `CRON_SECRET` (`openssl rand -hex 32`) — never reuse a password
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is **not** prefixed with `NEXT_PUBLIC_`
- [ ] Enable Row Level Security in Supabase (pre-configured in migrations; verify in dashboard)
- [ ] Rotate Twilio auth token if it was ever committed or shared
- [ ] Review Supabase Auth settings: disable sign-ups if you want only invited owners

---

## Testing

```bash
npm test             # run all tests (113 tests across 6 files)
npm run test:watch   # watch mode
npm run test:coverage # coverage report
```

Test files:

| File | What it covers |
|---|---|
| `tests/unit/currency.test.ts` | `formatZAR`, `parsePrice`, `calcSubtotal`, `calcTotal` |
| `tests/unit/whatsapp-format.test.ts` | `formatDailySummary` message formatter |
| `tests/unit/date.test.ts` | SAST timezone helpers |
| `tests/unit/validation.test.ts` | All 10 Zod schemas (happy + sad paths) |
| `tests/unit/rate-limit.test.ts` | Rate limiter with fake timers |
| `tests/unit/security.test.ts` | Schema rejection of injection/malformed input |

---

## Project Structure

See [CLAUDE.md](CLAUDE.md) for the full file tree and phase-by-phase build history.
