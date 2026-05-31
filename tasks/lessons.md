# SpazaSync — Lessons Learned

_Update this file after every user correction. Write rules that prevent the same mistake._

---

## Session 1

### Lesson 1: Directory name with spaces breaks create-next-app
**What happened:** Running `npx create-next-app@latest .` in a directory named "spaza shop" (with a space) fails because npm package names cannot contain spaces.
**Fix:** Create the project in a temp directory with a valid name, then copy all files to the target directory.
**Rule:** Before running `create-next-app` in a directory, check that the directory name is URL-safe. If not, use a temp dir and copy.

---

## Session 2

### Lesson 2: Never auto-start the next phase
**What happened:** After completing Phase 1, immediately started Phase 2 without waiting for user approval.
**Fix:** Added "Phase Gating" rule to CLAUDE.md Workflow Orchestration Rules.
**Rule:** After completing ANY phase: (1) update CLAUDE.md with what was built, (2) STOP and WAIT for the user to explicitly say "start phase N" or "go". Never auto-continue.

### Lesson 3: Read CLAUDE.md rules before acting
**What happened:** Skipped plan mode and started coding directly on a multi-phase task, violating CLAUDE.md workflow rules.
**Fix:** Always read CLAUDE.md at session start. Enter plan mode for any task with 3+ steps.
**Rule:** The workflow rules in CLAUDE.md are not optional. Follow them exactly.

### Lesson 4: Follow EVERY step of every protocol — not just the ones you remember
**What happened:** Failed to follow Session Start Protocol (didn't read CLAUDE.md fully, didn't review lessons.md, didn't read bugs.md before touching auth/routing). Failed to follow Phase Completion Protocol step 1 (didn't run Glob scan before updating file tree — just manually added files from memory). Failed to commit at the right time (should commit as part of phase completion, not as an afterthought when user points it out).
**Fix:** Treat protocols as checklists. Execute every numbered step in order. Don't skip steps because you think you already know what's there.
**Rule:** At session start: execute Session Start Protocol steps 1-6 in order. At phase end: execute Phase Completion Protocol steps 1-7 in order. If a step says "Glob scan" — run the Glob scan. If it says "read bugs.md" — read bugs.md. No shortcuts.

---

## Session 3

### Lesson 5: Figure out the next phase from context — don't ask
**What happened:** After completing Phase 16b, asked the user "what should the next phase be?" instead of reading the codebase state and figuring it out. Phase 16a built admin CRUD functions (list/create/update/delete catalog entries) with no UI — the obvious next step was Phase 16c: Admin Catalog Management UI.
**Fix:** Before asking "what's next?", check what was built in the previous phases. Look for backend code without corresponding UI, or features referenced in CLAUDE.md that have no implementation yet.
**Rule:** When determining the next phase: (1) read what the last phase built, (2) identify gaps (backend without UI, referenced but unbuilt features), (3) propose the next phase confidently. Don't dump a menu of options — figure it out.

---

## Session 4

### Lesson 6: Read the Living Scope BEFORE proposing next phases
**What happened:** After Phase 17a, proposed a "Sales History" phase as 17b — but CLAUDE.md already had Phase 17b through 17d defined in the Living Scope with a clear implementation order (17a → 17b → 17d → 17c) and context about SA compliance (R638). Started implementing the wrong phase, had to revert all changes.
**Fix:** Always read the Living Scope section fully — it may already define upcoming phases. Only propose new phases if the Living Scope has no unchecked entries.
**Rule:** Before proposing or starting ANY next phase: (1) read the Living Scope for unchecked phases, (2) if unchecked phases exist, follow them in order, (3) only invent new phases if ALL Living Scope items are checked off.

---

## Session 5

### Lesson 7: READ CLAUDE.md before updating it — check ALL sections, not just the phase notes
**What happened:** When updating CLAUDE.md after Phase 18b, only added the "What was built" section and file tree entries. Missed updating the Database Schema section (products table missing the new name uniqueness constraint, product_batches table never added, decrement_stock_fefo SQL function missing). User had to call it out.
**Fix:** Read the entire CLAUDE.md before updating it. Cross-check every section that could be affected: Database Schema (tables, constraints, functions), File Tree, Living Scope, phase notes.
**Rule:** When updating CLAUDE.md after a phase: (1) read the full file first, (2) check Database Schema section for any new tables/constraints/functions, (3) check File Tree for new/changed files, (4) check Living Scope for phase checkbox, (5) add "What was built" notes. Don't just add the obvious parts — scan every section.

---

---

## Session 6

### Lesson 8: Always output the explicit protocol checklist — every single time
**What happened:** Completed Phase 21 UX improvements and the compliance PDF change. Updated CLAUDE.md, committed, pushed. But never output the Step 8 completion confirmation checklist. User had to call it out twice.
**Fix:** After every phase completion, ALWAYS print the checklist verbatim: "Phase completion checklist: Glob scanned ✓, file tree updated ✓, Living Scope checked off ✓, commit [hash] pushed ✓." No exceptions, even for small changes.
**Rule:** Step 8 of the Phase Completion Protocol is not optional. It is the proof the protocol was followed. If you do not output the checklist, the user cannot trust the protocol ran. Output it every time, even if you think it's obvious.

---

## Lesson: Never write files before the plan is approved

**What happened:** Started creating API route files immediately after reading the codebase, skipping EnterPlanMode, tasks/todo.md planning, and user sign-off entirely.

**Rule:** For ANY task with 3+ steps or architectural decisions, the mandatory order is:
1. EnterPlanMode
2. Explore codebase
3. Write plan to tasks/todo.md
4. Present plan via ExitPlanMode
5. WAIT for user approval
6. Only then write a single line of code

Creating files before step 5 is a protocol violation regardless of how confident you are about the approach.

---

## Lesson: Always commit and push at phase completion — no exceptions

**What happened:** Completed Phase 22 implementation, ran type checks, updated lessons.md — then stopped without committing or pushing.

**Rule:** Step 7 of the Phase Completion Protocol is mandatory: stage all changed files, commit with `feat: Phase N — <short description>`, and push to `main`. This is not optional even if the user doesn't explicitly ask. The protocol always ends with a pushed commit.

---

## Lesson: Phase Completion Protocol runs IMMEDIATELY after code is verified — not as an afterthought

**What happened:** Completed Phase 23 implementation, ran type-check and tests, then stopped. Did not run the Phase Completion Protocol (Glob scan, file tree update, Living Scope update, commit, push, checklist output). User had to call it out — again.

**Rule:** The moment `tsc --noEmit` passes and tests pass, the NEXT thing that happens is the Phase Completion Protocol steps 1–10 in order. There is no gap between "code works" and "protocol runs." Do not mark todos as complete, do not output a summary to the user, do not do anything else until all 10 steps are executed. The protocol IS the final step of every phase — not a separate task to remember later.

---

## Lesson: Phase 44a shell-mechanism decision (App Shell Architecture spike — approach A over B)

**Decision:** For the instant-open / resume-fix work, chose **approach A** (keep the
`(app)` layout a Server Component but stop blocking first paint on user data; verify
auth locally with `getClaims()`; coordinate resume via a single `ResumeGuard` →
`RESUME_READY` event) over **approach B** (a dedicated fully-client shell route).

**Why A:** Lowest risk, no big-bang rewrite, ships the two crash fixes + cost
reduction immediately, and crucially does NOT cache any user-specific HTML — so the
BUG-040 invariant (never cache auth HTML with data baked in) is preserved. The
full "SW serves a cached data-free shell HTML so cold open is instant" work is
deferred to **Phase 44b**, done **per screen** and only enabled for a route once
that route's server render is verified data-free. This keeps each step
phone-testable and reversible.

**Rule:** When converting a server-rendered authed PWA toward an app-shell model,
do it incrementally and gate SW HTML caching per-route behind a proven
"data-free render" — never flip cache-first navigation on globally (that's exactly
how BUG-040 leaked one user's data to another on a shared phone).

---

_Add new lessons here as they occur._
