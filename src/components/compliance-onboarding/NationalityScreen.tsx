'use client'

/**
 * Phase 37b — captures nationality_type.
 * Phase 41a — adds an inline sub-question for foreign-born owners: "Were you
 *   naturalised as a SA citizen before 1994?" Per the SEFA / SAnews guideline,
 *   those owners qualify for the R500M Spaza Shop Support Fund. We keep this
 *   inline (no extra screen) so the 7-screen count stays the same for SA-born
 *   owners and only foreign-born owners see the extra question.
 */

import { Check } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import type { NationalityType } from '@/types'

interface Props {
  value: NationalityType | null
  onPick: (next: NationalityType) => void
  /** Phase 41a — sub-question state. Only meaningful when value === 'foreign_national'. */
  naturalisedPre1994: boolean | null
  onPickNaturalised: (next: boolean) => void
}

export function NationalityScreen({
  value,
  onPick,
  naturalisedPre1994,
  onPickNaturalised,
}: Props) {
  const { t } = useTranslation('compliance-onboarding')
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('nationality_title')}</h2>
      <p className="text-sm text-gray-600">{t('nationality_subtitle')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick('sa_citizen')}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === 'sa_citizen'
              ? 'border-brand bg-brand-light text-brand-hover'
              : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" strokeWidth={2.25} />{t('nationality_yes')}</span>
        </button>
        <button
          type="button"
          onClick={() => onPick('foreign_national')}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value === 'foreign_national'
              ? 'border-brand bg-brand-light text-brand-hover'
              : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('nationality_no')}
        </button>
      </div>

      {value === 'foreign_national' && (
        <div className="rounded-2xl border border-brand-light bg-brand-light/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('naturalised_title')}
          </h3>
          <p className="text-xs text-gray-600">{t('naturalised_subtitle')}</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onPickNaturalised(true)}
              className={`w-full text-left rounded-full border px-4 py-2.5 text-sm font-medium ${
                naturalisedPre1994 === true
                  ? 'border-brand bg-white text-brand-hover'
                  : 'border-gray-200 bg-white text-gray-800'
              }`}
            >
              {t('naturalised_yes')}
            </button>
            <button
              type="button"
              onClick={() => onPickNaturalised(false)}
              className={`w-full text-left rounded-full border px-4 py-2.5 text-sm font-medium ${
                naturalisedPre1994 === false
                  ? 'border-brand bg-white text-brand-hover'
                  : 'border-gray-200 bg-white text-gray-800'
              }`}
            >
              {t('naturalised_no')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
