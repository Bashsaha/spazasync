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
import { loadTranslations, clearTranslationCache } from '@/lib/i18n/loader'
import { t as tFn, tPlural as tPluralFn } from '@/lib/i18n/interpolate'

const STORAGE_KEY = 'spazasync_lang'

interface LanguageContextValue {
  locale: SupportedLocale
  translations: Translations
  t: (key: string, params?: Record<string, string | number>) => string
  tPlural: (key: string, count: number, params?: Record<string, string | number>) => string
  setLocale: (locale: SupportedLocale) => void
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  translations: {},
  t: (key) => key,
  tPlural: (key) => key,
  setLocale: () => {},
  isLoading: false,
})

export function useTranslation() {
  return useContext(LanguageContext)
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
  const [translations, setTranslations] = useState<Translations>({})
  const [isLoading, setIsLoading] = useState(true)

  // Load translations when locale or namespaces change
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    loadTranslations(locale, namespaces).then((tr) => {
      if (!cancelled) {
        setTranslations(tr)
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
    () => ({ locale, translations, t, tPlural, setLocale, isLoading }),
    [locale, translations, t, tPlural, setLocale, isLoading],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
