import { redirect } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getStockTakeHistory } from '@/lib/db/stock-take-history'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'
import { formatSAST } from '@/lib/utils/date'
import { BackButton } from '@/components/BackButton'
import { PageHeader, EmptyState } from '@/components/ui'

export default async function StockCountHistoryPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')

  // Owner / admin only — tellers do the count, owners review who did what.
  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') redirect('/sale')

  const locale = await getServerLocale()
  const { t, tPlural } = await getServerTranslations(locale, ['stock'])

  const sessions = await getStockTakeHistory(auth.shopId)

  return (
    <main className="px-4 pt-8 pb-24 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <BackButton fallbackHref="/stock-take" />
        <h1 className="text-2xl font-bold text-gray-900">{t('history_title')}</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6 ml-12">{t('history_subtitle')}</p>

      {sessions.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('history_empty')} />
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.key} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">
                  {s.counted_by ?? t('history_unknown_person')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatSAST(s.taken_at, 'd MMM yyyy, HH:mm')}
                  {' · '}
                  {tPlural('history_items_changed', s.changed_count, { count: s.changed_count })}
                </p>
              </div>
              <ul className="divide-y divide-gray-50">
                {s.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-gray-800 truncate pr-3">{it.product_name}</span>
                    <span className="text-sm font-medium shrink-0">
                      <span className="text-gray-400">{it.qty_before}</span>
                      <span className="text-gray-300 mx-1.5">→</span>
                      <span
                        className={
                          it.delta > 0
                            ? 'text-green-600'
                            : it.delta < 0
                            ? 'text-red-600'
                            : 'text-gray-800'
                        }
                      >
                        {it.qty_after}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
