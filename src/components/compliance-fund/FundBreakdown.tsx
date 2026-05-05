/**
 * Phase 37e — "What you could receive" breakdown.
 *
 * Tier 1 (no CIPC) caps at R100k; Tier 2 (CIPC registered) unlocks
 * blended finance up to R300k. Server component — pure presentation.
 */

type T = (key: string, params?: Record<string, string | number>) => string

interface Props {
  cipcRegistered: boolean
  t: T
}

export function FundBreakdown({ cipcRegistered, t }: Props) {
  return (
    <section className="bg-white border border-gray-100 rounded-2xl p-5 mb-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        {t('breakdown_header')}
      </h2>

      <div className="mb-4">
        <p className="text-sm font-bold text-gray-900 mb-2">
          {t('tier1_title')}
        </p>
        <ul className="text-xs text-gray-700 space-y-2">
          <li>
            <p className="font-semibold">{t('tier1_stock_title')}</p>
            <p className="text-gray-500">{t('tier1_stock_desc')}</p>
          </li>
          <li>
            <p className="font-semibold">{t('tier1_infra_title')}</p>
            <p className="text-gray-500">{t('tier1_infra_desc')}</p>
          </li>
          <li>
            <p className="font-semibold">{t('tier1_training_title')}</p>
            <p className="text-gray-500">{t('tier1_training_desc')}</p>
          </li>
        </ul>
        {!cipcRegistered && (
          <p className="text-xs text-amber-700 mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            💡 {t('tier1_cipc_unlock_hint')}
          </p>
        )}
      </div>

      {cipcRegistered && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-sm font-bold text-emerald-800 mb-2">
            {t('tier2_title')}
          </p>
          <p className="text-xs text-gray-700 mb-2">{t('tier2_intro')}</p>
          <ul className="text-xs text-gray-700 space-y-2">
            <li>
              <p className="font-semibold">{t('tier2_blended_title')}</p>
              <p className="text-gray-500">{t('tier2_blended_desc')}</p>
            </li>
            <li>
              <p className="font-semibold">{t('tier2_training_title')}</p>
              <p className="text-gray-500">{t('tier2_training_desc')}</p>
            </li>
          </ul>
        </div>
      )}
    </section>
  )
}
