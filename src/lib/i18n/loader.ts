import type { SupportedLocale, TranslationNamespace, Translations } from './types'
import { DEFAULT_LOCALE } from './types'

// In-memory cache to avoid re-importing the same JSON twice per session
const cache = new Map<string, Translations>()

function cacheKey(locale: SupportedLocale, ns: TranslationNamespace): string {
  return `${locale}:${ns}`
}

/**
 * Dynamically load a single translation namespace for a locale.
 * Uses import() for code-splitting — only the requested JSON is bundled.
 * Falls back to English if the requested locale file is missing.
 */
export async function loadTranslation(
  locale: SupportedLocale,
  namespace: TranslationNamespace,
): Promise<Translations> {
  const key = cacheKey(locale, namespace)
  const cached = cache.get(key)
  if (cached) return cached

  try {
    const mod = await import(`./translations/${locale}/${namespace}.json`)
    const translations: Translations = mod.default ?? mod
    cache.set(key, translations)
    return translations
  } catch {
    // Fall back to English if the locale file doesn't exist or fails to load
    if (locale !== DEFAULT_LOCALE) {
      return loadTranslation(DEFAULT_LOCALE, namespace)
    }
    // If even English fails, return empty (t() will return the key as fallback)
    return {}
  }
}

/**
 * Load multiple namespaces at once and merge them into a single flat object.
 * Later namespaces override earlier ones if keys collide (unlikely with namespacing).
 */
export async function loadTranslations(
  locale: SupportedLocale,
  namespaces: TranslationNamespace[],
): Promise<Translations> {
  const results = await Promise.all(
    namespaces.map((ns) => loadTranslation(locale, ns)),
  )
  return Object.assign({}, ...results)
}

/**
 * Load multiple namespaces and return them as a map keyed by namespace.
 * Used by LanguageProvider for namespace-scoped lookups.
 */
export async function loadNamespacedTranslations(
  locale: SupportedLocale,
  namespaces: TranslationNamespace[],
): Promise<Record<string, Translations>> {
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, await loadTranslation(locale, ns)] as const),
  )
  return Object.fromEntries(entries)
}

/** Clear the in-memory cache (useful when switching locales). */
export function clearTranslationCache(): void {
  cache.clear()
}
