/**
 * Phase 41d — completeness guard for tasks/compliance-facts-audit.md.
 *
 * The audit doc is the single source of truth for every regulatory fact in
 * the app. Without machine enforcement, contributors will add a new fee /
 * threshold / .gov.za URL to i18n or seed and forget to log it. Within 6
 * months the audit is out of sync and the re-verification process misses
 * the new fact.
 *
 * This test scans the EN i18n + seed file for fact-like patterns and asserts
 * each one is mentioned somewhere in the audit doc. Strict-enough to catch
 * drift, loose-enough to avoid noise:
 *   - Every .gov.za / .co.za URL that appears in i18n or the seed file MUST
 *     appear in the audit doc (catches new metro URL drift).
 *   - Every Rand amount of the form `R\d{2,}` or `R\d{1,3},\d{3}` in i18n
 *     SHOULD appear in the audit doc (catches new fee / cap drift).
 *
 * We do NOT scan source TSX files for hardcoded numbers — too noisy
 * (component dimensions, z-indexes etc. look like rand amounts). i18n is
 * the right surface to police because that's where owner-visible facts live.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const AUDIT_PATH = join(ROOT, 'tasks', 'compliance-facts-audit.md')
const I18N_DIR = join(ROOT, 'src', 'lib', 'i18n', 'translations', 'en')
const SEED_PATH = join(ROOT, 'scripts', 'seed-municipalities.ts')

const auditDoc = readFileSync(AUDIT_PATH, 'utf8')

/**
 * Extract every distinct https/http URL pointing at gov.za / co.za / org.za
 * domains from a body of text. These are the URLs that link an owner to an
 * external regulatory destination — the ones that matter for verification.
 *
 * We intentionally ignore the email-domain `@*` patterns (nefcorp, joburg)
 * because the audit doc inventories those separately under "Contact info".
 */
const URL_RE = /https?:\/\/[^\s"'`<>)]+\.(?:gov\.za|co\.za|org\.za)[^\s"'`<>)]*/g

/** Extract Rand amounts of meaningful size from i18n text. */
const RAND_RE = /R\d{1,3}(?:,\d{3})+|R\d{2,}(?:\.\d+)?/g

function loadI18nText(): string {
  const files = readdirSync(I18N_DIR).filter((f) => f.endsWith('.json'))
  return files.map((f) => readFileSync(join(I18N_DIR, f), 'utf8')).join('\n')
}

function loadSeedText(): string {
  return readFileSync(SEED_PATH, 'utf8')
}

function distinct(arr: string[]): string[] {
  return [...new Set(arr)].sort()
}

/**
 * Some i18n values intentionally describe regulation concepts using rand
 * amounts that don't need their own audit-doc row (e.g. "up to R300,000" is
 * a synonym for the well-documented R300k fund cap; "R600,000" is the SARS
 * tax-free band; "R39,500" is the SARS max-tax derivation; "R2.3" is in the
 * threshold). Whitelist these so we don't ask the audit doc to repeat them
 * in every variant.
 */
const KNOWN_RAND_TOKENS = new Set([
  'R300,000',   // fund cap (in audit doc as "R300,000")
  'R250,000',   // tier 2 blended finance
  'R100,000',   // tier 1 cap + training
  'R80,000',    // CIPC unlock — in audit doc
  'R50,000',    // tier 1 infra
  'R40,000',    // tier 1 stock grant
  'R600,000',   // SARS tax-free band — in audit doc
  'R39,500',    // SARS max tax
  'R175',       // CIPC registration
  'R450',       // CIPC annual return (R1m+)
  'R100',       // CIPC annual return (<R1m)
  'R300',       // Joburg trading permit
  'R500',       // R500m fund pool (e.g. "R500 million")
  'R80,001',    // FundTierLadder label "R80,001 to R300,000" — boundary of R80k threshold
  'R349.99',    // SUBSCRIPTION_PRICE_ZAR — Movestock product price, not regulatory
])

describe('Phase 41d — compliance facts completeness', () => {
  it('every .gov.za / .co.za / .org.za URL used in i18n is in the audit doc', () => {
    const urls = distinct((loadI18nText().match(URL_RE) ?? []))
    const missing = urls.filter((url) => !auditDoc.includes(url))
    expect(
      missing,
      `i18n references URLs not listed in tasks/compliance-facts-audit.md:\n  ${missing.join('\n  ')}\n\nAdd each URL to section A (Official URLs) or the relevant fact-table row.`,
    ).toEqual([])
  })

  it('every .gov.za / .co.za URL used in seed-municipalities.ts is in the audit doc', () => {
    const urls = distinct((loadSeedText().match(URL_RE) ?? []))
    const missing = urls.filter((url) => !auditDoc.includes(url))
    expect(
      missing,
      `Seed file references URLs not listed in tasks/compliance-facts-audit.md:\n  ${missing.join('\n  ')}\n\nAdd each URL to section A (Official URLs) of the audit doc.`,
    ).toEqual([])
  })

  it('every Rand amount in i18n is either whitelisted or mentioned in the audit doc', () => {
    const rands = distinct(loadI18nText().match(RAND_RE) ?? [])
    const missing = rands.filter(
      (token) => !KNOWN_RAND_TOKENS.has(token) && !auditDoc.includes(token),
    )
    expect(
      missing,
      `i18n mentions Rand amounts not in the audit doc + not whitelisted:\n  ${missing.join('\n  ')}\n\nEither add a row in the audit doc (with source-of-truth URL) OR add the token to KNOWN_RAND_TOKENS in this test if it's a synonym of an already-documented fact.`,
    ).toEqual([])
  })

  it('audit doc still has its required structural sections', () => {
    // Sanity: the test extracts URLs from "section A" via the script too, so
    // if a future edit accidentally removes the section we want to fail fast.
    expect(auditDoc).toMatch(/## A\. Official URLs the app links to/)
    expect(auditDoc).toMatch(/## Audit log/)
    expect(auditDoc).toMatch(/## "When a new compliance step is added"/)
  })
})
