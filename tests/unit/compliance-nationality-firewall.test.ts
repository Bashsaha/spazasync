/**
 * Phase 43 — automated firewall against SA-citizen-only copy leaking to
 * foreign nationals in the compliance journey.
 *
 * Foreign nationals are EXCLUDED from the R500m Spaza Shop Support Fund + the
 * SMMESA registry, cannot use BizPortal (needs an SA ID), and use a passport
 * (never an "SA ID"). We kept missing individual leaks by eye — a fund mention
 * buried in a step subtitle, a "government funding" bullet, a "Bring your ID"
 * fallback. This test makes the invariant mechanical so the 30-day human audit
 * (tasks/compliance-facts-audit.md Section M) has a net underneath it.
 *
 * Source of truth for the rules: src/lib/compliance/nationality-divergence.ts.
 *
 * The test FAILS if any compliance-journey i18n string (in ANY locale) carries
 * a citizen-only token (fund / R500m / R300k / BizPortal / SMMESA / "SA ID")
 * UNLESS its key is explicitly allowlisted as citizen-only. That forces a
 * conscious gate-or-allowlist decision instead of a silent leak.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CITIZEN_ONLY_TOKENS,
  CITIZEN_ONLY_JOURNEY_KEYS,
  FOREIGN_VISIBLE_STEP_KEYS,
  STEPS_WITH_FOREIGN_WHY,
} from '@/lib/compliance/nationality-divergence'

const ROOT = process.cwd()
const LOCALES = ['en', 'zu', 'st', 'ur'] as const

function loadNamespace(locale: string): Record<string, string> {
  const path = join(ROOT, 'src', 'lib', 'i18n', 'translations', locale, 'compliance-journey.json')
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>
}

function matchedToken(value: string): RegExp | null {
  return CITIZEN_ONLY_TOKENS.find((t) => t.test(value)) ?? null
}

describe('compliance nationality firewall — citizen-only copy must not leak to foreign nationals', () => {
  for (const locale of LOCALES) {
    it(`[${locale}] no citizen-only token appears in a non-allowlisted compliance-journey key`, () => {
      const dict = loadNamespace(locale)
      const offenders: string[] = []
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== 'string') continue
        if (CITIZEN_ONLY_JOURNEY_KEYS.has(key)) continue // intentionally citizen-only / has a _foreign variant
        const tok = matchedToken(value)
        if (tok) offenders.push(`  ${key}: "${value}"  (matched ${tok})`)
      }
      expect(
        offenders,
        `Citizen-only copy found in keys a foreign national may see. Either gate it ` +
          `behind isForeignNational with a *_foreign variant, or — if the key is ` +
          `genuinely never rendered to a foreign national — add it to ` +
          `CITIZEN_ONLY_JOURNEY_KEYS in src/lib/compliance/nationality-divergence.ts:\n` +
          offenders.join('\n'),
      ).toEqual([])
    })
  }

  it('every foreign-visible step whose _why mentions the fund has a clean _foreign variant', () => {
    const en = loadNamespace('en')
    for (const key of FOREIGN_VISIBLE_STEP_KEYS) {
      const why = en[`step_${key}_why`]
      if (!why || !matchedToken(why)) continue // subtitle is already fund-free → fine
      // It mentions a citizen-only concept, so it MUST have a foreign variant…
      expect(
        STEPS_WITH_FOREIGN_WHY.has(key),
        `step_${key}_why mentions a citizen-only concept but ${key} isn't in STEPS_WITH_FOREIGN_WHY`,
      ).toBe(true)
      const foreignWhy = en[`step_${key}_why_foreign`]
      expect(foreignWhy, `missing step_${key}_why_foreign`).toBeTruthy()
      // …and that variant must itself be clean.
      expect(
        matchedToken(foreignWhy),
        `step_${key}_why_foreign still contains a citizen-only token: "${foreignWhy}"`,
      ).toBeNull()
    }
  })

  it('the foreign "what to bring" fallbacks are passport-based, not ID-based', () => {
    const en = loadNamespace('en')
    for (const key of ['coa_requirements_fallback_foreign', 'permit_requirements_fallback_foreign']) {
      const value = en[key]
      expect(value, `missing ${key}`).toBeTruthy()
      expect(value.toLowerCase(), `${key} should tell a foreign national to bring a passport`).toContain('passport')
    }
  })
})
