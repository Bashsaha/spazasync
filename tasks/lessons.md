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

_Add new lessons here as they occur._
