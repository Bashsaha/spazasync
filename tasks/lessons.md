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

_Add new lessons here as they occur._
