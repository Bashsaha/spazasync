import type { SupportedLocale, TranslationNamespace, Translations } from './types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types'
import { loadTranslations } from './loader'
import { t as tFn, tPlural as tPluralFn } from './interpolate'
import { getShopAuth } from '@/lib/auth/shop-auth'

/**
 * Read the shop's language preference from the database.
 * Used by server components that need to know which locale to render.
 * Falls back to 'en' if no auth or language not set.
 */
export async function getServerLocale(): Promise<SupportedLocale> {
  const auth = await getShopAuth()
  if (!auth) return DEFAULT_LOCALE

  const { data: shop } = await auth.supabase
    .from('shops')
    .select('language')
    .eq('id', auth.shopId)
    .single()

  const lang = shop?.language as string | undefined
  if (lang && SUPPORTED_LOCALES.includes(lang as SupportedLocale)) {
    return lang as SupportedLocale
  }

  return DEFAULT_LOCALE
}

/**
 * Load translations on the server side for use in server components.
 * Returns a translations object and helper functions.
 */
export async function getServerTranslations(
  locale: SupportedLocale,
  namespaces: TranslationNamespace[],
): Promise<{
  translations: Translations
  t: (key: string, params?: Record<string, string | number>) => string
  tPlural: (key: string, count: number, params?: Record<string, string | number>) => string
  locale: SupportedLocale
}> {
  const translations = await loadTranslations(locale, namespaces)
  return {
    translations,
    t: (key, params) => tFn(translations, key, params),
    tPlural: (key, count, params) => tPluralFn(translations, key, count, params),
    locale,
  }
}
