import { getExpiringProductsForShop } from '@/lib/db/reports'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function ExpiringAlert({ shopId, locale }: { shopId: string; locale: SupportedLocale }) {
  try {
    const [expiringProducts, { t }] = await Promise.all([
      getExpiringProductsForShop(shopId),
      getServerTranslations(locale, ['dashboard']),
    ])
    if (expiringProducts.length === 0) return null

    const expired = expiringProducts.filter((p) => p.expired_qty > 0)
    const expiringSoon = expiringProducts.filter((p) => p.expiring_soon_qty > 0 && p.expired_qty === 0)

    return (
      <a
        href="/expiry"
        className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">
              {t('expiring_title')}
            </p>
            {expired.length > 0 && (
              <p className="text-xs text-red-600">
                {t('expiring_expired', { count: expired.length })}
              </p>
            )}
            {expiringSoon.length > 0 && (
              <p className="text-xs text-amber-700">
                {t('expiring_soon', { count: expiringSoon.length })}
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {expiringProducts.slice(0, 4).map((item) => (
                <li key={item.name} className="text-xs text-gray-600">
                  &bull; {item.name}{' '}
                  <span className={item.expired_qty > 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                    {item.expired_qty > 0
                      ? `(${t('expiring_expired', { count: item.expired_qty })})`
                      : `(${t('expiring_soon', { count: item.expiring_soon_qty })})`}
                  </span>
                </li>
              ))}
              {expiringProducts.length > 4 && (
                <li className="text-xs text-gray-400">+{expiringProducts.length - 4}…</li>
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
