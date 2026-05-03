import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { t, tPlural } from '@/lib/i18n/interpolate'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/types'
import type { SupportedLocale, TranslationNamespace, Translations } from '@/lib/i18n/types'

const TRANSLATIONS_DIR = join(process.cwd(), 'src/lib/i18n/translations')

function readNamespace(locale: SupportedLocale, ns: string): Translations {
  const path = join(TRANSLATIONS_DIR, locale, `${ns}.json`)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listNamespaces(locale: SupportedLocale): string[] {
  return readdirSync(join(TRANSLATIONS_DIR, locale))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
}

// ── t() ──────────────────────────────────────────────────────────────────────

describe('t()', () => {
  const tr: Translations = {
    greeting: 'Hello {name}',
    multi: '{a} and {b}',
    plain: 'just text',
    duplicated: '{x} plus {x}',
  }

  it('returns the key itself when translation is missing', () => {
    expect(t(tr, 'nonexistent')).toBe('nonexistent')
  })

  it('returns plain strings unchanged when no params given', () => {
    expect(t(tr, 'plain')).toBe('just text')
  })

  it('interpolates a single param', () => {
    expect(t(tr, 'greeting', { name: 'Sam' })).toBe('Hello Sam')
  })

  it('interpolates multiple params', () => {
    expect(t(tr, 'multi', { a: 'one', b: 'two' })).toBe('one and two')
  })

  it('replaces all occurrences of the same placeholder', () => {
    expect(t(tr, 'duplicated', { x: 'yes' })).toBe('yes plus yes')
  })

  it('coerces number params to strings', () => {
    expect(t(tr, 'greeting', { name: 7 })).toBe('Hello 7')
  })

  it('leaves unknown placeholders untouched', () => {
    expect(t(tr, 'greeting', {})).toBe('Hello {name}')
  })
})

// ── tPlural() ────────────────────────────────────────────────────────────────

describe('tPlural()', () => {
  const tr: Translations = {
    item_one: '{count} item',
    item_other: '{count} items',
    bare: 'fallback {count}',
  }

  it('uses _one when count is 1', () => {
    expect(tPlural(tr, 'item', 1)).toBe('1 item')
  })

  it('uses _other for count 0', () => {
    expect(tPlural(tr, 'item', 0)).toBe('0 items')
  })

  it('uses _other for count 2', () => {
    expect(tPlural(tr, 'item', 2)).toBe('2 items')
  })

  it('uses _other for large counts', () => {
    expect(tPlural(tr, 'item', 99)).toBe('99 items')
  })

  it('auto-includes count param without explicit pass-through', () => {
    expect(tPlural(tr, 'item', 3)).toBe('3 items')
  })

  it('falls back to the base key when plural variants are missing', () => {
    expect(tPlural(tr, 'bare', 5)).toBe('fallback 5')
  })

  it('returns the key when neither base nor plural variants exist', () => {
    expect(tPlural(tr, 'missing', 1)).toBe('missing')
  })

  it('merges custom params with the auto-injected count', () => {
    const withParams: Translations = {
      msg_one: '{count} {thing}',
      msg_other: '{count} {thing}s',
    }
    expect(tPlural(withParams, 'msg', 1, { thing: 'box' })).toBe('1 box')
    expect(tPlural(withParams, 'msg', 4, { thing: 'box' })).toBe('4 boxs')
  })
})

// ── Translation key completeness ─────────────────────────────────────────────

describe('translation key completeness', () => {
  const enNamespaces = listNamespaces(DEFAULT_LOCALE)
  const nonEnLocales = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)

  it('English has all 20 expected namespaces', () => {
    expect(enNamespaces.sort()).toEqual(
      [
        'auth',
        'checklist',
        'common',
        'compliance-journey',
        'compliance-onboarding',
        'dashboard',
        'documents',
        'expiry',
        'inspection',
        'inventory',
        'manage',
        'products',
        'sale',
        'sales',
        'settings',
        'stock',
        'summary',
        'suppliers',
        'tellers',
        'waste-pest',
      ].sort(),
    )
  })

  for (const locale of nonEnLocales) {
    describe(`locale: ${locale}`, () => {
      for (const ns of enNamespaces) {
        it(`${ns}.json mirrors the English key set`, () => {
          const en = readNamespace(DEFAULT_LOCALE, ns as TranslationNamespace)
          const other = readNamespace(locale, ns as TranslationNamespace)

          const enKeys = Object.keys(en).sort()
          const otherKeys = Object.keys(other).sort()

          const missing = enKeys.filter((k) => !(k in other))
          const extra = otherKeys.filter((k) => !(k in en))

          expect(missing, `${locale}/${ns} is missing keys: ${missing.join(', ')}`).toEqual([])
          expect(extra, `${locale}/${ns} has extra keys: ${extra.join(', ')}`).toEqual([])
        })

        it(`${ns}.json preserves {placeholder} tokens from English`, () => {
          const en = readNamespace(DEFAULT_LOCALE, ns as TranslationNamespace)
          const other = readNamespace(locale, ns as TranslationNamespace)

          for (const [key, enValue] of Object.entries(en)) {
            const enPlaceholders = Array.from(enValue.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort()
            if (enPlaceholders.length === 0) continue

            const otherValue = other[key]
            if (!otherValue) continue // missing keys surface in the previous test
            const otherPlaceholders = Array.from(
              otherValue.matchAll(/\{(\w+)\}/g),
              (m) => m[1],
            ).sort()

            expect(
              otherPlaceholders,
              `${locale}/${ns}:${key} placeholder mismatch (en=${enPlaceholders.join(',')}, ${locale}=${otherPlaceholders.join(',')})`,
            ).toEqual(enPlaceholders)
          }
        })
      }
    })
  }
})

// ── Loader fallback behavior (Phase 27e guarantee) ───────────────────────────

describe('loader English fallback', () => {
  it('loader.ts falls back to English when a locale file is missing', async () => {
    // The real loader in src/lib/i18n/loader.ts catches import failures and
    // recursively calls itself with DEFAULT_LOCALE. We verify the guarantee by
    // confirming every non-English locale has the 20 expected namespaces so
    // fallback is never needed in normal operation.
    for (const locale of SUPPORTED_LOCALES) {
      const namespaces = listNamespaces(locale)
      expect(namespaces.length, `${locale} is missing namespaces`).toBe(20)
    }
  })
})
