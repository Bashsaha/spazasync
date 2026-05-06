'use client'

/**
 * Phase 37f — Onboarding screen shown to foreign-national owners only.
 *
 * Captures (a) a fronting notice — informational, framed helpfully — and
 * (b) the owner's visa/permit type + expiry date. The expiry date can be
 * left blank via the "I don't know / doesn't expire" toggle (Section 22
 * asylum seeker permits, for example, may not have a fixed end date).
 */

import { useTranslation } from '@/components/LanguageProvider'
import type { VisaType } from '@/types'

const VISA_OPTIONS: VisaType[] = [
  'business_visa',
  'asylum_seeker_s22',
  'refugee_s24',
  'work_permit',
  'other',
]

export interface VisaScreenValue {
  type: VisaType | null
  expiryDate: string | null
  dontKnow: boolean
}

interface Props {
  value: VisaScreenValue
  onChange: (next: VisaScreenValue) => void
}

export function VisaScreen({ value, onChange }: Props) {
  const { t } = useTranslation('compliance-onboarding')

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('visa_title')}</h2>
      <p className="text-sm text-gray-600">{t('visa_subtitle')}</p>

      <section className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm">
        <h3 className="font-semibold text-blue-900 mb-1">{t('fronting_title')}</h3>
        <p className="text-blue-800 leading-relaxed">{t('fronting_body')}</p>
      </section>

      <div>
        <p className="text-sm font-semibold text-gray-800 mb-2">{t('visa_type_label')}</p>
        <div className="space-y-2">
          {VISA_OPTIONS.map((opt) => {
            const selected = value.type === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ ...value, type: opt })}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium ${
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                {t(`visa_type_${opt}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          {t('visa_expiry_label')}
        </label>
        <input
          type="date"
          value={value.expiryDate ?? ''}
          disabled={value.dontKnow}
          onChange={(e) =>
            onChange({ ...value, expiryDate: e.target.value || null })
          }
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value.dontKnow}
            onChange={(e) =>
              onChange({
                ...value,
                dontKnow: e.target.checked,
                expiryDate: e.target.checked ? null : value.expiryDate,
              })
            }
            className="w-4 h-4"
          />
          {t('visa_expiry_dont_know')}
        </label>
      </div>
    </div>
  )
}
