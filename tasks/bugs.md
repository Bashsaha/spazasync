# SpazaSync — Bug Tracker

_Every bug fixed must be logged here with root cause and prevention rule.
Claude must read this file at session start and reference it before touching auth, routing, or middleware._

---

## BUG-001: /onboarding blocked for unauthenticated users
**Symptom:** Clicking "Create your shop" on the login page reloaded the login page instead of opening onboarding.
**Root cause:** `/onboarding` was not listed in `PUBLIC_ROUTES` in `src/middleware.ts`. Unauthenticated users were redirected to `/login` before the page could render.
**Fix:** Added `/onboarding` and `/api/onboarding` to `PUBLIC_ROUTES`.
**Prevention rule:** Any page that must be reachable before login (signup, onboarding, password reset, etc.) MUST be added to `PUBLIC_ROUTES` in middleware. Always check this list when creating new pre-auth pages.

---

## BUG-002: Missing /auth/callback route — "localhost error" after email confirmation
**Symptom:** After clicking the Supabase email confirmation link, the user was redirected to `localhost:3000/auth/callback` which returned a 404/error page.
**Root cause:** Supabase redirects to `{site_url}/auth/callback?code=xxx` after email confirmation. The app had no handler at this path to exchange the code for a session.
**Fix:** Created `src/app/auth/callback/route.ts` — exchanges the auth code for a session, then routes the user to `/onboarding` (if no role yet) or `/dashboard`.
Also added `/auth/callback` to `PUBLIC_ROUTES` in middleware so the route is reachable before a session exists.
**Prevention rule:** Any new Supabase project MUST have an `/auth/callback` route. Any auth flow that uses email links (confirmation, magic link, password reset) relies on this route. Never remove it.

---

## BUG-003: No "check your email" screen after signup
**Symptom:** When Supabase requires email confirmation, the onboarding page silently redirected to `/login` with no clear explanation, leaving users confused.
**Root cause:** The `handleSignup` function navigated away (`router.push('/login')`) instead of showing a confirmation state on the same page.
**Fix:** Added an `'email-sent'` step to the onboarding state machine. When `signInWithPassword` fails after `signUp`, the page now shows a dedicated screen with the user's email address, instructions to check their inbox, and a link to `/login`.
**Prevention rule:** Never navigate away from a form to show an error or status. Keep the user on the same page and show the state inline. Email confirmation flows must always have a visible, on-page confirmation screen.

---

## BUG-004: /api/sales missing authentication check
**Symptom:** The POST /api/sales endpoint accepted requests from unauthenticated callers. Any request with a valid JSON body could complete a sale and decrement stock.
**Root cause:** Auth check (`supabase.auth.getUser()`) was never added to the route handler. RLS on the database would have blocked data writes, but the API layer should fail fast before hitting the DB.
**Fix:** Added auth guard at the top of the POST handler in `src/app/api/sales/route.ts`.
**Prevention rule:** Every API route that writes data MUST check auth as its FIRST operation, before parsing the body or touching the DB. Pattern: `const { data: { user } } = await supabase.auth.getUser(); if (!user) return 401`.

---

## BUG-008: Redirect loop — authenticated user with no role bounces between /onboarding and /dashboard
**Symptom:** Browser shows "redirected too many times" when a user has an auth session but hasn't completed onboarding.
**Root cause:** Proxy redirected any authenticated user away from public routes (including `/onboarding`) to `/dashboard`. Then at `/dashboard`, seeing no role, it redirected back to `/onboarding`. Infinite loop.
**Fix:** Added a guard in proxy.ts — if the user is on `/onboarding` and has no role, pass through instead of redirecting away.
**Prevention rule:** Never redirect an authenticated-but-incomplete user away from the page they need to complete setup. Public routes that serve post-signup flows (onboarding, email-sent) must check for this state before bouncing the user.

---

## BUG-009: POST /api/onboarding redirected away — shop setup silently fails
**Symptom:** Step 2 of onboarding (shop setup) hangs on "Creating your shop..." and nothing is saved to Supabase tables.
**Root cause:** Proxy guard for onboarding only matched `pathname.startsWith('/onboarding')` but the API call goes to `/api/onboarding`. An authenticated user with no role hitting `/api/onboarding` was redirected to `/dashboard` instead of being allowed through.
**Fix:** Extended the proxy guard to also match `/api/onboarding`: `pathname.startsWith('/onboarding') || pathname.startsWith('/api/onboarding')`.
**Prevention rule:** When adding a guard exception for a page route, always check if there's a corresponding `/api/` route that also needs the exception. Page routes and their API counterparts must be treated as a pair.

---

## BUG-010: Hydration mismatch on sale page — OfflineBanner differs between server and client
**Symptom:** React error "Hydration failed because the server rendered HTML didn't match the client" on `/sale`. Server renders `<main>`, client renders `<div className="bg-amber-500...">` (OfflineBanner).
**Root cause:** `useOnlineStatus` initialized `useState` with `navigator.onLine` — on the server, `navigator` is undefined so it defaults to `true` (banner hidden). On the client, `navigator.onLine` can be `false` (banner shown), causing a mismatch.
**Fix:** Always initialize `useState(true)` and read the real `navigator.onLine` value in `useEffect` after hydration.
**Prevention rule:** Never use browser-only APIs (`navigator`, `window`, `document`, `localStorage`) in `useState` initializers. Always default to a server-safe value and sync in `useEffect`.

---

## BUG-006: middleware.ts deprecated in Next.js 16 — site fails to load
**Symptom:** Dev server starts but localhost fails to open; warning "The 'middleware' file convention is deprecated. Please use 'proxy' instead."
**Root cause:** Next.js 16 renamed the middleware file convention from `middleware.ts` to `proxy.ts` and the exported function from `middleware` to `proxy`.
**Fix:** Created `src/proxy.ts` with the auth guard logic and `export async function proxy(...)`. Deleted `src/middleware.ts`.
**Prevention rule:** In Next.js 16+, auth/routing guards must live in `src/proxy.ts` not `src/middleware.ts`. Never create a new `middleware.ts` file.

---

## BUG-007: Next.js infers wrong workspace root — stray package.json in parent folder breaks module resolution
**Symptom:** Dev server warns about wrong workspace root. Pages fail to load with "Can't resolve 'tailwindcss'" error. Browser shows infinite reload loop because CSS/pages can't compile.
**Root cause:** A stray `package.json`, `package-lock.json`, and `node_modules/` from an old project ("emergent-frontend") existed in `C:\Users\Gaming PC\`. Next.js/enhanced-resolve used that `package.json` as the description file and searched for modules in the wrong `node_modules/`, failing to find `tailwindcss` and other project deps.
**Fix:** Deleted the stray `package.json`, `package-lock.json`, and `node_modules/` from `C:\Users\Gaming PC\`. Also added `turbopack.root` in `next.config.ts` as an extra safeguard.
**Prevention rule:** Never place a `package.json` in a parent directory of any Node project. If module resolution fails with wrong paths, check all ancestor directories for stray `package.json` files.

---

## BUG-005: /api/stock-take missing authentication check
**Symptom:** Same as BUG-004 — POST /api/stock-take had no auth check.
**Root cause:** Auth check omitted during initial implementation.
**Fix:** Added auth guard to `src/app/api/stock-take/route.ts`.
**Prevention rule:** Same as BUG-004. When creating a new API route, copy the auth pattern from an existing protected route (e.g. `/api/stock/route.ts`) before writing any other logic.

---

## BUG-011: Migrations 008–010 never applied — batch API returns 500 on every call
**Symptom:** Adding expiry dates to products fails silently. POST /api/batches and GET /api/batches both return 500. Products save with stock_qty: 0 but no expiry batches are created.
**Root cause:** Supabase migrations 008 (shop fields), 009 (product_batches table + decrement_stock_fefo function), and 010 (product name unique index) were written as local SQL files but never executed against the live Supabase database. The `product_batches` table did not exist.
**Fix:** Ran all three migrations in Supabase SQL Editor. Verified table and function existence via diagnostic script.
**Prevention rule:** After writing any new migration file, ALWAYS verify it has been applied to the live database before marking the phase complete. Run a quick check: `supabase.from('<table>').select('id').limit(0)` to confirm the table exists. Never assume local migration files are in sync with the remote database.

---

## BUG-014: BottomNav covers CartSummary's Complete Sale button on sale page
**Symptom:** On the sale page, the bottom navigation bar covers the "Complete Sale" button, making it untappable on mobile.
**Root cause:** Both `CartSummary` and `BottomNav` were `fixed bottom-0`. BottomNav had `z-40` while CartSummary had no z-index, so the nav sat on top of the sale button.
**Fix:** CartSummary now accepts `aboveNav` prop — when true, positions itself above the BottomNav using `bottom: calc(56px + env(safe-area-inset-bottom))` and gets `z-50`. Sale page passes `aboveNav={role !== 'teller'}` since tellers don't see BottomNav. Main content padding increased from `pb-36` to `pb-52` for owners to prevent cart items from hiding behind both bars.
**Prevention rule:** When placing a fixed-bottom element on a page that already has a fixed-bottom navigation bar, always check for overlap. Use z-index layering and bottom offsets to stack them correctly.

---

## BUG-013: Adding stock with partial expiry dates drops untracked units
**Symptom:** User adds 10 units, assigns 5 to an expiry date. Only 5 units are added to stock instead of 10.
**Root cause:** In `stock/[id]/page.tsx` `handleSubmit`, when `trackAddExpiry` is true, the code only creates batches via `/api/batches` (which each increment stock by their quantity) then returns early. Units not assigned to any expiry entry are silently dropped.
**Fix:** After creating all expiry batches, calculate `remainder = parsedAmount - totalAdded`. If remainder > 0, call `/api/stock` to add the untracked units via regular stock adjustment.
**Prevention rule:** When a form has a "total quantity" field and a subset breakdown (e.g. expiry entries), always verify the subset sums to the total. If it doesn't, handle the remainder explicitly — never assume the subset covers everything.

---

## BUG-012: admin_payments table had RLS disabled — defense-in-depth gap
**Symptom:** `admin_payments` was the only table without RLS enabled. While access was gated by `requireAdmin()` in the API layer and the service role client, a bug in application code could have exposed all payment records via the anon/authenticated client.
**Root cause:** Original migration (006) explicitly skipped RLS with comment "no RLS needed" — prioritized convenience over defense-in-depth.
**Fix:** Added `ALTER TABLE admin_payments ENABLE ROW LEVEL SECURITY;` to migration 006. No policies added — with RLS on and zero policies, anon/authenticated clients get 0 rows. Service role bypasses RLS automatically.
**Prevention rule:** Every table must have RLS enabled, even admin-only tables. "Only accessed by service role" is not a reason to skip RLS — it's a reason to enable RLS with no policies (zero-access default). Service role bypasses RLS anyway, so there's no downside.

---

## BUG-015: i18n flat namespace merge causes cross-page key collisions — wrong labels everywhere
**Symptom:** On the Add Product page, the "Product name" label showed "Teller name" instead. The "Add Product" title showed "Add Teller". Similar collisions affected `title`, `search_placeholder`, `error_load`, `empty`, and other keys across Stock, Expiry, and Settings pages — all 5 languages affected.
**Root cause:** `LanguageProvider` loaded all 9 translation namespaces and merged them into a single flat object via `Object.assign()`. Later namespaces overwrote earlier ones. Load order was `[common, sale, dashboard, stock, summary, products, tellers, expiry, settings]`, so `tellers` overwrote `products` keys (e.g. `label_name`), and `settings` overwrote `title` from every other namespace. 16 key collisions identified in total.
**Fix:** Added `loadNamespacedTranslations()` to `loader.ts` which keeps translations keyed by namespace. Updated `LanguageProvider` to store a per-namespace map (`nsMap`). Changed `useTranslation(namespace?)` to resolve keys from the specified namespace first, then `common`, then flat fallback. Updated all 20 page/component files to pass their namespace: `useTranslation('products')`, `useTranslation('tellers')`, etc.
**Prevention rule:** When adding new i18n keys, check for collisions with other namespace files — keys like `title`, `label_name`, `back`, `loading`, `empty`, `error_generic` are high-risk. Always pass a namespace to `useTranslation()` in page components. Never rely on flat-merge ordering for correct key resolution.

---

## BUG-017: Compliance journey client components received `t` as a prop — broke translation in production
**Symptom:** On `/compliance/journey`, action buttons (`MarkAsDoneButtons`), the step shells (`JourneyStep`), and the staff list (`StaffTrainingList`) showed raw key strings or threw at runtime when interacted with. Server-side render looked fine; first client interaction surfaced the issue.
**Root cause:** These are `'use client'` components. The parent server component was passing `t={t}` from `getServerTranslations()` as a prop. Functions can't cross the RSC serialization boundary — Next.js silently dropped the prop, leaving `t` undefined on the client. Also, `(app)/layout.tsx`'s `LanguageProvider` had not been updated to include the `compliance-journey` namespace when 37c shipped, so even if a client component reached for it via `useTranslation`, nothing was loaded.
**Fix:** Removed the `t` prop from `MarkAsDoneButtons`, `JourneyStep`, and `StaffTrainingList` and made each call `useTranslation('compliance-journey')` directly. Added `'compliance-journey'` to the namespace list in [src/app/(app)/layout.tsx](src/app/(app)/layout.tsx#L62). Updated all callsites (`CIPCStep`, `FoodSafetyStep`, `SARSStep`, `SMMESAStep`, `UIFStep`, and `compliance/journey/page.tsx`) to drop the now-unused `t` argument.
**Prevention rule:** Never pass server-side `t()` (from `getServerTranslations`) as a prop to a `'use client'` component. Functions don't serialize across the RSC boundary. Client components must call `useTranslation(namespace)` themselves. When introducing a new i18n namespace, also add it to the `namespaces` array in the relevant `LanguageProvider` mount — otherwise client `useTranslation(namespace)` calls return raw keys.

---

## BUG-016: Some recorded sales missing teller name — dashboard shows "—"
**Symptom:** On the dashboard `LatestSales` card, some sales rendered `—` where the teller name should be. Owner couldn't tell which teller made the sale.
**Root cause:** 12 rows in `sales` had `teller_id = null` (verified via Supabase REST: `GET /sales?teller_id=is.null`). All were from the online path (`offline_id = null`), spanning 2026-03-24 → 2026-04-24. Two contributors: (1) legacy sales from before the current `TellerSelector` gate was tightened — the sale UI now blocks owners at [sale/page.tsx:203](src/app/(app)/sale/page.tsx#L203) until they pick a teller; (2) the teller path had no equivalent gate — if a teller's `/api/tellers/me` auto-select request failed (transient network error, deactivated account mid-session), they'd still see the cart UI with `activeTeller = null` and could submit `teller_id: null`. The `completeSaleSchema` in `validation/schemas.ts` allows `teller_id: null`, and the FK is `REFERENCES tellers(id)` with no `ON DELETE` action — so deleting a teller is blocked, it does NOT nullify sales.
**Fix:** (1) Phase 35a updated `LatestSales.tsx` and the new `/sales` page to render the localised "No teller recorded" fallback (new `sales.sale_no_teller` key × 5 locales) instead of `—` — user always sees a clear state. (2) Phase 35b added a second gate at [sale/page.tsx:211](src/app/(app)/sale/page.tsx#L211): `if (role === 'teller' && !activeTeller)` → block the sale UI with a "Could not load your teller record — sign out and back in" screen (new `sale.teller_record_missing` key × 5 locales). The 12 legacy null-teller rows remain in the DB by design (they're real sales; we don't rewrite history) — they'll just render with the fallback label forever.
**Prevention rule:** Any write-site that accepts a nullable FK MUST have a UI gate ensuring it's set. `teller_id` is schema-nullable (intentional — supports edge cases like deactivated tellers) but the happy-path UI must never submit null. If you add a new role that runs sales, add an equivalent gate to [sale/page.tsx](src/app/(app)/sale/page.tsx). Never tighten the Zod schema to reject nulls — you'll break offline-queue replay for the 12 legacy rows and any future edge case.

---

## BUG-018: Barcode scanner fails on small/dense barcodes — camera doesn't autofocus
**Symptom:** On Android, the barcode scanner decodes large barcodes fine but fails on small/dense ones (typical EAN-13 on single sweets, snacks, small SA grocery items). User reported "almost like the camera can't focus".
**Root cause:** [src/hooks/useScanner.ts](src/hooks/useScanner.ts) used `BrowserMultiFormatReader.decodeFromVideoDevice(undefined, videoEl, cb)`. ZXing's default `getUserMedia` constraints request neither high resolution nor any `focusMode`, so Chrome on Android opens the rear camera in a low-resolution fixed-focus mode. Small barcodes blur below the decoder's pixel-density threshold before they're ever in focus.
**Fix:** Replaced `decodeFromVideoDevice` with an explicit `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 1920, height: 1080, focusMode: 'continuous' }})` → `decodeFromStream(stream, videoEl, cb)` flow. After the stream starts, also calls `track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })` (gated on `track.getCapabilities().focusMode?.includes('continuous')` so iOS Safari, which doesn't expose focus controls, silently no-ops). The wrapped `controls.stop()` now also tears down the `MediaStream` we own.
**Prevention rule:** Anything using `getUserMedia` for machine-vision (barcode, OCR, document scan) MUST request high resolution AND `focusMode: 'continuous'`. Default constraints prioritise framerate/battery, not detail. When applying advanced track constraints, always feature-detect via `track.getCapabilities()` first — Safari throws on unsupported constraint names. When you call `getUserMedia` yourself, you also own teardown — every `stop()` path must call `track.stop()` on every track in the stream, otherwise the camera LED stays on after the user closes the scanner.
