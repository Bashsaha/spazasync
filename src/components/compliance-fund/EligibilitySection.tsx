'use client'

/**
 * Phase 37e — Eligibility toggles.
 *
 * Three Yes/No questions with optimistic state. Calls PATCH
 * /api/compliance/fund/eligibility on each change. Per BUG-017 this
 * client component reads its own translations via useTranslation.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  initialTownshipRural: boolean | null
  initialOwnerManaged: boolean | null
  initialHasDisability: boolean
}

type Field = 'fund_township_rural' | 'fund_owner_managed' | 'has_disability'

export function EligibilitySection({
  initialTownshipRural,
  initialOwnerManaged,
  initialHasDisability,
}: Props) {
  const { t } = useTranslation('compliance-fund')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [township, setTownship] = useState<boolean | null>(initialTownshipRural)
  const [owner, setOwner] = useState<boolean | null>(initialOwnerManaged)
  const [disability, setDisability] = useState<boolean>(initialHasDisability)
  const [error, setError] = useState<string | null>(null)

  async function persist(field: Field, value: boolean | null) {
    setError(null)
    try {
      const res = await fetch('/api/compliance/fund/eligibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        setError(t('eligibility_save_failed'))
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError(t('eligibility_save_failed'))
    }
  }

  function update(field: Field, value: boolean) {
    if (field === 'fund_township_rural') setTownship(value)
    else if (field === 'fund_owner_managed') setOwner(value)
    else setDisability(value)
    void persist(field, value)
  }

  const blocked = township === false || owner === false

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">
        {t('eligibility_header')}
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        {t('eligibility_subtitle')}
      </p>

      <div className="space-y-4">
        <CheckRow
          label={t('eligibility_sa_citizen_label')}
          hint={t('eligibility_sa_citizen_hint')}
          checked
          locked
        />

        <YesNoRow
          label={t('eligibility_township_rural_label')}
          hint={t('eligibility_township_rural_hint')}
          value={township}
          onChange={(v) => update('fund_township_rural', v)}
          yesLabel={t('answer_yes')}
          noLabel={t('answer_no')}
          disabled={pending}
        />
        <YesNoRow
          label={t('eligibility_owner_managed_label')}
          hint={t('eligibility_owner_managed_hint')}
          value={owner}
          onChange={(v) => update('fund_owner_managed', v)}
          yesLabel={t('answer_yes')}
          noLabel={t('answer_no')}
          disabled={pending}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-700 mb-1">
          {t('priority_header')}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          {t('priority_subtitle')}
        </p>
        <YesNoRow
          label={t('priority_disability_label')}
          hint={t('priority_disability_hint')}
          value={disability}
          onChange={(v) => update('has_disability', v)}
          yesLabel={t('answer_yes')}
          noLabel={t('answer_no')}
          disabled={pending}
        />
      </div>

      {blocked && (
        <p className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          ⚠️ {t('eligibility_blocked_warning')}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}
    </section>
  )
}

function CheckRow({
  label,
  hint,
  checked,
  locked,
}: {
  label: string
  hint: string
  checked: boolean
  locked?: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-emerald-600 text-base leading-none">
          {checked ? '✅' : '☐'}
        </span>
        <p className="text-sm font-medium text-gray-900">{label}</p>
      </div>
      <p className="text-xs text-gray-500 ml-6 mt-0.5">
        {hint}
        {locked ? ` · ${''}` : ''}
      </p>
    </div>
  )
}

function YesNoRow({
  label,
  hint,
  value,
  onChange,
  yesLabel,
  noLabel,
  disabled,
}: {
  label: string
  hint: string
  value: boolean | null
  onChange: (v: boolean) => void
  yesLabel: string
  noLabel: string
  disabled?: boolean
}) {
  const baseBtn =
    'flex-1 text-sm font-semibold py-2 rounded-lg border transition-colors'
  const yesActive = value === true
  const noActive = value === false
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`${baseBtn} ${
            yesActive
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
          }`}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`${baseBtn} ${
            noActive
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-gray-700 border-gray-200 active:bg-gray-50'
          }`}
        >
          {noLabel}
        </button>
      </div>
    </div>
  )
}
