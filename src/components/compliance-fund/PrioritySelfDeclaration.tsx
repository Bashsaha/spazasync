'use client'

/**
 * Phase 41b — Youth + women-owned priority self-declaration (UI-only).
 *
 * Per the SEFA / SAnews guideline, three groups get priority during fund
 * review: youth (18–35), women-owned shops, and persons with disabilities.
 * The disability flag is captured in owner_profiles (Phase 37e — explicit
 * single toggle since it's the only attribute we ask for at signup, per
 * Design Rule 6: no DOB/gender capture).
 *
 * This component lets the owner self-declare youth + women-owned on the
 * fund page so we can surface "remember to flag this on your SEDFA
 * application" reminders, WITHOUT persisting DOB or gender to the DB. The
 * toggles live in component state only — they reset on page reload. That
 * trade-off is deliberate: under-reporting priority is worse than not
 * capturing the data persistently, and the actual priority check happens
 * server-side at SEDFA review time.
 */

import { useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

export function PrioritySelfDeclaration() {
  const { t } = useTranslation('compliance-fund')
  const [isYouth, setIsYouth] = useState(false)
  const [isWomanOwned, setIsWomanOwned] = useState(false)
  const anyDeclared = isYouth || isWomanOwned

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">
        {t('priority_self_declaration_header')}
      </h2>
      <p className="text-xs text-gray-600 mb-3">
        {t('priority_self_declaration_body')}
      </p>

      <div className="space-y-2">
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
        <p className="mt-3 text-xs text-brand-hover bg-brand-light/50 border border-brand-light rounded-xl px-3 py-2">
          ✓ {t('priority_declared_hint')}
        </p>
      )}
    </section>
  )
}
