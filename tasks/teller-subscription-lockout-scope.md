# Scope: Teller subscription lockout (with a proper "subscription ended" screen)

_Created 2026-05-30. Self-contained brief for a fresh chat to plan + execute. Read CLAUDE.md, `tasks/bugs.md` (esp. BUG-047), and this file before starting._

---

## Goal

When a shop's subscription has **ended/expired**, **tellers** (not just the owner) must be blocked from using the app. Instead of the app working normally, a teller should land on a dedicated **"Subscription ended"** screen that says something like:

> "This shop's subscription has ended. Ask the shop owner to resubscribe to continue."

The teller should **not** be able to scan/sell/count while the shop is unpaid. The owner continues to be sent to `/subscribe` (unchanged — they're the one who can pay).

## Why this isn't already the case

In **BUG-047** (fixed 2026-05-30, commit 5351c27) the subscription gate in [src/proxy.ts](src/proxy.ts) was deliberately changed to gate **owners only** (`if (role === 'owner' && !isExempt)`). That fix stopped an infinite redirect loop, but it has a known trade-off (documented in BUG-047 + CLAUDE.md): **a teller of an expired shop can currently still reach `/sale`.** This feature closes that gap — correctly this time.

## ⚠️ CRITICAL constraint — do NOT reintroduce BUG-047

The original loop was: subscription gate redirected the teller to `/subscribe` → teller route enforcement (in proxy.ts) does **not** allow tellers on `/subscribe` → it bounced them back to `/sale` → `/sale → /subscribe → /sale …` infinite loop (`ERR_TOO_MANY_REDIRECTS`).

Two root mistakes to avoid:
1. **Never redirect a teller to a path teller enforcement forbids.** The new "subscription ended" page MUST be added to `TELLER_ALWAYS_ALLOWED` (and the page itself must never redirect the teller anywhere) so there is no bounce-back.
2. **Never decide "expired" for a teller from data the teller doesn't carry.** The original bug fired on *paid* shops because the gate read the teller's JWT, which has **no `sub_until`**, and treated "missing" as "expired." The new check MUST use the **shop's actual live subscription status** as the source of truth, so a paid shop never locks out its tellers.

There must be a test (and a manual browser test) proving: **paid shop → teller works; expired shop → teller sees the suspended screen; neither loops.**

## Current relevant behaviour / code

- **Subscription gate** in [src/proxy.ts](src/proxy.ts): owner-only. Reads `sub_status` / `sub_until` / `access_granted` from `user.app_metadata` (zero DB). Redirects expired owners to `/subscribe`.
- **Teller route enforcement** in proxy.ts: tellers may only reach `TELLER_ALWAYS_ALLOWED` (`/sale`, `/inventory`, `/profile`, a few APIs) and `TELLER_GRANTED_ONLY` (`/stock-take`). Anything else → redirect `/sale`.
- **`SUBSCRIPTION_EXEMPT`** in proxy.ts: `/subscribe`, `/api/subscribe`, `/settings`, `/api/settings`, `/api/account`.
- **The owner subscription source of truth:** `shops.subscription_status`, `shops.trial_ends_at`, `shops.subscription_ends_at`, `shops.access_granted`. The owner's JWT mirrors this as `sub_status` / `sub_until` (synced by `updateShopUsersSubscription()` — check whether it already writes to teller auth users too).
- **`(app)/layout.tsx`** ([src/app/(app)/layout.tsx](src/app/(app)/layout.tsx)) already runs `supabase.auth.getUser()` and, when `shopId` is present, fetches shop data (name, etc.) for the chrome. It's a natural place to also read the shop's live subscription status.
- **`lib/db/shop.ts`** `getShopForRequest()` — a `React.cache`-wrapped shop reader that pulls a superset of shop columns once per request. Likely reusable for the teller check without an extra query.
- **`SubscriptionInfo`** type + `/api/subscribe/status` compute the owner-facing status; reuse the same "is expired" logic so owner and teller agree.

## Proposed approach (recommend the planning chat evaluate both)

### Option A — Layout-level check using live shop data (recommended)
Because the teller's JWT doesn't carry subscription status, and the `(app)/layout.tsx` already has DB access + the shop_id:
1. In `(app)/layout.tsx`, after resolving `user` + `role` + `shopId`, read the shop's live subscription status (ideally via the existing `getShopForRequest()` so it's free/deduped).
2. Compute `shopExpired` using the **same** logic as the owner gate (no future `subscription_ends_at` / trial ended, and not `access_granted`).
3. If `role === 'teller' && shopExpired` → `redirect('/shop-suspended')` (or render the suspended screen inline).
4. Add `/shop-suspended` to `TELLER_ALWAYS_ALLOWED` in proxy.ts so the teller is allowed to land there (no bounce-back loop), and make sure the suspended page never redirects.
- **Pros:** always fresh (no JWT-staleness — a resubscribe takes effect on the teller's next navigation); reuses existing shop read; keeps middleware simple. **Cons:** the gate logic now lives in the layout for tellers and proxy for owners — keep the "is expired" computation in **one shared helper** so they can't drift.

### Option B — Sync shop subscription into teller JWT + gate in middleware
1. Ensure `updateShopUsersSubscription()` writes `sub_status` / `sub_until` to **teller** auth users' `app_metadata`, not just the owner.
2. In proxy.ts, extend the gate to tellers too — but redirect tellers to `/shop-suspended` (allowed) instead of `/subscribe`.
- **Pros:** keeps the gate in one place (middleware), zero-DB. **Cons:** JWT metadata is **stale until the teller's token refreshes / re-logs in**, so a resubscribe may not unlock the teller immediately; must verify teller login + `updateShopUsersSubscription` reliably propagate. Higher risk of the "missing = expired" mistake that caused BUG-047.

> Recommendation: **Option A** — live shop data is the safer source of truth and avoids the JWT-staleness + "missing-means-expired" trap that caused the original loop. Put the "is the shop expired" decision in a single shared function used by both the owner gate and the teller check.

## Deliverables / files likely touched

- **New page:** `src/app/(app)/shop-suspended/page.tsx` — plain, friendly, no payment CTA (tellers can't pay). Message + a "Log out" / "Switch user" action (reuse existing logout/switch-user). Assembled from `src/components/ui/` primitives. MUST NOT redirect.
- **`src/proxy.ts`:** add `/shop-suspended` to `TELLER_ALWAYS_ALLOWED` (and consider `SUBSCRIPTION_EXEMPT` so the owner gate never touches it). Keep the owner-only gate as-is.
- **`src/app/(app)/layout.tsx`:** add the teller live-expiry check (Option A).
- **Shared helper:** one function for "is this shop's subscription expired" used by both owner gate + teller check (extract from the existing owner logic; don't duplicate).
- **i18n (CRITICAL — see CLAUDE.md i18n rule):** new user-facing strings for the suspended screen in **all 5 locales** (`en`, `so`, `am`, `zu`, `ur`) — native, plain-English tone. Either a new small namespace or keys in an existing one; update `tests/unit/i18n.test.ts` if a new namespace is added.
- **Tests:** unit test the shared "is expired" helper for owner + teller parity; if feasible, a test asserting `/shop-suspended` is in `TELLER_ALWAYS_ALLOWED` (the "redirect target must be reachable by the role" invariant from BUG-047 prevention rule b).
- **SW cache bump** in `public/sw.js` (ships user-facing code).

## Testing (browser test is mandatory — see BUG-047 prevention rule e)

`tsc` + unit tests + `next build` do NOT catch auth/routing/redirect-loop bugs. Before considering done, browser-test on a **preview deploy** (or carefully with instant-rollback ready):
1. **Paid/active shop:** teller logs in → reaches `/sale`, can scan/sell. NO suspended screen. NO loop.
2. **Expired shop:** teller logs in → lands on `/shop-suspended`, cannot reach `/sale` / `/stock-take`. NO loop (`ERR_TOO_MANY_REDIRECTS`).
3. **Expired shop:** owner logs in → still goes to `/subscribe` (unchanged). NO loop.
4. **Resubscribe flow:** with an expired shop, owner resubscribes → teller's next navigation unlocks (Option A: immediate; Option B: confirm token refresh).
5. Console clean (no CSP violations — the nonce CSP is live as of commit e868369).

## Out of scope

- Changing how owners subscribe/pay (unchanged).
- The CSP nonce work (already shipped, commit e868369).
- Any change to admin behaviour (admins bypass the gate entirely).

## Key references

- BUG-047 in `tasks/bugs.md` (the loop + prevention rules — read this first).
- Subscription gate + teller enforcement: `src/proxy.ts`.
- Owner subscription model: `shops.subscription_status` / `trial_ends_at` / `subscription_ends_at` / `access_granted`; `updateShopUsersSubscription()`; `/api/subscribe/status`; `SubscriptionInfo` type.
- `src/app/(app)/layout.tsx` + `src/lib/db/shop.ts` `getShopForRequest()`.
