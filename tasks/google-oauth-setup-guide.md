# Movestock — Google OAuth Setup & Verification Guide

**Goal:** Make Google sign-in look professional and remove the "This app isn't verified — Advanced → Continue" warning new owners see on first sign-in, while moving ownership of the OAuth project to the Movestock Workspace account.

**Last updated:** 2026-05-29

---

## Key facts before you start

- **No Supabase changes are needed** if you keep the same OAuth Client ID + Secret (the recommended path below). The Client ID/Secret belong to the *project*, not to a user account — so sharing/removing accounts never breaks sign-in.
- The OAuth **"User support email"** dropdown only offers:
  1. the email of the account you're **currently logged in as**, and
  2. **Google Groups** that the logged-in account **owns/manages**.
  That's why we use a Group for `customersupport@`.
- Movestock requests **only non-sensitive scopes** (`email`, `profile`, `openid`), so a full manual verification is often **not required** — publishing to production usually clears the warning within minutes.

---

## Phase 1 — Give the Workspace account ownership *(logged in as the PERSONAL Gmail)*

1. Go to **https://console.cloud.google.com**.
2. Top-left **project picker** → select the **Movestock** project.
3. ☰ menu → **IAM & Admin** → **IAM**.
4. Click **Grant access** (or **+ Add**).
5. **New principals:** enter `director@movestock.co.za`.
6. **Role:** **Owner**.
7. **Save.**

✅ Checkpoint: the Workspace address shows in the IAM table with role **Owner**.

> Keep at least one Owner at all times. Don't remove the personal account until the Workspace account is confirmed working (see "Removing the personal account" at the end).

---

## Phase 2 — Switch accounts

8. **Sign out** of Google → **sign in as `director@movestock.co.za`**.
9. Cloud Console → **project picker** → select **Movestock** (now visible to this account).

---

## Phase 3 — Create the support-email Google Group *(as director@)*

Using a Group means the support address survives staff changes and can be edited without ever touching the consent screen again.

1. Go to **https://admin.google.com** (signed in as `director@`).
2. ☰ → **Directory** → **Groups** → **Create group**.
   - **Name:** Customer Support
   - **Group email:** `customersupport@movestock.co.za`
3. **Access settings** — start from **Restricted**, then set these explicitly:
   - **Who can post / contact this group:** **Anyone on the web** ← essential, so customer + Google emails actually arrive
   - **Who can view conversations:** Group members (or Owners/Managers)
   - **Who can join the group:** Only invited users
   - **Who can view members:** Owners and managers
   - **Allow members outside your organization:** **OFF** (you need external *senders*, not external *members*)
4. **Add `director@movestock.co.za` as an Owner** of the group — this is what makes it selectable on the consent screen, and it also makes `director@` a member so the mail has somewhere to land.
5. Add anyone else who should monitor support as members (optional now, editable anytime).
6. Save. Give it a few minutes to propagate.

✅ Checkpoint: in the group's **Members** list, `director@` shows role **Owner** with subscription set to receive mail.

---

## Phase 4 — Branding *(OAuth consent screen, as director@)*

1. ☰ → **APIs & Services** → **OAuth consent screen** → **Branding** tab.
2. Fill in:
   - **App name:** `Movestock`
   - **User support email:** select `customersupport@movestock.co.za` (appears now that the group exists and director@ owns it). *If it's not in the dropdown yet, reload the page; group propagation can take a few minutes.*
   - **App logo:** upload `public/icons/icon-512.png` from the repo (teal check mark, ~16 KB)
   - **Application home page:** `https://movestock.co.za`
   - **Privacy policy link:** `https://movestock.co.za/legal/privacy`
   - **Terms of service link:** `https://movestock.co.za/legal/terms`
   - **Authorized domains:** add `movestock.co.za` (bare domain, no `https://`)
   - **Developer contact email:** a Workspace address (not the personal Gmail)
3. **Save.**

---

## Phase 5 — Scopes (keep minimal)

1. **Data Access** tab (older layout: **Scopes**).
2. Confirm **only**: `.../userinfo.email`, `.../userinfo.profile`, `openid`.
3. Remove anything else (Drive, Gmail, Calendar, etc.). Save.

---

## Phase 6 — Publish to production

1. **Audience** tab.
2. If **Publishing status** = **Testing** → click **Publish app** → confirm.
3. **User type** should be **External**.

---

## Phase 7 — Test that the warning cleared

1. Open an **incognito window** → `https://movestock.co.za/login` → owner tab → **Sign in with Google**.
2. **No "unverified" screen** → done. 🎉
3. **Still see the warning** → go to **Verification Center** → **Submit for verification**. Google may ask for a screenshot/screencast of the sign-in button (it's on `/login`, owner tab) and/or domain ownership proof via Search Console. Reply promptly — each round-trip adds ~3 days.

---

## Removing the personal Gmail (do this LAST, after everything works)

Before removing/deleting the personal account:
1. Confirm the Workspace account works fully as Owner (can edit consent screen + see credentials).
2. **Developer contact email** is set to a Workspace address (Branding tab).
3. No **billing** account is owned solely by the personal account (Billing — OAuth needs none, but check).
4. If Google asked for domain verification, the **Search Console** property for `movestock.co.za` is accessible by the Workspace account.
5. At least one **Owner** remains (the Workspace account).

Then:
- Remove access only: ☰ → **IAM & Admin → IAM** → personal Gmail row → **Remove**.
- Wait a day, re-confirm sign-in + consent editing under the Workspace account, *then* delete the Gmail if you want.

**Supabase:** never changes throughout any of this.

---

## Quick reference — values to paste

| Field | Value |
|---|---|
| App name | `Movestock` |
| User support email | `customersupport@movestock.co.za` (Group) |
| Logo | `public/icons/icon-512.png` |
| Home page | `https://movestock.co.za` |
| Privacy policy | `https://movestock.co.za/legal/privacy` |
| Terms of service | `https://movestock.co.za/legal/terms` |
| Authorized domain | `movestock.co.za` |
| Scopes | `email`, `profile`, `openid` only |
| Supabase Google callback | `https://<project-ref>.supabase.co/auth/v1/callback` |
