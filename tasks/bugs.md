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

## BUG-005: /api/stock-take missing authentication check
**Symptom:** Same as BUG-004 — POST /api/stock-take had no auth check.
**Root cause:** Auth check omitted during initial implementation.
**Fix:** Added auth guard to `src/app/api/stock-take/route.ts`.
**Prevention rule:** Same as BUG-004. When creating a new API route, copy the auth pattern from an existing protected route (e.g. `/api/stock/route.ts`) before writing any other logic.
