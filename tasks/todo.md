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

### Phase 36b — Switch User (PENDING — wait for go)

**Goal:** make it easy for the owner to hand the phone to a teller (or vice versa) without losing track of who's signed in.

- [ ] Login page remembers the last 1–3 people who signed in on this device (just `shop_code + display_name + role` in localStorage; never the password)
- [ ] Tap a remembered user → fills the login form ready for them to type their password
- [ ] In-app "Switch user" entry point (signs out, redirects to login)
- [ ] Decide where the entry point lives: avatar in a top app bar OR an item under /settings (TBD with user)
- [ ] No schema change

**Open questions:** Top app bar with avatar (1A) vs Settings page entry (1B)? User answered **1A** — but we deferred building the top app bar to 36b/36c so the structural slot opens up here.

---

### Phase 36c — Teller Access Requests + Notifications (PENDING — wait for go)

**Goal:** tellers stay bare-minimum (sales only) by default but can request inventory access from the owner. Owner gets a real-time notification, accepts or rejects.

- [ ] New `access_requests` table + RLS + migration (status enum, expires_at)
- [ ] Teller sees 2 bottom-nav tabs: Sales + Inventory (locked)
- [ ] Tapping locked Inventory → "Request access" screen → POSTs to /api/access-requests
- [ ] Real-time notification via Supabase Realtime (zero Vercel cost — listens directly to access_requests inserts)
- [ ] Floating bell icon on owner pages with badge count + tap → modal listing pending requests
- [ ] Accept/reject buttons in modal → time-limited grant (4h auto-expire) OR owner can revoke from a list under Manage → Staff
- [ ] When granted, teller can access /inventory and sub-routes; locked again after expiry/revoke
- [ ] Offline behaviour: hide "Request access" button when navigator.onLine === false; tellers can still do sales offline
- [ ] All 5 locales updated

**Open questions resolved:**
- Notifications icon location: top app bar (option A)
- Teller bottom nav: 2 tabs (Sales + locked Inventory)
- Access duration: time-limited (4h) AND owner can revoke
- Real-time vs polling: Supabase Realtime (free tier covers far more concurrent connections than launch will need)

---

## Phase Completion Protocol Reminder

After each sub-phase: run the full protocol in CLAUDE.md — Glob, file-tree diff, Living Scope check-off, "What was built" note, commit, push, checklist output. **STOP** after each — wait for user to say "start 36b" / "start 36c".

---

Phases 1–35c + recent UX Tweaks complete. See [ARCHIVE.md](../ARCHIVE.md) for detailed phase summaries.
