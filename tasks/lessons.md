# SpazaSync — Lessons Learned

_Update this file after every user correction. Write rules that prevent the same mistake._

---

## Session 1

### Lesson 1: Directory name with spaces breaks create-next-app
**What happened:** Running `npx create-next-app@latest .` in a directory named "spaza shop" (with a space) fails because npm package names cannot contain spaces.
**Fix:** Create the project in a temp directory with a valid name, then copy all files to the target directory.
**Rule:** Before running `create-next-app` in a directory, check that the directory name is URL-safe. If not, use a temp dir and copy.

---

_Add new lessons here as they occur._
