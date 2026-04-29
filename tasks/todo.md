# Movestock — Task Tracking

## Phase 37 — Compliance Module (7 sub-phases)

The Compliance Module helps spaza shop owners get legally compliant: trading permits, Certificates of Acceptability, fund applications, document packs. Read [docs spec from user] for full scope, design rules, build order. **DO NOT auto-start a sub-phase — wait for explicit go-ahead between each one per Phase Gating rule.**

### Phase 37a — Municipality Directory (Phase C in spec) ⏳ IN PROGRESS

**Goal:** A pure data layer of South African municipality offices, addresses, contacts, document requirements. Every later compliance phase auto-populates "where to go" / "what to bring" instructions from this. No user-facing screens this phase.

**Constraint (CLAUDE.md design rule 7):** Only government-verified sources. All seed data is sourced from the spec doc which references official `.gov.za` / municipality sites.

**Non-goals (this phase):**
- No UI, no API routes, no i18n changes (data isn't user-facing yet)
- No changes to any existing feature

- [ ] Migration `021_municipalities.sql`:
  - `municipalities` (id, name, province, short_name, areas TEXT[], created_at)
  - `municipality_offices` (FK municipality_id, office_type CHECK enum, name, address, area, phone, email, hours, online_portal_url, online_form_url, notes)
  - `municipality_requirements` (FK municipality_id, requirement_type CHECK enum, documents_required JSONB, fees, estimated_processing_time, additional_notes)
  - Indexes: FK indexes + GIN on `municipalities.areas`
  - RLS ON, public-read SELECT policy (reference data anyone can read), no INSERT/UPDATE/DELETE policies (service-role only writes)
- [ ] Types in `src/types/index.ts`: `Province`, `OfficeType`, `RequirementType`, `NationalityType`, `DocumentRequirement`, `Municipality`, `MunicipalityOffice`, `MunicipalityRequirement`
- [ ] Zod schemas in `src/lib/validation/schemas.ts`: `documentRequirementSchema`, `municipalitySchema`, `municipalityOfficeSchema`, `municipalityRequirementSchema`
- [ ] DB helpers in `src/lib/db/municipalities.ts`: `listMunicipalities`, `getMunicipalitiesByProvince`, `getMunicipalityById`, `findMunicipalityByArea` (case-insensitive), `getOfficesForMunicipality(id, type?)`, `getRequirements(id, type, nationality)` (filters JSONB by `applies_to`)
- [ ] Seed script `scripts/seed-municipalities.ts`: idempotent upsert by `(name, province)`. Seeds 6 metros: Johannesburg, Tshwane, Ekurhuleni, eThekwini, Cape Town, Mangaung. Each with offices + trading_permit requirements per spec.
- [ ] Tests `tests/unit/municipalities.test.ts`:
  - Requirement filter: sa_citizen sees `applies_to ∈ {sa_citizen, all}`; foreign_national sees `applies_to ∈ {foreign_national, all}`
  - Area lookup is case-insensitive
  - Province filter returns correct subset
- [ ] Run typecheck + vitest — both clean
- [ ] Output raw SQL → user runs in Supabase SQL Editor
- [ ] Verify via REST: `municipalities`, `municipality_offices`, `municipality_requirements` all exist
- [ ] Run seed script (`npx tsx scripts/seed-municipalities.ts`) — verify rows present
- [ ] Phase Completion Protocol: Glob, file-tree update, add Phase 37a to Living Scope, commit `feat: Phase 37a — Municipality Directory`, push, output checklist

### Acceptance

- 3 new tables exist in Supabase with RLS on, public-readable
- 6 metros seeded
- `findMunicipalityByArea('Soweto')` returns Johannesburg row
- `getRequirements(jhb_id, 'trading_permit', 'sa_citizen')` returns SA-applicable docs only
- All existing tests still pass (no regressions)
- No existing feature touched

### Phases 37b–37g (later)

- 37b — Compliance Onboarding (Phase A): 7-screen quiz
- 37c — Compliance Journey Hub (Phase B): personalised checklist
- 37d — Document Generation (Phase E): PDFs
- 37e — Fund Readiness Checker (Phase D)
- 37f — Foreign National Path (Phase G)
- 37g — Smart Reminders (Phase F)

---

## Phase Completion Protocol Reminder

After each sub-phase: run the full protocol in CLAUDE.md — Glob, file-tree diff, Living Scope check-off, "What was built" note, commit, push, checklist output. **STOP** after each — wait for user.

---

Phases 1–36c complete. See [ARCHIVE.md](../ARCHIVE.md) for detailed phase summaries.
