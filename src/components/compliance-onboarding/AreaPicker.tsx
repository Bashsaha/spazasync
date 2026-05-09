'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

interface MunicipalityRow {
  id: string
  name: string
  short_name: string
  province: string
}

export interface AreaPickerValue {
  /** UUID when a municipality was picked from the list. */
  municipality_id: string | null
  /** Free text when the owner picked "Other / not sure". */
  municipality_area_text: string | null
}

interface AreaPickerProps {
  value: AreaPickerValue
  onChange: (next: AreaPickerValue) => void
  /** Pass `'auth'` when used in the initial /onboarding flow, or `'compliance-onboarding'`
   *  when used inside the modal. Drives which translation namespace strings come from. */
  copyNamespace?: 'auth' | 'compliance-onboarding'
}

/**
 * Shared area / municipality picker.
 *
 * Used both by the initial /onboarding shop-setup step (where capturing the
 * municipality is now compulsory) and by Screen 3 of the compliance-onboarding
 * modal (when the shop has neither municipality_id nor municipality_area_text
 * set — i.e. legacy shops).
 */
export function AreaPicker({ value, onChange, copyNamespace = 'auth' }: AreaPickerProps) {
  const { t } = useTranslation(copyNamespace)
  const [rows, setRows] = useState<MunicipalityRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/municipalities')
      .then((r) => r.json())
      .then((data: { municipalities?: MunicipalityRow[] }) => {
        if (cancelled) return
        setRows(data.municipalities ?? [])
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const isOther = value.municipality_id == null && value.municipality_area_text != null

  // The select shows "" when nothing picked, "OTHER" for the fallback path,
  // or the municipality UUID otherwise.
  const selectValue = useMemo(() => {
    if (value.municipality_id) return value.municipality_id
    if (isOther) return 'OTHER'
    return ''
  }, [value, isOther])

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (v === '' ) {
      onChange({ municipality_id: null, municipality_area_text: null })
    } else if (v === 'OTHER') {
      onChange({ municipality_id: null, municipality_area_text: '' })
    } else {
      onChange({ municipality_id: v, municipality_area_text: null })
    }
  }

  function handleAreaTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange({ municipality_id: null, municipality_area_text: e.target.value })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('label_area')}
        </label>
        <select
          value={selectValue}
          onChange={handleSelectChange}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand text-base"
        >
          <option value="" disabled>
            {loaded ? '—' : '…'}
          </option>
          {rows.map((m) => (
            <option key={m.id} value={m.id}>
              {m.short_name}
            </option>
          ))}
          <option value="OTHER">{t('option_area_other')}</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">{t('hint_area')}</p>
      </div>

      {isOther && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_area_text')}
          </label>
          <input
            type="text"
            value={value.municipality_area_text ?? ''}
            onChange={handleAreaTextChange}
            placeholder={t('placeholder_area_text')}
            required
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
          />
          <p className="text-xs text-gray-400 mt-1">{t('hint_area_text')}</p>
        </div>
      )}
    </div>
  )
}
