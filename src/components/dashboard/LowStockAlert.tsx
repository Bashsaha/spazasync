import { getLowStockForShop } from '@/lib/db/reports'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function LowStockAlert({ shopId, threshold, locale }: { shopId: string; threshold: number; locale: SupportedLocale }) {
  try {
    const [lowStock, { t, tPlural }] = await Promise.all([
      getLowStockForShop(shopId, threshold),
      getServerTranslations(locale, ['dashboard']),
    ])
    if (lowStock.length === 0) return null

    const outOfStock = lowStock.filter((p) => p.stock_qty === 0)
    const lowOnly = lowStock.filter((p) => p.stock_qty > 0)

    return (
      <a
        href="/stock?tab=low"
        className="block bg-red-50 border border-red-100 rounded-2xl p-4 mb-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-red-700 mb-1">
              {t('low_stock_title')}
            </p>
            {outOfStock.length > 0 && (
              <p className="text-xs text-red-600">
                {tPlural('low_stock_out', outOfStock.length, { count: outOfStock.length })}
              </p>
            )}
            {lowOnly.length > 0 && (
              <p className="text-xs text-blue-700">
                {tPlural('low_stock_low', lowOnly.length, { count: lowOnly.length })}
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {lowStock.slice(0, 4).map((item) => (
                <li key={item.name} className="text-xs text-gray-600">
                  &bull; {item.name}{' '}
                  <span className={item.stock_qty === 0 ? 'text-red-600 font-semibold' : 'text-blue-600'}>
                    {item.stock_qty === 0
                      ? `(${t('low_stock_badge_out')})`
                      : `(${t('low_stock_badge_left', { count: item.stock_qty })})`}
                  </span>
                </li>
              ))}
              {lowStock.length > 4 && (
                <li className="text-xs text-gray-400">{t('low_stock_more', { count: lowStock.length - 4 })}</li>
              )}
            </ul>
          </div>
          <span className="text-gray-300 text-lg">&rsaquo;</span>
        </div>
      </a>
    )
  } catch {
    return null
  }
}
