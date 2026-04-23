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

// Intentionally not renamed during Phase 34b rebrand — changing this key would
// silently reset every user's language preference to the default on next load.
const STORAGE_KEY = 'spazasync_lang'

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
}

export function LanguageProvider({
  children,
  initialLocale,
  namespaces = ['common'],
}: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(
    () => initialLocale ?? getStoredLocale(),
  )
  const [nsMap, setNsMap] = useState<Record<string, Translations>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Derive flat translations from nsMap
  const translations = useMemo(
    () => Object.assign({}, ...Object.values(nsMap)) as Translations,
    [nsMap],
  )

  // Load translations when locale or namespaces change
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    loadNamespacedTranslations(locale, namespaces).then((map) => {
      if (!cancelled) {
        setNsMap(map)
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
  }, [])

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
