'use client'

import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'
import { Spinner } from '@/components/Spinner'

interface CartSummaryProps {
  total: number
  itemCount: number
  onCompleteSale: () => void
  isSubmitting: boolean
  aboveNav?: boolean
  hasOversellWarning?: boolean
}

/**
 * Sticky bottom bar showing the cart total and Complete Sale button.
 * When aboveNav is true, positions itself above the BottomNav bar.
 */
export function CartSummary({ total, itemCount, onCompleteSale, isSubmitting, aboveNav, hasOversellWarning }: CartSummaryProps) {
  const { t, tPlural } = useTranslation('sale')

  return (
    <div
      className="fixed inset-x-0 bg-white border-t border-gray-200 z-50"
      style={{ bottom: aboveNav ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '0px' }}
    >
      <div className="max-w-lg mx-auto flex items-center gap-4 px-4 py-3" style={{ paddingBottom: aboveNav ? '12px' : 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-400">
            {tPlural('item', itemCount, { count: itemCount })}
          </p>
          <p className="text-xl font-bold text-gray-900">{formatZAR(total)}</p>
        </div>

        <div className="flex-1">
          {hasOversellWarning && (
            <p className="text-xs text-amber-600 mb-1">{t('oversell_warning')}</p>
          )}
          <button
            onClick={onCompleteSale}
            disabled={isSubmitting || itemCount === 0}
            className="w-full bg-brand text-white font-semibold py-3 rounded-full active:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Spinner size="sm" />
                {t('btn_processing')}
              </span>
            ) : (
              t('btn_complete_sale')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
