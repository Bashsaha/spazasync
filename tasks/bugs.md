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

## BUG-018: Barcode scanner fails on small/dense barcodes — minimum focus distance, not autofocus
**Symptom:** Scanner decodes large barcodes fine but fails on small/dense ones (typical EAN-13 on single sweets, snacks, small SA grocery items). Reported on a Galaxy S25 — top-tier optics, so camera quality wasn't the cause.
**Root cause:** Two compounding issues. (1) Modern Android flagships (incl. S25) have a **minimum focus distance of ~10–15 cm on the main rear camera**. Users instinctively hold the phone close (3–5 cm) to make a small barcode fill the frame, but that's *inside* the lens minimum — the image blurs and never resolves. Hardware barcode scanners use cheap fixed-focus optics tuned to that exact range, which is why they don't have this problem despite worse cameras. (2) [src/hooks/useScanner.ts](src/hooks/useScanner.ts) used `decodeFromVideoDevice` with no format hints, so ZXing scanned every supported 1D + 2D format on every frame at default tolerances — slow path, low success on imperfect images.
**Fix:** Three layered changes in [src/hooks/useScanner.ts](src/hooks/useScanner.ts) + [src/components/scanner/BarcodeScanner.tsx](src/components/scanner/BarcodeScanner.tsx). (a) `BrowserMultiFormatReader` now constructed with `DecodeHintType.POSSIBLE_FORMATS = [EAN_13, EAN_8, UPC_A, UPC_E, CODE_128, CODE_39, QR_CODE]` (SA retail's actual barcode mix) plus `TRY_HARDER = true` — restricting formats lets the decoder run a more aggressive path per frame. (b) `decodeFromConstraints` requests `1920x1080 @ focusMode: 'continuous'`. (c) After the stream is live, feature-detects `track.getCapabilities().zoom` and **auto-applies 2× hardware zoom** so users can keep the phone at proper focus distance (15 cm) while a small barcode still fills the frame. The scanner UI also gains pinch-replacement +/− zoom controls (rendered only when the track exposes hardware zoom) and tap-to-focus (`pointsOfInterest` advanced constraint, feature-detected). **Prior attempt** (commit `4cc0c3a`) wired `getUserMedia` manually and handed the stream to `decodeFromStream` — broke scanning entirely because `decodeFromStream` re-attaches the stream and awaits `loadedmetadata`, which never fires on a pre-attached `<video>`. Corrected by `bf9b2c1`. **Prior diagnosis** ("camera doesn't autofocus") was also wrong: continuous AF was on, but AF can't focus inside the lens minimum.
**Prevention rule:** When a user reports "camera-won't-focus" on a high-end Android phone, **don't blame autofocus** — first check whether they're inside the lens minimum focus distance (~10–15 cm on flagship main sensors). Solution is hardware zoom, not closer phone. For machine-vision via `getUserMedia`: (1) always restrict ZXing to the formats you actually need + `TRY_HARDER` — full-format scanning is slow and brittle. (2) Always request HD + `focusMode: 'continuous'` in constraints; defaults prioritise framerate, not detail. (3) Always feature-detect `track.getCapabilities()` before applying `zoom`/`focusMode`/`pointsOfInterest` advanced constraints — Safari throws on unsupported names. (4) Use `decodeFromConstraints` and let ZXing own stream attachment; do not pre-set `videoEl.srcObject` then call `decodeFromStream` (double-attach hangs on `loadedmetadata`).

**Follow-up (2026-05-06):** Even with the above, scanning was inconsistent on Android. Researched production scanners (Scandit, html5-qrcode, ML Kit). The bigger architectural problem: ZXing JS is a pure-JS port that takes ~350ms per frame on Chrome benchmarks. Production apps use the native `BarcodeDetector` API (Chrome 83+ on Android) which is hardware-accelerated via Google's ML Kit — same engine inside Google Lens, 5–10× faster, dramatically more accurate. [src/hooks/useScanner.ts](src/hooks/useScanner.ts) now feature-detects `window.BarcodeDetector`, calls `getSupportedFormats()`, and uses native if `ean_13` is supported (covers Chrome Android, Edge Android). Falls back to ZXing on iOS Safari and older browsers. The native path runs a 100ms `setTimeout` decode loop (10fps — Scandit and html5-qrcode defaults; phone cameras don't deliver new in-focus frames faster than that, so 30fps decode just wastes CPU on blurry duplicates) calling `detector.detect(videoEl)` directly. Both paths share `tuneTrack()` for continuous AF + 2× auto-zoom + the 30fps `frameRate` cap. **Additional prevention rule:** for any web-based machine-vision, prefer `window.BarcodeDetector` / `window.FaceDetector` / `window.TextDetector` over JS-port libraries. Always feature-detect with `getSupportedFormats()` before relying on a specific format — Chrome's BarcodeDetector format support varies by device.

---

## BUG-019: /sale strands offline users on the teller picker
**Symptom:** With no network, opening /sale always rendered the "Who's serving?" `TellerSelector` even for owners and tellers who had been auto-selected before. The picker itself can't load tellers offline (and tellers shouldn't see it at all), so the user was stuck — couldn't scan, couldn't queue an offline sale.
**Root cause:** [src/hooks/useActiveTeller.ts](src/hooks/useActiveTeller.ts) always validated the `sessionStorage` entry against a live `/api/tellers` fetch. When the fetch failed (offline), the in-memory `tellers` list was `[]`, so `stillValid` was always false and the stored teller was discarded. The teller-role branch had the same shape: a failed `/api/tellers/me` left `activeTeller = null`, triggering the "teller record missing" error screen.
**Fix:** In `useActiveTeller`: (1) on owner/admin path, fall back to `getCachedTellers()` from IndexedDB when the network fetch fails, AND skip sessionStorage validation when offline (trust the stored entry — the SW would have refused to authenticate them in the first place if the session was bad). Also `cacheTellers()` after a successful fetch so the cache stays warm. (2) On teller path, persist the fetched `/api/tellers/me` response to `localStorage` (`spaza_teller_me`) and re-hydrate from it on offline mount. Used `localStorage` not `sessionStorage` because tellers stay logged in across PWA opens — the cached identity must survive a tab close. Owner cache stays in `sessionStorage` to keep the existing "pick who's serving today" semantics on a fresh session online.
**Prevention rule:** Any auth/identity-derived UI gate that gates the offline-critical path (sale entry, queue-offline-sale flow) MUST have an offline fallback. When validating local state against a server-fetched roster, distinguish "fetch said no" from "fetch failed" — only the former should evict local state. For roles that persist across PWA opens, prefer `localStorage` over `sessionStorage` for the offline cache.

**Follow-up (2026-05-08):** Reported still broken after the first fix. Two gaps closed: (1) `supabase.auth.getUser()` makes a network call that errors offline, so we never even reached the role-detection branch — added a `getSession()` fallback (local-only, returns the cached JWT with `app_metadata.role` and `id`). (2) Both the IndexedDB teller cache (only populated when `TellerSelector` mounts — i.e. after the picker is shown at least once) and `sessionStorage` (cleared on tab close) could be empty on a first-time-offline open, so auto-pick had nothing to match against. Added a new `localStorage` mirror (`spaza_last_owner_teller`) updated on every auto-pick + manual `setActiveTeller`, used as the final offline fallback. Order of fallback now: SW cache (intercepts the `/api/tellers` fetch transparently) → IndexedDB roster → `sessionStorage` → `localStorage` last-known. Online behavior unchanged — fresh sessions still re-derive from the live roster.

**Follow-up #2 (2026-05-08):** Fallback chain still didn't fire reliably (depended on prior online state being just-right — the SW cache version had bumped, IndexedDB roster was empty, sessionStorage was clean from tab close, localStorage entry didn't exist yet because it was a brand-new code path). Stopped trying to reconstruct the activeTeller offline and instead **dropped the picker gate when offline**: [src/app/(app)/sale/page.tsx](src/app/(app)/sale/page.tsx) now only shows `TellerSelector` (owner) / "teller record missing" (teller) when `isOnline` is true. Offline the sale UI renders even with `activeTeller = null`; `queueAsOfflineSale()` already accepts `teller_id: null`, the sync worker stamps it server-side. `handleCompleteSale` and `submitSale` mirror the same `isOnline` check before erroring on missing teller. **Lesson:** when an offline-critical flow depends on local state that may be missing, prefer "skip the gate offline" over "pile on more fallbacks to reconstruct it" — fewer moving parts, smaller blast radius.

---

## BUG-020: Dashboard hydration mismatch on the smart-reminders banner
**Symptom:** Visiting `/dashboard` as an owner with an active reminder logged a recoverable hydration error: server rendered the raw translation key (e.g. `score_drop_red_title`) but client rendered the resolved string (e.g. "Your compliance score is 26"). Browser auto-recovered by re-rendering on the client; visually fine but a real React error in the console.
**Root cause:** `<DashboardReminder>` (server component) was wrapped in `<Suspense fallback={null}>` on the dashboard. Inside, `<ReminderBanner>` and `<DismissButton>` were `'use client'` and called `useTranslation('compliance-reminders')`. The `LanguageProvider`'s `useEffect` populates `nsMap` async after mount — by the time the suspended branch hydrated, the rest of the tree had already mounted and translations were loaded, so client `t()` returned the resolved string while the server's same-render still saw `nsMap = {}` and emitted the raw key.
**Fix:** Resolved translations server-side in `DashboardReminder` via `getServerLocale()` + `getServerTranslations(['compliance-reminders'])` and pass `title` / `body` / `ctaLabel` / `dismissLabel` as plain string props to `ReminderBanner`. `ReminderBanner` is now a server component (no `'use client'`, no `useTranslation`). `DismissButton` stays a client component but accepts `label` as a prop instead of resolving it itself.
**Prevention rule:** Client components that render under a `<Suspense>` boundary must NOT depend on the client-side `LanguageProvider` for first-render text — the suspended branch hydrates after the provider has loaded translations, so server (no async useEffect) and client (translations loaded) will diverge. For text inside a Suspense boundary, resolve translations in the parent server component via `getServerTranslations()` and pass them as props. The `'use client'` boundary should sit *below* the i18n resolution, not above it. (This applies broadly to anything render-driven by client-side async state under Suspense — a similar drift is possible with any context that hydrates lazily.)

---

## BUG-021: "Add to Home Screen" installs a shortcut with browser chrome instead of a standalone PWA
**Symptom:** Owners reported tapping "Add" from Chrome on Android put a Movestock icon on their home screen, but launching it opened the site inside a Custom Tab with the browser address bar still visible at the top — not the chrome-less standalone experience the brief asked for (ChatGPT-style). Banner also disappeared for 7 days after the first dismiss, even when the install never actually completed.
**Root cause:** Two compounding issues. (1) `public/manifest.json` only listed SVG icons. Chrome's installability criteria for a true WebAPK require **PNG icons at both 192×192 and 512×512** with `purpose: "any"`; without them, "Add to Home screen" falls back to a plain bookmark/shortcut (which always opens in a Custom Tab with browser UI, regardless of `display: standalone`). iOS Safari has the same shape — it ignores SVG manifest icons and reads `apple-touch-icon.png` directly, so without that file it uses a screenshot and won't go fully standalone either. (2) `InstallPwaButton` persisted a 7-day dismiss to `localStorage` whenever the user tapped "Not now" OR Chrome's native prompt was dismissed — which meant a user who tapped Install but then dismissed Chrome's confirm dialog wouldn't see the banner again for a week despite never having installed.
**Fix:** Recreated brand SVGs (`public/icons/icon.svg` + `icon-maskable.svg`) on the Movestock teal palette, added a one-shot `scripts/generate-pwa-icons.mjs` Node script that uses `sharp` to rasterize them into `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (all under `/public/icons/`) and `apple-touch-icon.png` at 180×180 (at `/public/`, where Safari looks by default). `manifest.json` now lists all three PNGs (PNG entries first so Chrome picks them, SVG kept as a tail fallback) plus `scope: "/"` and `background_color: "#1ABC9C"`. `src/app/layout.tsx` adds `metadata.icons.apple` so Next emits the `<link rel="apple-touch-icon">` tag. SW cache bumped to `movestock-v5` so existing installs pull the new manifest. `InstallPwaButton` rewritten — dropped the `localStorage` cooldown entirely; `hideForNow` is component-state only (returns on next page-load), and the only durable hide path is the real `appinstalled` event or `display-mode: standalone`. Chrome-prompt-dismissed no longer counts as "user installed."
**Prevention rule:** A PWA is only installable as a true standalone WebAPK when the manifest provides PNG icons at 192×192 AND 512×512 with `purpose: "any"`. SVG-only manifests install as bookmark shortcuts that always open in a Custom Tab — regardless of `display: standalone`. iOS additionally needs `/apple-touch-icon.png` (180×180) reachable at the site root (or a `<link rel="apple-touch-icon">` tag); manifest icons alone don't cover Safari. For install-prompt UIs: never persist a "user dismissed" cooldown across sessions unless `appinstalled` actually fired — Chrome's native prompt being dismissed is not the same as the app being installed. Hide-for-this-session is fine; hide-for-7-days is not.

**Follow-up (2026-05-10):** After all the icon and banner work, install was *still* producing a Chrome-chrome shortcut with the wrong icon. Curl'd the deployed `/manifest.json?v=...` and got `307 → /login` — the middleware was redirecting the manifest to the login page because (a) the early-return static-file regex in [src/proxy.ts](src/proxy.ts) only matched `\.(svg|png|jpg|jpeg|gif|ico|css|js)$` (no `.json`), and (b) the matcher config didn't exclude `manifest.json` either. Chrome was therefore fetching HTML and parsing it as JSON, failing silently, deciding the site is not installable, and falling back to "Add to Home screen" (favicon-based shortcut). Fix: added `/manifest.json`, `/sw.js`, `/offline.html` as explicit exact-match early-returns; added `json|webmanifest` to the static-extension regex; updated `config.matcher` to mirror those exclusions so middleware never runs for them. **Prevention rule:** any unauthenticated browser-pipeline resource (manifest, service worker, offline fallback, web app icons) MUST be reachable without auth — middleware redirects on these break PWA installability AND service-worker registration silently. When adding new pre-auth static resources (RSS feed, robots.txt, sitemap.xml, .well-known/*), add them to BOTH the early-return list in middleware AND the matcher config exclusions. Test by `curl -I` against the deployed URL — anything other than 200 OK on these is a bug.
