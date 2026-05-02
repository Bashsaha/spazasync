'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { AreaPicker, type AreaPickerValue } from './AreaPicker'

interface Props {
  /** When truthy, shows a confirm screen ("Your shop is in X — Yes / Change")
   *  using the existing shops.municipality_id row. Set null when the shop has
   *  no municipality_id yet (legacy flow), to render the full picker. */
  preFilledName: string | null
  value: AreaPickerValue
  onChange: (next: AreaPickerValue) => void
}

export function MunicipalityScreen({ preFilledName, value, onChange }: Props) {
  const { t } = useTranslation('compliance-onboarding')
  const [editing, setEditing] = useState(!preFilledName)

  if (preFilledName && !editing) {
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-bold text-gray-900">
          {t('municipality_confirm_title', { name: preFilledName })}
        </h2>
        <p className="text-sm text-gray-600">{t('municipality_confirm_subtitle')}</p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onChange(value)}
            className="w-full text-left rounded-xl border border-blue-500 bg-blue-50 text-blue-800 px-4 py-3 text-sm font-medium"
          >
            ✅ {t('municipality_confirm_yes')}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              onChange({ municipality_id: null, municipality_area_text: null })
            }}
            className="w-full text-left rounded-xl border border-gray-200 bg-white text-gray-800 px-4 py-3 text-sm font-medium"
          >
            {t('municipality_confirm_change')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">{t('municipality_title')}</h2>
      <AreaPicker
        value={value}
        onChange={onChange}
        copyNamespace="auth"
      />
    </div>
  )
}
