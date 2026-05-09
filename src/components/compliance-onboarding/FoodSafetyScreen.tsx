'use client'

import { useTranslation } from '@/components/LanguageProvider'

interface Value {
  completed: boolean | null
  date: string | null
  provider: string | null
}

interface Props {
  value: Value
  onChange: (next: Value) => void
}

export function FoodSafetyScreen({ value, onChange }: Props) {
  const { t } = useTranslation('compliance-onboarding')

  function pick(completed: boolean | null) {
    if (completed === true) {
      onChange({ completed: true, date: value.date, provider: value.provider })
    } else {
      onChange({ completed, date: null, provider: null })
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">{t('food_safety_title')}</h2>
      <p className="text-sm text-gray-600">{t('food_safety_subtitle')}</p>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => pick(true)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value.completed === true ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          ✅ {t('food_safety_yes')}
        </button>
        <button
          type="button"
          onClick={() => pick(false)}
          className={`w-full text-left rounded-full border px-4 py-3 text-sm font-medium ${
            value.completed === false ? 'border-brand bg-brand-light text-brand-hover' : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t('food_safety_no')}
        </button>
      </div>

      {value.completed === true && (
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('food_safety_when_label')}
            </label>
            <input
              type="date"
              value={value.date ?? ''}
              onChange={(e) =>
                onChange({ ...value, date: e.target.value || null })
              }
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('food_safety_provider_label')}
            </label>
            <input
              type="text"
              value={value.provider ?? ''}
              onChange={(e) =>
                onChange({ ...value, provider: e.target.value || null })
              }
              placeholder={t('food_safety_provider_placeholder')}
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
            />
          </div>
        </div>
      )}
    </div>
  )
}
