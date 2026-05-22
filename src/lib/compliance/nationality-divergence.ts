/**
 * Phase 43 — single source of truth for the SA-citizen vs foreign-national
 * divergence in the compliance journey.
 *
 * WHY THIS FILE EXISTS
 * Foreign nationals are EXCLUDED from the R500m Spaza Shop Support Fund + the
 * SMMESA registry, CANNOT use BizPortal (its quick flow needs a 13-digit SA
 * ID), and present a passport — never an "SA ID" — for identity. Citizen-only
 * copy must therefore never reach a foreign national. We kept missing
 * individual leaks by eye (fund mentions buried in step subtitles, a "Bring
 * your ID" fallback, a "government funding" bullet), so this module makes the
 * invariant MECHANICAL:
 *
 *   - The rendering components (JourneyStep, NextStepHero, the step bodies)
 *     import the helpers here so they all swap the same way.
 *   - The automated firewall test (tests/unit/compliance-nationality-firewall.test.ts)
 *     imports the token list + allowlist and FAILS if any non-allowlisted
 *     compliance-journey string carries a citizen-only concept — so a future
 *     contributor can't silently re-introduce a leak.
 *
 * The human side of this lives in tasks/compliance-facts-audit.md Section M
 * (the FN-vs-citizen divergence table walked every 30 days). This file is the
 * machine backstop for that audit.
 */

import type { JourneyStepKey } from '@/types'

/**
 * Concepts that must NEVER appear in copy a foreign national can see. Kept
 * deliberately specific (e.g. "SA ID", not bare "ID") so legitimate strings
 * like "ID / Passport" don't trip the firewall.
 */
export const CITIZEN_ONLY_TOKENS: readonly RegExp[] = [
  /R500m/i,
  /R300[,\s]?000/i,
  /\bR300k\b/i,
  /government fund/i,
  /government funding/i,
  /spaza shop support fund/i,
  /\bSMMESA\b/,
  /\bBizPortal\b/i,
  /\bSA ID\b/,
  /south african id/i,
  /national ID/i,
]

/**
 * compliance-journey i18n keys that ARE allowed to contain a citizen-only
 * token — because each is one of:
 *   (a) part of an SA-citizen-only step/teaser that `isStepVisible()` (or a
 *       fund_interest gate) hides from foreign nationals;
 *   (b) the SA-citizen branch of a key that has a `_foreign` counterpart shown
 *       to foreign nationals instead;
 *   (c) foreign-only copy that names the fund ONLY to warn against fronting.
 *
 * Adding a key here is a DELIBERATE statement: "this string is citizen-only and
 * is never rendered to a foreign national." The firewall test fails if a NEW
 * key starts carrying citizen-only copy without being listed here — forcing a
 * conscious gate-or-allowlist decision instead of a silent leak.
 */
export const CITIZEN_ONLY_JOURNEY_KEYS: ReadonlySet<string> = new Set([
  // (a) SMMESA step — hidden from foreign nationals by isStepVisible
  'step_smmesa_title', 'step_smmesa_why', 'step_smmesa_short',
  'smmesa_what_header', 'smmesa_what_body', 'smmesa_how_header',
  'smmesa_how_step_1', 'smmesa_how_step_2', 'smmesa_how_step_3',
  'smmesa_open_portal', 'smmesa_apply_via_fund_portal',
  // (a) fund teasers — gated on (treatedAsCitizen && fund_interest)
  'progress_fund_teaser', 'cipc_fund_callout',
  // (b) SA-citizen branches that have *_foreign counterparts for foreigners
  'cipc_how_step_1', 'cipc_open_portal', 'cipc_form_header',
  'cipc_need_required_a',
  'step_cipc_why', 'step_sars_tax_why', 'step_municipal_registration_why',
  // (c) foreign-only copy that names a citizen-only concept ONLY to steer away
  //     from it: the fronting warning names the fund as a criminal risk; the
  //     foreign CIPC step-1 names BizPortal to say "use eServices instead".
  'rtt_fronting_body',
  'cipc_how_step_1_foreign',
])

/**
 * Journey steps a foreign national actually sees (everything except SMMESA,
 * which is fund-gated). The firewall test uses this to assert each visible
 * step's `_why` subtitle is fund-free or has a `_foreign` variant.
 */
export const FOREIGN_VISIBLE_STEP_KEYS: readonly JourneyStepKey[] = [
  'right_to_trade', 'food_safety_training', 'cipc', 'sars_tax', 'coa',
  'municipal_registration', 'uif',
]

/**
 * Steps whose `_why` subtitle mentions the fund for SA citizens and therefore
 * needs a fund-free `step_<key>_why_foreign` variant. JourneyStep + NextStepHero
 * call journeyWhyKey() so they always pick the right one.
 */
export const STEPS_WITH_FOREIGN_WHY: ReadonlySet<JourneyStepKey> = new Set<JourneyStepKey>([
  'cipc', 'sars_tax', 'municipal_registration',
])

/** Pick the `_why` subtitle key, swapping to the fund-free foreign variant where one exists. */
export function journeyWhyKey(stepKey: JourneyStepKey, isForeignNational: boolean): string {
  if (isForeignNational && STEPS_WITH_FOREIGN_WHY.has(stepKey)) {
    return `step_${stepKey}_why_foreign`
  }
  return `step_${stepKey}_why`
}
