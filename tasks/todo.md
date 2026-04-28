# Movestock — Task Tracking

## Phase 36 — WhatsApp-style UX Restructure

Three-part overhaul. **DO NOT auto-start a sub-phase — wait for explicit go-ahead between each one per the Phase Gating rule.**

### Context

- The dashboard pre-rebuild had 9 nav cards + 13 alert/data sections. New users couldn't tell what to look at.
- Bottom nav had 6 tabs with Stock and Products as separate tabs even though they manage the same data.
- The "+" floating icon for sales had no label; non-technical users didn't know what it did.
- Compliance features (checklist/docs/pest/waste/inspection) were buried across multiple cards and the Settings page.
- Sales feature (date drill-down + monthly PDF) was reachable only via a dashboard nav card.
- Tellers had no easy way to switch user when handing the phone to/from the owner.
- All access was binary: tellers see /sale only, owners see everything. No middle ground.

### Phase 36a — Navigation Restructure & Dashboard Cleanup ✅ DONE

- [x] 5-tab BottomNav (Home / Sales / Inventory / Manage / Settings) with `matches` arrays for deep-route active state
- [x] Extended FAB pill button "🛒 New Sale" with visible label
- [x] Unified ComplianceCard (replaces 5 separate alert components)
- [x] /inventory hub (summary strip + 5 tiles)
- [x] /manage hub (Staff + Compliance tiles)
- [x] /sales hub rewrite (was drill-down, now landing); drill-down moved to /sales/history
- [x] Dashboard slimmed to 5 informational cards
- [x] Weekly chart + Top products moved to /sales hub
- [x] Proxy bug fix: `pathname.startsWith('/sale')` matched /sales — tightened to exact + trailing-slash
- [x] 2 new i18n namespaces (`inventory`, `manage`) × 5 locales = 10 new files
- [x] dashboard.json + sales.json updated in 5 locales (key removals + additions)
- [x] i18n parity test updated (16 → 18 namespaces)
- [x] 410 tests pass, TypeScript clean

**Acceptance:** open /dashboard → 5 cards visible (no nav cards), bottom nav shows 5 tabs, FAB shows "🛒 New Sale" label, ComplianceCard shows alerts list OR all-clear with PDF link. Tap Inventory tab → 3-col summary + 5 tiles. Tap Sales tab → Start Sale CTA + today + chart + top + recent + View by date. ✅

---

### Phase 36b — Switch User ✅ DONE

**Goal:** make it easy for the owner to hand the phone to a teller (or vice versa) without losing track of who's signed in.

- [x] Login page remembers the last 1–3 people who signed in on this device (kind, email *or* shop_code + display_name; never the password)
- [x] Tap a remembered user → switches tab + prefills non-secret fields, ready for them to type their password
- [x] In-app "Switch user" entry point lives on the avatar in the new TopAppBar — signs out, redirects to login
- [x] TopAppBar mounted in `(app)/layout.tsx` so it appears for owners *and* tellers
- [x] Onboarding records the new owner when they finish their shop setup
- [x] 5 new i18n keys (3 in `common.json`, 2 in `auth.json`) × 5 locales
- [x] No schema change
- [x] 410 tests pass, TypeScript clean

**Acceptance:** sign in as owner → top app bar shows shop name + avatar with shop initial. Tap avatar → "Signed in as {shop} · Switch user". Tap → login. Recent users shows the owner's email. Tap email → form prefilled. Sign in as teller (with shop code + name + password). Top app bar shows shop name + teller name as subtitle + avatar with teller initial. Tap → switch user → login. Recent users now shows both teller AND owner. ✅

---

### Phase 36c — Teller Access Requests + Realtime Notifications ✅ DONE

**Goal:** tellers stay bare-minimum (sales only) by default but can request inventory access from the owner. Owner gets a real-time notification, accepts or rejects.

- [x] Migration `020_access_requests.sql` — table + 2 indexes + 3 RLS policies + `ALTER PUBLICATION supabase_realtime ADD TABLE`
- [x] DB helper `src/lib/db/access-requests.ts` — list/grant/deny/revoke + `isTellerInventoryGranted` for proxy
- [x] API routes: `POST /api/access-requests` (teller), `GET ?status=...` (owner), `PATCH /[id]` (owner action), `GET /me` (teller status)
- [x] Proxy split into `TELLER_ALWAYS_ALLOWED` and `TELLER_GRANTED_ONLY` lists; grant-gated paths trigger one Supabase query per request, redirect to `/inventory` when no grant
- [x] BottomNav for tellers: 2 tabs (🧾 Sales + 📦 Inventory), no FAB
- [x] `/inventory` page: teller without grant → `TellerAccessRequestPanel` (state-aware: idle/pending/denied/revoked/expired); granted → same tile grid as owners
- [x] `NotificationBell` component: Supabase Realtime channel filtered by `shop_id`, refetches pending list on any change; bottom-sheet modal with Grant / Deny per row
- [x] TopAppBar mounts the bell when `bellShopId` is provided (owners + admins-with-shop only)
- [x] /tellers page gains an "Active access" section with revoke buttons; auto-hides when no grants
- [x] Auto-expiry checked at read time (no cron) — `listActiveGrantsForShop` and `isTellerInventoryGranted` both filter `expires_at > NOW()`
- [x] 13 new keys in `inventory.json` × 5 locales, 9 in `manage.json` × 5, 5 in `tellers.json` × 5
- [x] 410 tests pass, TypeScript clean

**Open questions resolved:**
- Notifications icon location: top app bar (option A) ✓
- Teller bottom nav: 2 tabs (Sales + locked Inventory) ✓
- Access duration: time-limited (4h) AND owner can revoke ✓
- Real-time vs polling: Supabase Realtime ✓ (zero Vercel function invocations for listening)

**One outstanding step:** the migration file exists locally but must be applied to Supabase before this code can run against prod. SQL is in the commit description and `supabase/migrations/020_access_requests.sql` — paste into Supabase SQL Editor.

---

## Phase Completion Protocol Reminder

After each sub-phase: run the full protocol in CLAUDE.md — Glob, file-tree diff, Living Scope check-off, "What was built" note, commit, push, checklist output. **STOP** after each — wait for user to say "start 36b" / "start 36c".

---

Phases 1–35c + recent UX Tweaks complete. See [ARCHIVE.md](../ARCHIVE.md) for detailed phase summaries.
