import { getLowStockForShop } from '@/lib/db/reports'

export async function LowStockAlert({ shopId, threshold }: { shopId: string; threshold: number }) {
  try {
    const lowStock = await getLowStockForShop(shopId, threshold)
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
              Stock running low
            </p>
            {outOfStock.length > 0 && (
              <p className="text-xs text-red-600">
                {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''} out of stock
              </p>
            )}
            {lowOnly.length > 0 && (
              <p className="text-xs text-blue-700">
                {lowOnly.length} item{lowOnly.length !== 1 ? 's' : ''} almost out
              </p>
            )}
            <ul className="mt-2 space-y-0.5">
              {lowStock.slice(0, 4).map((item) => (
                <li key={item.name} className="text-xs text-gray-600">
                  &bull; {item.name}{' '}
                  <span className={item.stock_qty === 0 ? 'text-red-600 font-semibold' : 'text-blue-600'}>
                    {item.stock_qty === 0 ? '(out)' : `(${item.stock_qty} left)`}
                  </span>
                </li>
              ))}
              {lowStock.length > 4 && (
                <li className="text-xs text-gray-400">+{lowStock.length - 4} more…</li>
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
