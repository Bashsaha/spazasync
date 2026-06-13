'use client'

/**
 * Phase 50 — Eligibility & priority (merged).
 *
 * Replaces the old EligibilitySection + the separate PrioritySelfDeclaration
 * card, which split "priority" across three places. Now one section holds:
 *   1. the two gating Yes/No questions (township/rural + owner-managed), and
 *   2. the priority groups (disability, persisted; youth + women-owned, UI-only
 *      reminders that aren't stored — see Design Rule 6 / Phase 41b).
 *
 * Renders as bare content — the page wraps it in a <Disclosure>, which supplies
 * the card chrome + collapsible header. Per BUG-017 this client component reads
 * its own translations via useTranslation.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { Button, Callout } from '@/components/ui'

interface Props {
  initialTownshipRural: boolean | null
  initialOwnerManaged: boolean | null
  initialHasDisability: boolean
}

type Field = 'fund_township_rural' | 'fund_owner_managed' | 'has_disability'

export function EligibilityAndPriority({
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
  const [isYouth, setIsYouth] = useState(false)
  const [isWomanOwned, setIsWomanOwned] = useState(false)
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
  const anyDeclared = isYouth || isWomanOwned

  return (
    <div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-brand" strokeWidth={2.25} />
            <p className="text-sm font-medium text-gray-900">
              {t('eligibility_sa_citizen_label')}
            </p>
          </div>
          <p className="text-xs text-gray-500 ml-6 mt-0.5">
            {t('eligibility_sa_citizen_hint')}
          </p>
        </div>

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

      {blocked && (
        <Callout tone="error" icon={AlertTriangle} className="mt-4">
          {t('eligibility_blocked_warning')}
        </Callout>
      )}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-900 mb-1">
          {t('priority_header')}
        </p>
        <p className="text-xs text-gray-500 mb-3">{t('priority_subtitle')}</p>

        <YesNoRow
          label={t('priority_disability_label')}
          hint={t('priority_disability_hint')}
          value={disability}
          onChange={(v) => update('has_disability', v)}
          yesLabel={t('answer_yes')}
          noLabel={t('answer_no')}
          disabled={pending}
        />

        <div className="space-y-2 mt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isYouth}
              onChange={(e) => setIsYouth(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <span className="text-sm text-gray-800">{t('priority_youth_label')}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isWomanOwned}
              onChange={(e) => setIsWomanOwned(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <span className="text-sm text-gray-800">{t('priority_woman_owned_label')}</span>
          </label>
        </div>

        {anyDeclared && (
          <Callout tone="brand" className="mt-3">
            ✓ {t('priority_declared_hint')}
          </Callout>
        )}
      </div>
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
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mb-2">{hint}</p>
      <div className="flex gap-2">
        <Button
          variant={value === true ? 'primary' : 'outline'}
          size="md"
          fullWidth
          disabled={disabled}
          onClick={() => onChange(true)}
        >
          {yesLabel}
        </Button>
        <Button
          variant={value === false ? 'destructive' : 'outline'}
          size="md"
          fullWidth
          disabled={disabled}
          onClick={() => onChange(false)}
        >
          {noLabel}
        </Button>
      </div>
    </div>
  )
}
