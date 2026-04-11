'use client'

import { SUPPORTED_LOCALES, LOCALE_META } from '@/lib/i18n/types'
import type { SupportedLocale } from '@/lib/i18n/types'

interface LanguagePickerProps {
  value: SupportedLocale
  onChange: (locale: SupportedLocale) => void
  /** 'full' = vertical list (onboarding), 'compact' = horizontal pills (login/settings) */
  variant?: 'full' | 'compact'
}

export function LanguagePicker({ value, onChange, variant = 'full' }: LanguagePickerProps) {
  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        {SUPPORTED_LOCALES.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => onChange(loc)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              value === loc
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
            }`}
          >
            {LOCALE_META[loc].nativeName}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onChange(loc)}
          className={`w-full rounded-xl px-4 py-3.5 text-left text-base font-medium transition-colors ${
            value === loc
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-900 border border-gray-200 hover:border-blue-400'
          }`}
        >
          <span>{LOCALE_META[loc].nativeName}</span>
          {loc !== 'en' && (
            <span className={`ml-2 text-sm ${value === loc ? 'text-blue-100' : 'text-gray-400'}`}>
              {LOCALE_META[loc].label}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
