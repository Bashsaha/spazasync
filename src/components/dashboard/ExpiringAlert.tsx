import { getExpiringProductsForShop } from '@/lib/db/reports'

export async function ExpiringAlert({ shopId }: { shopId: string }) {
  try {
    const expiringProducts = await getExpiringProductsForShop(shopId)
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
              Products expiring
            </p>
            {expired.length > 0 && (
              <p className="text-xs text-red-600">
                {expired.length} product{expired.length !== 1 ? 's' : ''} already expired
              </p>
            )}
            {expiringSoon.length > 0 && (
              <p className="text-xs text-amber-700">
                {expiringSoon.length} product{expiringSoon.length !== 1 ? 's' : ''} expiring within 7 days
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {expiringProducts.slice(0, 4).map((item) => (
                <li key={item.name} className="text-xs text-gray-600">
                  &bull; {item.name}{' '}
                  <span className={item.expired_qty > 0 ? 'text-red-600 font-semibold' : 'text-amber-600'}>
                    {item.expired_qty > 0
                      ? `(${item.expired_qty} expired)`
                      : `(${item.expiring_soon_qty} expiring)`}
                  </span>
                </li>
              ))}
              {expiringProducts.length > 4 && (
                <li className="text-xs text-gray-400">+{expiringProducts.length - 4} more…</li>
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
