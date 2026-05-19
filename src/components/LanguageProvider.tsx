'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { SupportedLocale, TranslationNamespace, Translations } from '@/lib/i18n/types'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_META } from '@/lib/i18n/types'
import { loadNamespacedTranslations, clearTranslationCache } from '@/lib/i18n/loader'
import { t as tFn, tPlural as tPluralFn } from '@/lib/i18n/interpolate'
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n/locale-cookie'

// Intentionally not renamed during Phase 34b rebrand — changing this key would
// silently reset every user's language preference to the default on next load.
const STORAGE_KEY = 'spazasync_lang'

/** Write the locale cookie so the next server-rendered layout reads it on the
 *  fast path (no shop.language reconcile required). Locale is not a security
 *  boundary, so a non-httpOnly client-set cookie is correct here. */
function writeLocaleCookie(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return
  const attrs = [
    `${LOCALE_COOKIE}=${locale}`,
    'Path=/',
    `Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
  ]
  if (window.location.protocol === 'https:') attrs.push('Secure')
  document.cookie = attrs.join('; ')
}

interface LanguageContextValue {
  locale: SupportedLocale
  translations: Translations
  nsMap: Record<string, Translations>
  t: (key: string, params?: Record<string, string | number>) => string
  tPlural: (key: string, count: number, params?: Record<string, string | number>) => string
  setLocale: (locale: SupportedLocale) => void
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  translations: {},
  nsMap: {},
  t: (key) => key,
  tPlural: (key) => key,
  setLocale: () => {},
  isLoading: false,
})

export function useTranslation(namespace?: TranslationNamespace) {
  const ctx = useContext(LanguageContext)

  const t = useMemo(() => {
    if (!namespace) return ctx.t
    return (key: string, params?: Record<string, string | number>) => {
      // 1. Try scoped namespace
      const ns = ctx.nsMap[namespace]
      if (ns && key in ns) return tFn(ns, key, params)
      // 2. Try common namespace
      const common = ctx.nsMap['common']
      if (common && key in common) return tFn(common, key, params)
      // 3. Fall back to flat merge
      return ctx.t(key, params)
    }
  }, [namespace, ctx.nsMap, ctx.t])

  const tPlural = useMemo(() => {
    if (!namespace) return ctx.tPlural
    return (key: string, count: number, params?: Record<string, string | number>) => {
      const pluralKey = count === 1 ? `${key}_one` : `${key}_other`
      const allParams = { count, ...params }
      const ns = ctx.nsMap[namespace]
      const common = ctx.nsMap['common']
      // Try scoped namespace (plural then base)
      if (ns && pluralKey in ns) return tFn(ns, pluralKey, allParams)
      if (ns && key in ns) return tFn(ns, key, allParams)
      // Try common namespace
      if (common && pluralKey in common) return tFn(common, pluralKey, allParams)
      if (common && key in common) return tFn(common, key, allParams)
      // Flat fallback
      return ctx.tPlural(key, count, params)
    }
  }, [namespace, ctx.nsMap, ctx.tPlural])

  return useMemo(
    () => ({ ...ctx, t, tPlural }),
    [ctx, t, tPlural],
  )
}

/** Read locale from localStorage synchronously (avoids flash of wrong language). */
function getStoredLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_LOCALE
}

interface LanguageProviderProps {
  children: ReactNode
  /** Server-determined locale (optional, takes priority on first render). */
  initialLocale?: SupportedLocale
  /** Which translation namespaces to load. Defaults to ['common']. */
  namespaces?: TranslationNamespace[]
  /**
   * Pre-loaded server-side translations keyed by namespace. When supplied
   * (typical for the (app) layout) the provider skips the client-side fetch
   * entirely — saving 23+ chunk round trips on first paint. The client-side
   * fetch still runs if the locale changes at runtime.
   */
  initialNsMap?: Record<string, Translations>
}

export function LanguageProvider({
  children,
  initialLocale,
  namespaces = ['common'],
  initialNsMap,
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    () => initialLocale ?? getStoredLocale(),
  )
  // Seed nsMap from server-rendered translations when available so first paint
  // doesn't have to wait on dynamic JSON imports. Tracks the locale we
  // hydrated with so a runtime locale change still triggers a client fetch.
  const [nsMap, setNsMap] = useState<Record<string, Translations>>(
    () => initialNsMap ?? {},
  )
  const [hydratedLocale, setHydratedLocale] = useState<SupportedLocale | null>(
    () => (initialNsMap ? initialLocale ?? null : null),
  )
  const [isLoading, setIsLoading] = useState(() => !initialNsMap)

  // Derive flat translations from nsMap
  const translations = useMemo(
    () => Object.assign({}, ...Object.values(nsMap)) as Translations,
    [nsMap],
  )

  // Load translations when locale or namespaces change — but skip the very
  // first render when the server already hydrated us with the right locale.
  useEffect(() => {
    if (hydratedLocale === locale) return

    let cancelled = false
    setIsLoading(true)

    loadNamespacedTranslations(locale, namespaces).then((map) => {
      if (!cancelled) {
        setNsMap(map)
        setHydratedLocale(locale)
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, JSON.stringify(namespaces)])

  // Sync HTML attributes when locale changes
  useEffect(() => {
    const dir = LOCALE_META[locale]?.dir ?? 'ltr'
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale])

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale)
    clearTranslationCache()
    try {
      localStorage.setItem(STORAGE_KEY, newLocale)
    } catch {
      // localStorage not available
    }
    writeLocaleCookie(newLocale)
  }, [])

  // Self-heal: if the server hydrated us with a locale but the cookie isn't
  // set (e.g. existing user before this deploy, or cookies cleared), write
  // it now so the next page load lands on the fast path in the layout.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const hasCookie = document.cookie
      .split(';')
      .some((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`))
    if (!hasCookie) writeLocaleCookie(locale)
  }, [locale])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      tFn(translations, key, params),
    [translations],
  )

  const tPlural = useCallback(
    (key: string, count: number, params?: Record<string, string | number>) =>
      tPluralFn(translations, key, count, params),
    [translations],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, translations, nsMap, t, tPlural, setLocale, isLoading }),
    [locale, translations, nsMap, t, tPlural, setLocale, isLoading],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
