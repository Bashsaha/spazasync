// ============================================================
// Movestock — i18n Type Definitions
// ============================================================

export type SupportedLocale = 'en' | 'zu' | 'st' | 'ur'

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'zu', 'st', 'ur']

export const DEFAULT_LOCALE: SupportedLocale = 'en'

export interface LocaleMeta {
  label: string       // English name
  nativeName: string  // Name in the language itself
  dir: 'ltr' | 'rtl'
}

export const LOCALE_META: Record<SupportedLocale, LocaleMeta> = {
  en: { label: 'English', nativeName: 'English', dir: 'ltr' },
  zu: { label: 'IsiZulu', nativeName: 'IsiZulu', dir: 'ltr' },
  st: { label: 'Sesotho', nativeName: 'Sesotho', dir: 'ltr' },
  ur: { label: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
}

export type TranslationNamespace =
  | 'common'
  | 'auth'
  | 'sale'
  | 'sales'
  | 'dashboard'
  | 'settings'
  | 'stock'
  | 'products'
  | 'tellers'
  | 'expiry'
  | 'summary'
  | 'suppliers'
  | 'checklist'
  | 'documents'
  | 'waste-pest'
  | 'inspection'
  | 'inventory'
  | 'manage'
  | 'compliance-onboarding'
  | 'compliance-journey'
  | 'compliance-fund'
  | 'compliance-reminders'
  | 'stock-loss'
  | 'sales-statistics'
  | 'guide'

export type Translations = Record<string, string>
