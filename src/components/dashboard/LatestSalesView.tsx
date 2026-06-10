'use client'

import Link from 'next/link'
import { formatZAR } from '@/lib/utils/currency'
import { formatSAST } from '@/lib/utils/date'
import { useTranslation } from '@/components/LanguageProvider'
import type { RecentSale } from '@/types'

/**
 * Presentational "latest sales" list — shared by the server LatestSales (used on
 * the /sales hub) and the client cache-first dashboard (Phase 44 App Shell).
 */
export function LatestSalesView({ sales }: { sales: RecentSale[] }) {
  const { t } = useTranslation('dashboard')

  if (sales.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 text-center">
        <p className="text-sm text-gray-400">{t('latest_sales_none')}</p>
      </div>
    )
  }

  return (
    <div data-tour="latest-sales" className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {t('latest_sales_title')}
        </p>
        <Link href="/sales/history" className="text-xs font-semibold text-brand active:text-brand-hover">
          {t('latest_sales_see_all')}
        </Link>
      </div>
      <ul className="divide-y divide-gray-50">
        {sales.map((sale) => (
          <li key={sale.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm text-gray-800 font-medium">{formatZAR(sale.total)}</p>
              <p className="text-xs text-gray-400">
                <span className={sale.teller_name ? '' : 'italic'}>
                  {/* `sale_no_teller` lives in the `sales` namespace; the
                      provider's flat merge resolves it (all namespaces loaded). */}
                  {sale.teller_name ?? t('sale_no_teller')}
                </span>
                {' · '}
                {formatSAST(sale.completed_at, 'HH:mm')}
              </p>
            </div>
            <span className="text-xs text-gray-300">{formatSAST(sale.completed_at, 'd MMM')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
