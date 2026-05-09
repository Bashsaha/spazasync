'use client'

/**
 * Phase 37e — Application Pack download button.
 *
 * Disabled until all NON-CIPC required docs are ok (CIPC alone caps the tier
 * but doesn't block the application). Hits the existing Phase 37d endpoint
 * /api/reports/fund-application-pack which already gates server-side on
 * SA citizen + fund_interest.
 */

import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'

interface Props {
  /** Number of NON-conditional required docs that are not ok. */
  missingDocCount: number
}

export function GenerateApplicationPackButton({ missingDocCount }: Props) {
  const { t } = useTranslation('compliance-fund')
  const disabled = missingDocCount > 0

  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 ">
      <p className="text-sm font-semibold text-gray-900 mb-1">
        {t('pack_header')}
      </p>
      <p className="text-xs text-gray-500 mb-3">{t('pack_desc')}</p>

      {disabled ? (
        <>
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl text-sm font-semibold text-gray-400 bg-gray-100 cursor-not-allowed"
          >
            {t('pack_button')}
          </button>
          <p className="text-xs text-amber-700 mt-2">
            ⚠️ {t('pack_missing_hint', { count: missingDocCount })}
          </p>
          <Link
            href="/compliance/journey"
            className="inline-block text-xs text-brand font-semibold mt-2 active:text-brand-hover"
          >
            {t('pack_open_journey')} →
          </Link>
        </>
      ) : (
        <a
          href="/api/reports/fund-application-pack"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center w-full py-3 rounded-full text-sm font-semibold text-white bg-brand active:bg-brand-hover"
        >
          {t('pack_button')}
        </a>
      )}
    </section>
  )
}
