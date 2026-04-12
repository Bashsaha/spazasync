import { getTopProductsThisWeek } from '@/lib/db/reports'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function TopProducts({ shopId, locale }: { shopId: string; locale: SupportedLocale }) {
  try {
    const [topProducts, { t }] = await Promise.all([
      getTopProductsThisWeek(shopId, 5),
      getServerTranslations(locale, ['dashboard']),
    ])
    if (topProducts.length === 0) return null

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {t('top_products_title')}
        </p>
        <ol className="space-y-2">
          {topProducts.map((p, i) => (
            <li key={p.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-4">{i + 1}.</span>
                <span className="text-sm text-gray-800">{p.name}</span>
              </div>
              <span className="text-xs text-gray-400">
                {p.totalQty} {t('top_products_sold')}
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  } catch {
    return null
  }
}
