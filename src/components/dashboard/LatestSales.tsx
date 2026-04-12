import { getRecentSalesForShop } from '@/lib/db/reports'
import { formatZAR } from '@/lib/utils/currency'
import { formatSAST } from '@/lib/utils/date'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function LatestSales({ shopId, locale }: { shopId: string; locale: SupportedLocale }) {
  try {
    const [recentSales, { t }] = await Promise.all([
      getRecentSalesForShop(shopId, 10),
      getServerTranslations(locale, ['dashboard']),
    ])

    if (recentSales.length === 0) {
      return (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 text-center">
          <p className="text-sm text-gray-400">{t('latest_sales_none')}</p>
        </div>
      )
    }

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {t('latest_sales_title')}
        </p>
        <ul className="divide-y divide-gray-50">
          {recentSales.map((sale) => (
            <li key={sale.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm text-gray-800 font-medium">{formatZAR(sale.total)}</p>
                <p className="text-xs text-gray-400">
                  {sale.teller_name ?? '—'} · {formatSAST(sale.completed_at, 'HH:mm')}
                </p>
              </div>
              <span className="text-xs text-gray-300">
                {formatSAST(sale.completed_at, 'd MMM')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  } catch {
    return null
  }
}
