import type { Translations } from './types'

/**
 * Look up a translation key and interpolate parameters.
 * Placeholders use {name} syntax: t(tr, 'greeting', { name: 'Sam' }) → "Hello Sam"
 * Returns the key itself if the translation is missing (dev-friendly fallback).
 */
export function t(
  translations: Translations,
  key: string,
  params?: Record<string, string | number>,
): string {
  let value = translations[key]
  if (value === undefined) return key

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replaceAll(`{${k}}`, String(v))
    }
  }

  return value
}

/**
 * Plural-aware translation lookup.
 * Looks for `key_one` (count === 1) or `key_other` (everything else).
 * Falls back to `key` if plural variants are not defined.
 *
 * Usage: tPlural(tr, 'item', 3, { count: 3 }) → "3 items"
 * Requires keys: item_one = "{count} item", item_other = "{count} items"
 */
export function tPlural(
  translations: Translations,
  key: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const pluralKey = count === 1 ? `${key}_one` : `${key}_other`
  const allParams = { count, ...params }
  // Try plural form first, fall back to base key
  if (translations[pluralKey] !== undefined) {
    return t(translations, pluralKey, allParams)
  }
  return t(translations, key, allParams)
}
