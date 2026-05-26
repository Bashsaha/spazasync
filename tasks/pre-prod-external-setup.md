# Movestock — Pre-prod External Setup

These four items are the last things gating launch. I (Claude) can't do them — they all need you to click around in third-party dashboards or buy something. Each one is self-contained, so you can do them in any order, but the order below is the cheapest + fastest path to a real production launch.

**Recommended order:** 1 → 2 → 3 → 4. Domain first because every other item references it.

---

## 1. Custom domain on Vercel

**Why it matters:** Vercel preview URLs (`*.vercel.app`) have near-zero Safe Browsing reputation. Chrome heuristics — including the "deceptive site" warning, the password-reuse alert, the install-to-home-screen icon glitch — fire aggressively on them. A registered `.co.za` domain accumulates reputation over time and is durable against future heuristic shifts. Owners trust `movestock.co.za` more than `spazasync-bashsaha.vercel.app`.

**Estimated cost:** R150–R200 / year for the `.co.za` registration.
**Estimated time:** 30–60 minutes once you have the domain.

### Steps

1. **Buy the domain.**
   - Recommended registrars: [Domains.co.za](https://www.domains.co.za) (local, ZAR billing, ~R99/yr for `.co.za`) or [Namecheap](https://www.namecheap.com) (USD billing, slightly cheaper but USD).
   - Search for `movestock.co.za`. If taken, fall back to `movestock.shop`, `usemovestock.co.za`, or similar.
   - Complete the purchase. **Don't** buy email hosting from the registrar — we'll use free Cloudflare/ImprovMX in step 2.

2. **Add the domain to Vercel.**
   - Open the Movestock project in Vercel → **Settings** → **Domains**.
   - Click **Add Domain** → enter `movestock.co.za` (and `www.movestock.co.za` as a second add) → **Add**.
   - Vercel will show two DNS records you need to add at your registrar (an `A` record for the apex and a `CNAME` for `www`, or both as `CNAME` to `cname.vercel-dns.com` if you're using Cloudflare proxying — Vercel's UI tells you exactly which).

3. **Add the DNS records at your registrar.**
   - Log into the registrar's DNS panel.
   - Paste in the records Vercel gave you. Save.
   - Vercel detects the records in 5–15 minutes; the domain status flips to **Valid Configuration**.

4. **Update `NEXT_PUBLIC_APP_URL` in Vercel.**
   - Vercel project → **Settings** → **Environment Variables**.
   - Edit `NEXT_PUBLIC_APP_URL` → set to `https://movestock.co.za` (no trailing slash).
   - Redeploy (a tiny commit, or **Deployments** → **Redeploy**).

5. **Verify the PWA still installs.**
   - On Android Chrome, open `https://movestock.co.za`. Wait 30 seconds. The install banner should appear, or Chrome menu → **Install app** should be available. Install it. Confirm the icon on the home screen is the teal Movestock check mark, NOT a generic shortcut tile.

### What this unlocks

- Pre-prod item #1 ✅ tick
- Removes the "deceptive site" warning class on any feature that uses `<input type="password">`-style fields (BUG-033/034 risk class).
- Required for OAuth verification (step 4).
- Required to use a branded support email (step 2).

---

## 2. Email forwarding for `@movestock.co.za`

**Why it matters:** Google's OAuth consent screen requires a publicly visible support email (step 4). A personal Gmail there looks unprofessional and damages trust signals. `hello@movestock.co.za` forwarding to your real inbox is free and takes 10 minutes.

**Estimated cost:** Free.
**Estimated time:** 10–15 minutes.

### Option A — Cloudflare Email Routing (recommended)

Only works if your domain's DNS is on Cloudflare. If you bought through Domains.co.za, you can transfer the nameservers to Cloudflare for free.

1. Sign up at [cloudflare.com](https://cloudflare.com) (free tier).
2. Add `movestock.co.za` as a site → follow the nameserver transfer instructions at your registrar.
3. Once DNS is on Cloudflare: open the site → **Email** → **Email Routing**.
4. Click **Enable** → Cloudflare adds the required MX + SPF records automatically.
5. Click **Create address** → set `hello@movestock.co.za` to forward to `bashiersahabodien@gmail.com`. Verify ownership of the destination (Cloudflare emails it a confirmation link).
6. Done. Test by emailing `hello@movestock.co.za` from another address.

### Option B — ImprovMX (no Cloudflare needed)

1. Sign up at [improvmx.com](https://improvmx.com) (free tier covers 25 aliases).
2. Add `movestock.co.za`. ImprovMX gives you 2 MX records to add at your registrar's DNS panel.
3. Add the records, wait 15 minutes for propagation.
4. In ImprovMX, create alias `hello@` → forward to `bashiersahabodien@gmail.com`.
5. Done.

### What this unlocks

- Pre-prod item #2 ✅ tick
- Required for OAuth verification support email (step 4).
- Required to receive customer mail at a Movestock-branded address.

---

## 3. Custom SMTP in Supabase (Resend) — ✅ DONE (2026-05-26)

**Status:** Live. Resend is wired into Supabase Auth → SMTP Settings. Movestock domain verified in Resend; sender is `noreply@movestock.co.za` / "Movestock"; invite test delivered successfully to `director@movestock.co.za`.

**Final config (for reference):**
- Resend domain: `movestock.co.za` — verified (DKIM on `resend._domainkey`, SPF + MX on the `send.` subdomain — no conflict with Google Workspace SPF on the apex)
- Resend API key name: "Supabase Movestock" (sending access scoped to movestock.co.za)
- Supabase SMTP: Host `smtp.resend.com` · Port `465` · Username `resend` · Password = Resend API key
- Sender email: `noreply@movestock.co.za` (send-only, not a real Google Workspace mailbox)
- Region match: Resend eu-west-1 ↔ Supabase eu-west-1 (Ireland)

**Honest scope:** nothing user-facing in Movestock currently triggers a Supabase email — owners log in via Google OAuth ([login/page.tsx:205](src/app/(auth)/login/page.tsx#L205)), tellers via 6-digit PIN set by the owner. This setup covers (a) edge flows like manual Supabase-dashboard invites, (b) future email-based features (welcome email, subscription expiry warning, daily summary, etc.), and (c) the prerequisite for adding email + 6-digit OTP login back as an alternative to Google (the BUG-034 pattern, now potentially viable to resurrect since the SMTP pipe exists). Templates were left as Supabase defaults — only customise them when you ship a user-facing email feature that uses them.

---

## (Original instructions kept below for historical reference)

**Why it matters:** Supabase's default mailer is rate-limited to ~4 emails/hour and routes to spam. Movestock doesn't use email-OTP for owner auth anymore (that's why login still works without this), but Supabase still sends emails for password resets and email verification on edge flows. Without custom SMTP, those silently fail or land in junk.

**Estimated cost:** Free up to 3,000 emails/month on Resend.
**Estimated time:** 15–25 minutes.

### Steps

1. **Sign up for Resend.**
   - Open [resend.com](https://resend.com), create a free account using `bashiersahabodien@gmail.com`.
   - In the Resend dashboard → **Domains** → **Add Domain** → enter `movestock.co.za`.
   - Resend gives you 3–4 DNS records (DKIM TXT records + a verification record). Copy them.

2. **Add the DNS records at your DNS host** (Cloudflare or registrar from step 1/2).
   - Paste each TXT record. Save.
   - Back in Resend, click **Verify**. May take 5–15 minutes.
   - Once verified, status flips to **Verified**.

3. **Create a Resend API key.**
   - Resend → **API Keys** → **Create API Key** → name it `Supabase SMTP` → permission **Sending access**.
   - Copy the API key (starts with `re_...`). You won't see it again.

4. **Configure Supabase SMTP.**
   - Open the Supabase project → **Project Settings** → **Auth** → **SMTP Settings**.
   - Click **Enable Custom SMTP**.
   - Fill in:
     - **Host:** `smtp.resend.com`
     - **Port:** `465`
     - **Username:** `resend`
     - **Password:** the API key from step 3
     - **Sender email:** `noreply@movestock.co.za` (or `hello@movestock.co.za`)
     - **Sender name:** `Movestock`
   - Click **Save**.

5. **Test.**
   - Supabase → **Authentication** → **Users** → click your own user → **Send password recovery**.
   - Confirm the email arrives at `bashiersahabodien@gmail.com` within 30 seconds and is NOT in spam.

### What this unlocks

- Pre-prod item #3 ✅ tick
- Password recovery / email-verification edge flows work reliably.
- The "Sender" address is branded `@movestock.co.za` — trust signal.

---

## 4. Google OAuth consent screen verification

**Why it matters:** Right now first-time owners signing in with Google see "This app isn't verified" with an "Advanced → Continue" workaround. About 30% of users back out at this screen — it looks like phishing. Verification is free and Google reviews automatically for non-sensitive scopes (we only request `email` + `profile`).

**Estimated cost:** Free.
**Estimated time:** 30 minutes of your work; 1–2 weeks of Google review time.

### Steps

1. **Open Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com) → select the Movestock project (the one whose OAuth client ID is wired into Supabase Auth).

2. **APIs & Services → OAuth consent screen.**

3. **Fill in the App Information section.**
   - **App name:** `Movestock`
   - **User support email:** `hello@movestock.co.za` (from step 2 — confirm it forwards before submitting)
   - **App logo:** upload `/public/icons/icon-512.png` from this repo (the teal Movestock check mark)
   - **Application home page:** `https://movestock.co.za`
   - **Application privacy policy link:** `https://movestock.co.za/legal/privacy`
   - **Application terms of service link:** `https://movestock.co.za/legal/terms`
   - **Authorized domains:** `movestock.co.za`
   - **Developer contact email:** `bashiersahabodien@gmail.com`

4. **Save** at the bottom of the App Information page.

5. **Scopes section.** Confirm only `email`, `profile`, `openid` are listed. If anything else is there, remove it — we don't need it and extra scopes trigger manual review.

6. **Publish.**
   - Top of the OAuth consent screen → **PUBLISH APP** button → confirm.
   - At this point the app moves from "Testing" → "In production" but with the unverified warning.

7. **Submit for verification.**
   - On the same page, look for the **Prepare for verification** or **Submit for verification** button → click it.
   - Google will email you within 1–7 days if they need anything (usually a screenshot of where the OAuth button appears in-app, or a screencast of the sign-in flow). Reply promptly — every back-and-forth adds ~3 days.

8. **Once verified** (you get an email): the warning disappears for all future sign-ins. No code change needed.

### What this unlocks

- Pre-prod item #4 ✅ tick
- ~30% conversion lift at signup (industry average for OAuth verification).
- App looks legitimately enterprise — required for selling to anyone bigger than a single shop.

---

## After all four are done

Tell me ("Claude — the external pre-prod items are done") and I'll:
1. Update the Pre-Production Checklist in CLAUDE.md to mark each item DONE.
2. Re-tighten the CSP in `vercel.json` to drop `'unsafe-inline'` + `'unsafe-eval'` (deferred until on a stable domain so we don't break local dev).
3. Suggest the rate-limit hardening migration to Upstash (small code change once you have an Upstash account — I'll write the code, you create the account + add 2 env vars).

That brings the checklist to **fully complete**.

---

## Reference — items I (Claude) have already done

- ✅ CSP + HSTS + X-Frame-Options + Referrer-Policy + Permissions-Policy in `vercel.json`
- ✅ Privacy + Terms pages live at `/legal/privacy` + `/legal/terms`
- ✅ POPIA self-service data export — owners can download their full data from Settings → Your data (added 2026-05-24)
- ✅ Account deletion path — Settings → Danger zone
- ✅ Rate limiting on auth/sensitive endpoints (teller-login, onboarding, batches, admin, **and now `/api/tellers` POST/PATCH**)
- ✅ Cost-optimisation pass — middleware JWT decode, dashboard dedupe, retention cron, query caps
- ✅ Service worker hardened (BUG-040, BUG-041)
- ✅ Secrets review — confirmed no service-role key, External API key, CRON_SECRET, or PayFast passphrase leaks into the client bundle
