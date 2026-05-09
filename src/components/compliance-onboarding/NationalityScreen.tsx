'use client'

import { useTranslation } from '@/components/LanguageProvider'
import type { NationalityType } from '@/types'

interface Props {
  value: NationalityType | null
  onPick: (next: NationalityType) => void
}

export function NationalityScreen({ value, onPick }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('nationality_title')}</h2>
      <p className="text-sm text-gray-600">{t('nationality_subtitle')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick('sa_citizen')}
          className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium ${
            value === 'sa_citizen'
              ? 'border-brand bg-brand-light text-brand-hover'
              : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          ✅ {t('nationality_yes')}
        </button>
        <button
          type="button"
          onClick={() => onPick('foreign_national')}
          className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium ${
            value === 'foreign_national'
              ? 'border-brand bg-brand-light text-brand-hover'
              : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('nationality_no')}
        </button>
      </div>
    </div>
  )
}
