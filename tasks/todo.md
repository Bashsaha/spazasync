# SpazaSync — Task Tracking

## Phase 24: Performance + Offline Hardening

### Plan
Make the app genuinely work offline from install. No new deps, no migrations.

- [ ] 24.1: IndexedDB schema v2→v3 — add `settings` + `tellers` stores, product cache TTL helpers
- [ ] 24.2: Create `public/offline.html` — self-contained offline fallback page
- [ ] 24.3: SW hardening — precache app shell (/sale, /login, /dashboard, /offline.html), offline fallback routing, cache v2, update notification
- [ ] 24.4: Cache shop settings offline — sale page loads cached threshold first, then refreshes from network
- [ ] 24.5: Cache teller list offline — TellerSelector falls back to IndexedDB on network failure
- [ ] 24.6: Online sale → offline fallback — catch network errors mid-POST and auto-queue instead of showing error
- [ ] 24.7: Product cache staleness indicator — warn user when using outdated cached products
- [ ] 24.8: Dynamic import jspdf (optional, server-side only)
- [ ] Verify: `tsc --noEmit` + `vitest run` pass
- [ ] Phase Completion Protocol (glob, file tree, Living Scope, commit, push, checklist)

---

Phases 1–23 complete. See [todo-archive.md](todo-archive.md) for detailed task lists and reviews.
