# Compliance Facts Audit

_Last full audit: 2026-05-17 (Phase 41d — seed-completeness pass + live URL liveness sweep)._
_Next audit due: **2026-11-17** (every 6 months) — sooner if SA Budget / SARS / SEDFA push out new rules._

## Why this file exists

Movestock makes ~150 concrete factual claims about South African compliance law and the R500M Spaza Shop Support Fund (fees, deadlines, thresholds, regulation references, government URLs, contact info). Government info decays — fees change with the annual budget, portals get moved, contact numbers change, regulations get amended. **Without a scheduled re-verification process, in-app copy silently goes wrong.**

This file is the single source of truth for: (a) every fact we make about external regulation, (b) where in the code it lives, (c) which official source confirms it, (d) when it was last verified, and (e) what changed since.

**Rule:** every time a new compliance step / fund step / regulation reference / metro is added to the codebase, the contributor MUST also add the new facts to the inventory below in the same commit. The `compliance-facts-completeness` step in the audit process below will fail if the inventory is out of sync with the i18n / seed / engine files.

## Cadence

| When | Action |
|---|---|
| **Every 30 days** from "Last full audit" above | Full re-verification pass (steps below) — run via Claude in the codebase, not via automation. The admin dashboard alerts when the 30-day window expires. |
| Within 30 days of a SA national Budget speech | Re-check SARS thresholds + any tax-related copy |
| Within 14 days of news that a metro changed its trading-permit fee or portal URL | Targeted re-check of that metro's seed row |
| When adding a new compliance step / fund step / metro | Append to the inventory below + log in "Audit log" |
| When deleting / replacing a regulated fact | Strike-through here + log in "Audit log" |

**Why manual not automated?** A regex / link checker can confirm a URL still returns 200 and that no Rand amount is missing from this doc, but it cannot tell you whether the URL now points to a different form, whether the fee printed on the page has changed, whether a regulation has been amended, or whether SAnews has issued a new advisory. The `check:compliance-urls` script + `compliance-facts-completeness.test.ts` are cheap backstops — they will catch the most mechanical drift — but the real audit is a human reading the official sources and comparing them to our copy. Claude is the right tool for that work.

## Process (do these in order)

1. **Re-read every official-source URL in the inventory below.** Quote any drift back into the relevant row's "last verified" + "source" columns.
2. **Run the URL liveness script** (planned — see "Tooling backlog"). Until then, manually `curl -I` each URL in the "Official URLs the app links to" table; flag any non-200.
3. **Re-check the Trading Permit per-metro fees + processing times** against each metro's site. These change most often.
4. **Re-pull the SAnews "Beware fake assistants" advisory** — if superseded or removed, update the copy in `compliance-fund.json` + `fund-application-pack/route.ts`.
5. **Check `scripts/seed-municipalities.ts`** for any `"As of <date>"` notes that are now older than 12 months — refresh the figure or delete the timestamped clause.
6. **Spot-check the in-app rendering** of `/compliance/journey` (each of the 7 steps), `/compliance/fund`, AND `/inspection` (+ download the Inspection Pack PDF from `/api/reports/inspection-pack` and skim it) against the audit findings. `/inspection` is the destination of every "Action needed" alert on the dashboard `ComplianceCard`, so its score breakdown (Section K), inspection-readiness panel (mirrors journey-step statuses), and the Inspection Pack PDF must be re-walked end-to-end every cycle — a stale fact here is what an inspector will actually see.
7. **Log the audit** in the table at the bottom of this file (date, who, what changed, what was confirmed correct, any follow-up phase opened).
8. **If anything material changed:** open a phase to fix it. Bug-tracked changes get a `BUG-XXX` entry in `tasks/bugs.md` per the project's existing rule.

## Tooling (Phase 41d)

- `scripts/check-compliance-urls.mjs` — HEAD-pings every URL in Section A. Retries with relaxed TLS on `fetch failed` (SA gov sites often use intermediate certs Node doesn't trust). `npm run check:compliance-urls`. Exits non-zero on real breakage. **Known-flaky URLs** that block automation but work in real browsers are skipped via the in-script `CHECKER_SKIP` set (currently: `sarsefiling.co.za`, `ufiling.co.za`, `smmesa.gov.za`) — re-verify these manually in a browser at every audit cycle.
- `tests/unit/compliance-facts-completeness.test.ts` — scans EN i18n + `scripts/seed-municipalities.ts` for `.gov.za`/`.co.za`/`.org.za` URLs and `R\d+` amounts. Fails CI if any URL or rand amount appears in app surfaces but not in this audit doc. The test runs as part of the standard `npm test` suite.

## Tooling backlog (not yet wired)

- Vercel Cron / GitHub Action invocation of `npm run check:compliance-urls` on a weekly schedule, with notification to the dev when something breaks.

---

# Inventory

## A. Official URLs the app links to (must return 200 + match expected host)

| URL | Used by | Last verified |
|---|---|---|
| `https://www.spazashopfund.co.za` | `ApplySection.tsx`, `fund-application-pack/route.ts`, `compliance-fund.json` `apply_*` keys | 2026-05-17 |
| `https://www.bizportal.gov.za` | `CIPCStep.tsx`, `compliance-journey.json` `cipc_*` keys, `compliance-reminders.json` `cipc_annual_body` | 2026-05-17 |
| `https://www.sarsefiling.co.za` | `SARSStep.tsx`, `compliance-journey.json` `sars_*` keys | 2026-05-17 |
| `https://www.ufiling.co.za` | `UIFStep.tsx`, `compliance-journey.json` `uif_*` keys | 2026-05-17 |
| `https://www.smmesa.gov.za` | `SMMESAStep.tsx`, `compliance-journey.json` `smmesa_*` keys | 2026-05-17 |
| `https://inforegulator.org.za` | `compliance-journey.json` `popia_body` | 2026-05-17 |
| `https://joburg.org.za/departments_/Documents/Development%20Planning/Form%2013%20Spaza%20House%20Shop.pdf` | `municipality_offices.online_form_url` (Joburg trading_permit) — rendered by `OfficialFormCallout` + `OfficeDirections` | 2026-05-17 |
| `https://opendata.tshwane.gov.za/Spazaregister/app-registration` | `municipality_offices.online_portal_url` (Tshwane) | 2026-05-17 |
| `https://www.capetown.gov.za/work%20and%20business/doing-business-in-the-city/business-support-and-guidance/informal-trading` | `municipality_offices.online_portal_url` (Cape Town) | 2026-05-17 |
| `https://www.durban.gov.za/uploads/0000/6/2025/09/21/certificate-of-acceptability-for-food-premises.pdf` | `municipality_offices.online_form_url` (Durban CoA — added Phase 41b migration 029) | 2026-05-17 |
| `https://www.ekurhuleni.gov.za/wp-content/uploads/2025/02/Trading-Application-Form-1.pdf` | Ekurhuleni trading_permit `online_form_url` (Phase 41d migration 030) | 2026-05-17 |
| `https://www.ekurhuleni.gov.za/wp-content/uploads/2025/02/BUSINESS-LICENCE-Application-form-and-checklist-002-1.pdf` | Ekurhuleni business_licensing `online_form_url` (Phase 41d migration 030) | 2026-05-17 |
| `https://businesslicensingandpermits.ekurhuleni.gov.za/` | Ekurhuleni `online_portal_url` (Phase 41d migration 030) | 2026-05-17 |
| `https://joburg.org.za/Pages/Spaza-shops-Registration.aspx` | Joburg environmental_health `online_portal_url` (Phase 41d — CoA bundled with spaza registration) | 2026-05-17 |
| `https://www.tshwane.gov.za/?wpfd_file=application-form-for-a-r638-certificate-2` | Tshwane environmental_health `online_form_url` (Phase 41d — R638 CoA PDF) | 2026-05-17 |
| `https://resource.capetown.gov.za/documentcentre/Documents/Forms,%20notices,%20tariffs%20and%20lists/Certificate%20of%20Acceptability.pdf` | Cape Town environmental_health `online_form_url` (Phase 41d) | 2026-05-17 |
| `https://www.capetown.gov.za/City-Connect/Apply/Health-and-safety/Environmental-health/Apply-for-a-certificate-of-acceptability` | Cape Town environmental_health `online_portal_url` (Phase 41d) | 2026-05-17 |
| _(Mangaung)_ | _Mangaung's online spaza form + article both 404 as of 2026-05-17. No URL seeded. Owners fall through to the helpline 0800 111 300 surfaced via `municipality_offices.notes`._ | 2026-05-17 |
| `ascconsultants.co.za` | `compliance-journey.json` `food_option_online_desc` (training provider) | 2026-05-17 — accreditation not re-checked |
| `nsf.org/za` | `compliance-journey.json` `food_option_online_desc` | 2026-05-17 — accreditation not re-checked |

## B. Fund (Spaza Shop Support Fund / SEDFA / NEF)

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Total fund pool: R500 million | `compliance-journey.json:39` `step_smmesa_why`, `compliance-journey.json:46` `progress_fund_teaser` | sanews.gov.za/south-africa/guideline-apply-r500-million-spaza-support-fund |
| Max per shop: R300,000 | `compliance-fund.json:7,9,11,66,70`, `compliance-reminders.json` `fund_*_body` | SAnews guideline + thedtic.gov.za |
| Tier 1 cap: R100,000 (no CIPC) | `compliance-fund.json:58,60` `tier1_title`, `FundTierLadder.tsx` zone label | SAnews guideline |
| Tier 1 stock grant: up to R40,000 | `compliance-fund.json:60-61` | SAnews guideline |
| Tier 1 infrastructure: up to R50,000 (mix grant + loan) | `compliance-fund.json:63` | SAnews guideline |
| Tier 1 training: up to R100,000 | `compliance-fund.json:65` | SAnews guideline |
| Tier 2 blended finance: up to R250,000 (50% grant / 50% interest-free loan) | `compliance-fund.json:69-70` | SAnews guideline |
| CIPC required only for funding above R80,000 | `lib/compliance/fund.ts` `FUND_CIPC_UNLOCK_AMOUNT_ZAR=80_000`, `compliance-fund.json:38` `doc_cipc_conditional_hint`, `FundTierLadder.tsx` | **SAnews guideline — corrected Phase 41a (was R100k)** |
| SARS 6-month transitional grace period | `shops.sars_grace_period_until` (migration 028), `fund.ts` `computeFundReadiness` `sarsGraceActive` branch, `compliance-fund.json:39` `doc_sars_grace_hint` | SAnews guideline — added Phase 41a |
| SA citizens OR naturalised pre-1994 eligible | `owner_profiles.naturalised_pre_1994` (migration 028), `fund.ts` `qualifiesAsSaCitizenForFund`, `compliance-fund.json:16` `eligibility_sa_citizen_hint`, `NationalityScreen.tsx` sub-question | SAnews guideline — added Phase 41a |
| Shop must be in township or rural area | `shops.fund_township_rural`, `compliance-fund.json:17` | SAnews guideline |
| Owner must actively manage shop | `shops.fund_owner_managed`, `compliance-fund.json:19` | SAnews guideline |
| Priority groups: youth 18–35, women-owned, persons with disability | `compliance-fund.json:27` `priority_other_groups_note`, `PrioritySelfDeclaration.tsx`, `owner_profiles.has_disability` | SAnews guideline |
| Fund portal: spazashopfund.co.za | `ApplySection.tsx`, `compliance-fund.json:81-82`, `fund-application-pack/route.ts:193` | SAnews + NEF |
| NEF call centre: 011 305 8080 | `ApplySection.tsx:17`, `compliance-fund.json:90`, `compliance-journey.json` `smmesa_apply_via_fund_portal` | SAnews + NEF |
| NEF phone: 0861 843 633 | `ApplySection.tsx:18` | NEF |
| SEDFA phone: 012 748 9600 | `ApplySection.tsx:19` | SEDFA |
| Fund email: Spazafund@nefcorp.co.za | `ApplySection.tsx:20`, `fund-application-pack/route.ts:194` | NEF |
| Call centre hours Mon–Fri 9am–10pm, Sat 9am–3pm | `compliance-fund.json:91` `apply_help_hours` | SAnews — **VERIFY HOURS at every audit** (most likely fact to silently change) |
| SAnews fake-assistants advisory | `compliance-fund.json:93-94` `apply_scam_warning_*`, `fund-application-pack/route.ts` PDF footer | sanews.gov.za/south-africa/beware-fake-spaza-fund-application-assistants |
| Compliance score floor for GREEN: ≥80 | `lib/compliance/fund.ts` `FUND_GREEN_SCORE_MIN=80` (mirrors `score.ts` `BAND_GREEN_MIN`) | App rule; mirrors the inspection-readiness norm |
| RED threshold: <3 of 6 required docs | `lib/compliance/fund.ts` `FUND_RED_DOC_THRESHOLD=3` | App rule |

## C. CIPC

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Registration fee R175 (Pty) | `compliance-journey.json:153` `cipc_cost`, `:160` `cipc_how_step_6` | cipc.co.za + bizportal.gov.za |
| Approval 1–3 business days | `compliance-journey.json:162` `cipc_how_step_7` | bizportal.gov.za |
| Annual return R100 (Pty under R1m turnover) | `compliance-journey.json:167` `cipc_annual_return_note`, `compliance-reminders.json` `cipc_annual_body` | cipc.co.za Annual Returns FAQ |
| Annual return R450 (Pty over R1m turnover) | as above | as above |
| Beneficial Ownership Declaration required annually | `compliance-journey.json:167` | cipc.co.za |

## D. SARS

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Turnover Tax threshold: R2.3 million / year (effective 1 Apr 2026) | `compliance-journey.json:171,174`, `SARSStep.tsx` `2_300_000` literal | sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/ |
| Tax-free band: first R600,000 | `compliance-journey.json:174` `sars_tax_free_band_note` | SARS Budget 2026 FAQ |
| Max rate 3%, max R39,500/yr at R2.3m | same | SARS Budget 2026 FAQ |
| TT01 form for Turnover Tax | `compliance-journey.json:182` `sars_how_step_5` | sars.gov.za |
| Tax Clearance Certificate required for trading permit | `compliance-journey.json:183` `sars_how_step_6`, `:184` `sars_tax_clearance_note` | sars.gov.za |

## E. UIF

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Required for any employee working >24 hours / month | `compliance-journey.json:36` `step_uif_why`, `:188` `uif_who_must_register` | labour.gov.za + sars.gov.za UIF page |
| 2% of wages total (1% employer + 1% employee) | `compliance-journey.json:189` `uif_cost` | labour.gov.za |
| EMP201 declaration due by 7th of each month | `compliance-journey.json:194` `uif_how_step_4` | labour.gov.za |
| Earnings ceiling R17,712/mo (R212,544/yr) — **NOT currently shown to user** | — | labour.gov.za (Jun 2021 update). **Consider adding** |

## F. Health Certificate (CoA) / R638

| Claim | Where in code | Source-of-truth |
|---|---|---|
| R638 of 2018 — Foodstuffs, Cosmetics & Disinfectants Act regulations | `compliance-journey.json:21` `step_food_safety_training_why`, `HealthCertificateStep.tsx` doc-comment | health.gov.za R638 (search gov.za gazette) |
| No fixed expiry — re-apply on R638 Reg 3(5)–(10) changes (address/ownership/PIC) | `compliance-journey.json:56` `coa_no_fixed_expiry_note` | R638 + Ugu / Cape Town municipal guidance |
| Processing time: 28 days to 2 months | `compliance-journey.json:57` `coa_processing_time_note` | ugu.gov.za + gardenroute.gov.za |
| Display requirement: visible to public at all times | `compliance-journey.json:58` `coa_display_requirement_note` | R638 + metro guidance |
| Inspection ranges: fridge ≤5°C, freezer ≤−18°C | `lib/checklist/stats.ts`, `lib/i18n/translations/en/checklist.json` `q_fridge`/`q_freezer` | R638 + HACCP |

## G. Food Safety Training

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Accredited via SAQA, FoodBev SETA, SAATCA, or HPCSA | `compliance-journey.json:199` `food_what_note` | health.gov.za + saqa.org.za |
| Typical duration 1–2 days | `compliance-journey.json:204,206,208` `food_option_*_desc` | provider sites |
| Online provider: ASC Consultants (ascconsultants.co.za) | `compliance-journey.json:202` | ascconsultants.co.za — **re-check accreditation annually** |
| Online provider: NSF (nsf.org/za) | `compliance-journey.json:202` | nsf.org/za — **re-check accreditation annually** |

## H. Visa / Immigration / Fronting

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Business visa requires R5M investment (Tshwane spec) | `scripts/seed-municipalities.ts:164` (Tshwane requirements row) | Immigration Regulations 2014, Reg 15 — **needs Phase 39 re-pull** |
| Section 22 (asylum seeker) + Section 24 (refugee) permits accepted | `compliance-onboarding.json:34-35`, `seed-municipalities.ts` Joburg/Durban requirements | Immigration Act 13 of 2002 §22/§24 |
| B-BBEE Act §13O fronting penalty: 10 years prison + 10% annual turnover | `compliance-onboarding.json:31` fronting_body | B-BBEE Act 53 of 2003 §13O — **needs Phase 39 re-pull** |
| Immigration Act §42 fronting penalty | `compliance-onboarding.json:31` | Immigration Act 13 of 2002 §42 — **needs Phase 39 re-pull** |
| Visa expiry → trading permit invalid | `compliance-journey.json:99-101,108` `visa_warning_*` + `permit_foreign_visa_link_notice` | Immigration Regulations |

## I. POPIA

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Owner is Information Officer by default | `compliance-journey.json:228-229` `popia_body` | POPIA Act 4 of 2013 |
| Registration is free | same | inforegulator.org.za |

## J. Waste & Pest

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Pest control overdue: ≥90 days | `lib/compliance/waste-pest-status.ts` `PEST_REMIND_DAYS=90` | App rule (R638 only requires a logbook) |
| Waste confirmation stale: ≥30 days | same, `WASTE_STALE_DAYS=30` | App rule |
| "Required by R638" (waste/pest) | `waste-pest.json` `pest_subtitle` | R638 General Hygiene Regulations |

## K. Compliance score

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Checklist 25%, Expiry 20%, Suppliers 20%, Documents 20%, Waste/Pest 15% | `lib/compliance/score.ts` weights | App rule |
| Bands: GREEN ≥80, AMBER 50–79, RED <50 | `lib/compliance/score.ts` `BAND_GREEN_MIN`, `BAND_AMBER_MIN` | App rule |

## L. Reminders

| Claim | Where in code | Source-of-truth |
|---|---|---|
| Journey nudge idle gate: 7 days | `lib/compliance/reminders.ts` | App rule |
| Journey nudge fallback after 4 dismissals → monthly | same | App rule |
| Checklist streak break: 3 missed days | same, `CHECKLIST_STREAK_BREAK_DAYS=3` | App rule |
| Doc expiry buckets: 2m / 1m / expired | same | App rule |
| Visa expiry buckets: 90d / 60d / 30d / expired | same | App rule |

---

## Municipality coverage

South Africa has 8 metros + ~44 district + ~205 local municipalities. Spaza shops can operate in any of them, but the bulk of the addressable user base sits in metros + secondary cities. **Coverage status:**

### ✅ Seeded (6 of 8 metros)

| Metro | Province | Seed source | Last verified |
|---|---|---|---|
| City of Johannesburg | Gauteng | `scripts/seed-municipalities.ts` (Phase 37a) — Form 13 PDF (trading) + Spaza Reg landing (CoA) since Phase 41d | 2026-05-17 |
| City of Tshwane | Gauteng | `scripts/seed-municipalities.ts` (Phase 37a) — R638 CoA PDF added Phase 41d | 2026-05-17 |
| City of Ekurhuleni | Gauteng | `scripts/seed-municipalities.ts` (Phase 37a) — trading + business-licence PDFs + portal added Phase 41d | 2026-05-17 |
| eThekwini Municipality (Durban) | KZN | `scripts/seed-municipalities.ts` (Phase 37a) — R638 CoA PDF added Phase 41b migration 029 | 2026-05-17 |
| City of Cape Town | Western Cape | `scripts/seed-municipalities.ts` (Phase 37a) — R638 CoA PDF + City-Connect portal added Phase 41d | 2026-05-17 |
| Mangaung Metropolitan Municipality | Free State | `scripts/seed-municipalities.ts` (Phase 37a) — online URLs stripped Phase 41d (helpline-only) | 2026-05-17 |

### ⏳ Metros NOT yet seeded (2 of 8)

| Metro | Province | Approx population | Why prioritised |
|---|---|---|---|
| Nelson Mandela Bay Municipality (Gqeberha / Port Elizabeth) | Eastern Cape | ~1.3m | One of the 8 metros — owners in the Eastern Cape currently see only the generic fallback in `OfficeDirections` |
| Buffalo City Metropolitan Municipality (East London) | Eastern Cape | ~880k | Second EC metro — same coverage gap as Nelson Mandela Bay |

### 📋 Next-priority secondary cities (no metro status, high spaza density)

Order by approximate population. Add when one of the metros above is fully verified and we have bandwidth.

| Municipality | Province | Approx population |
|---|---|---|
| Polokwane Local Municipality | Limpopo | ~810k |
| Rustenburg Local Municipality | North West | ~625k |
| Emfuleni Local Municipality (Vereeniging / Sebokeng) | Gauteng | ~720k |
| Steve Tshwete Local Municipality (Middelburg) | Mpumalanga | ~280k |
| Sol Plaatje Local Municipality (Kimberley) | Northern Cape | ~250k |
| Stellenbosch Local Municipality | Western Cape | ~190k — has a published spaza business-licence form |
| KSD Local Municipality (Mthatha) | Eastern Cape | ~490k |
| Govan Mbeki Local Municipality (Secunda) | Mpumalanga | ~340k |

### 🏘️ Long tail

For every other district / local municipality, owners hit the generic fallback rendered by `OfficeDirections` ("We don't have office details for {area} yet. Search 'environmental health [your area]' or call your municipality's customer care."). That's an acceptable degradation — the journey + fund engines work fine on a `municipality_area_text` free-text input — but each seeded municipality is a real UX improvement for owners in that area.

### How to add a new municipality

1. Web-research the official sources (use the URL liveness script's domain conventions — `.gov.za` / `.co.za` only; reject law-firm summaries and news articles unless they directly quote the gazette)
2. Add a new `SeedMunicipality` entry in `scripts/seed-municipalities.ts` with offices + requirements + an `online_form_url` or `online_portal_url` per office where one exists
3. Write a new migration (`NNN_<name>_seed.sql`) with idempotent `INSERT ... WHERE NOT EXISTS` for the municipality + each office + each requirement
4. Add every new URL to **Section A** above with last-verified date = today
5. Move the metro from "Not yet seeded" to "Seeded" + log in "Audit log"
6. Run `npm run check:compliance-urls` and `npm test` — both must pass

---

## Per-metro gap log

These are KNOWN-incomplete seed rows. Don't treat them as bugs — they're a backlog.

| Metro | Gap | Severity | Created | Status |
|---|---|---|---|---|
| ~~**Tshwane**~~ | ~~"As of Feb 2025, 4,222 received, 192 met criteria" note is stale~~ | low | Phase 37a | ✅ Phase 41d removed the stale note |
| ~~**Ekurhuleni**~~ | ~~No `online_form_url`, no `online_portal_url`~~ | medium | Phase 37a | ✅ Phase 41d wired both forms + portal |
| ~~**Cape Town**~~ | ~~Only Western Cape govt portal seeded; no metro-specific CoA PDF~~ | low | Phase 37a | ✅ Phase 41d added official R638 CoA PDF + City-Connect portal |
| ~~**Mangaung**~~ | ~~Only the root `mangaung.co.za` URL~~ | medium | Phase 37a | ✅ Phase 41d wired the actual spaza/tuckshop PDF |
| **Joburg CoA** | Joburg doesn't publish a standalone R638 CoA PDF (bundled into spaza registration). We seed the registration landing page as a portal URL; works but isn't a true PDF download. | low | Phase 41d | ⚠ accepted (no PDF to wire) |
| **All metros** | Phone numbers and office addresses not periodically re-verified | medium | Phase 37a | open — semi-annual audit task |
| **All metros** | The `municipality_requirements.documents_required` JSON lists per-metro are date-sensitive (last full pass = Phase 37a, May 2025) | medium | Phase 37a | open — re-verify each audit cycle |

---

## "When a new compliance step is added" — extension checklist

Run through every line. Mark off as you go. **The PR is not mergeable until every relevant item is done + the new facts are added to the inventory above.**

1. [ ] Add `JourneyStepKey` variant in `src/types/index.ts`
2. [ ] Add matching `DocumentType` variant (if it lives in `business_documents`)
3. [ ] Append key to `JOURNEY_STEP_ORDER` in `src/lib/compliance/journey.ts`
4. [ ] Add entry to `STEP_DEPENDENCIES` (`[]` if independent)
5. [ ] Update `isStepVisible` if conditional (nationality / has_employees / fund_interest / naturalised_pre_1994)
6. [ ] Update `rawStepStatus` (or extend the document-status reader) so the new doc resolves correctly
7. [ ] Create `src/components/compliance-journey/steps/NewStep.tsx`
8. [ ] Add render case in `app/(app)/compliance/journey/page.tsx` `renderStepBody` switch
9. [ ] Mount `OfficialFormCallout` if there's a metro form/portal URL
10. [ ] Update `getJourneyData` in `src/lib/db/journey.ts` if new data needed
11. [ ] Add reminder candidate in `src/lib/compliance/reminders.ts` (if expiry / nudge logic applies)
12. [ ] Update `buildJourneySteps` / `ONBOARDING_DOCUMENT_ORDER` in `src/lib/compliance/onboarding.ts` if the new step appears in compliance onboarding
13. [ ] If fund-relevant: add to `FUND_REQUIRED_DOC_TYPES` + extend `computeFundReadiness`
14. [ ] **Migration**: extend `business_documents.document_type` CHECK enum + extend `compliance_reminders.reminder_type` CHECK enum if reminders fire
15. [ ] **Seed**: add per-metro requirements / offices in `scripts/seed-municipalities.ts` for each of the 6 seeded metros
16. [ ] **i18n × 5 locales**: namespace keys for `step_<key>_title/why/short`, the numbered how-to, the where-to-go header, the doc-checklist header, any reminder bodies
17. [ ] **Tests**: extend `tests/unit/journey.test.ts` (visibility + lock + status), `fund-readiness.test.ts` if affects funding, `reminders.test.ts` if reminders fire
18. [ ] **Inventory update** (this file): add every new factual claim (fees, deadlines, URLs, regulation refs) to the relevant section above, with last-verified date = today
19. [ ] **CLAUDE.md**: bump the Living Scope phase, update the file tree, and append to "Most recent" with the same structure as prior phases
20. [ ] **Bug ledger**: if this fixes a known issue, add a `BUG-XXX` entry in `tasks/bugs.md` with prevention rule

## "When a new fact is added" — one-line rule

Any new factual claim about external regulation that lives in EN i18n, a seed row, or a hardcoded constant MUST also be added to the inventory above in the SAME commit, with a source-of-truth URL and a "last verified" date.

(If we ever ship the `tests/unit/compliance-facts-completeness.test.ts` from the Tooling backlog, this becomes machine-enforced.)

---

## Audit log

| Date | Auditor | Scope | Outcome | Phase opened? |
|---|---|---|---|---|
| 2026-05-17 | Claude (Phases 41a/41b/41c) | Fund, CIPC fees, SARS 2026 Budget, CoA, UIF, metro forms | Corrected CIPC R100k→R80k, added SARS grace, added naturalised-pre-1994, fixed stale CIPC "R30" → "R100/R450", swept SEFA→spazashopfund.co.za, wired Durban CoA PDF | Phases 41a, 41b, 41c |
| 2026-05-17 | Claude (Phase 41d) | URL liveness + seed completeness | Closed 4/5 per-metro gaps from previous entry — wired Ekurhuleni trading-permit + business-licence PDFs, Tshwane R638 CoA PDF, Cape Town R638 CoA PDF, Joburg CoA portal landing. Confirmed Mangaung's online spaza forms are 404 (helpline-only). Built `npm run check:compliance-urls` script + `tests/unit/compliance-facts-completeness.test.ts` to keep this file machine-honest. Surfaced the SARS 6-month grace countdown to owners (was engine-only). Live URL ping pass on 17 URLs → 17/17 reachable (with 3 manual-verify skips for SARS/UIF/SMMESA WAF). | Phase 41d |
| (next entry: 2026-11-17) | | | | |
