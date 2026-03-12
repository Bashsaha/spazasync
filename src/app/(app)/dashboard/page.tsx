import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDailySalesForShop, getLowStockForShop } from '@/lib/db/reports'
import { formatZAR } from '@/lib/utils/currency'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get shop info
  const { data: shopUser } = await supabase
    .from('shop_users')
    .select('role, shops(id, name, code, low_stock_threshold)')
    .eq('user_id', user.id)
    .single()

  const shop = shopUser?.shops as unknown as {
    id: string
    name: string
    code: string
    low_stock_threshold: number
  } | null

  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  // Fetch today's summary + low stock in parallel
  let summary = { salesCount: 0, totalRevenue: 0, topItems: [] as { name: string; totalQty: number }[], tellerCount: 0 }
  let lowStock: { name: string; stock_qty: number }[] = []

  if (shop?.id) {
    try {
      ;[summary, lowStock] = await Promise.all([
        getDailySalesForShop(shop.id),
        getLowStockForShop(shop.id, shop.low_stock_threshold),
      ])
    } catch {
      // Summary is best-effort — don't crash the dashboard
    }
  }

  const outOfStock = lowStock.filter((p) => p.stock_qty === 0)
  const lowOnly = lowStock.filter((p) => p.stock_qty > 0)

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Shop code:{' '}
          <span className="font-mono font-semibold text-orange-500">{shopCode}</span>
        </p>
      </div>

      {/* Today's summary strip */}
      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3">
          Today
        </p>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{formatZAR(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Revenue</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{summary.salesCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.salesCount === 1 ? 'Sale' : 'Sales'}
            </p>
          </div>
          {summary.tellerCount > 0 && (
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.tellerCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.tellerCount === 1 ? 'Teller' : 'Tellers'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <a
          href="/stock?tab=low"
          className="block bg-red-50 border border-red-100 rounded-2xl p-4 mb-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">
                ⚠️ Stock Alert
              </p>
              {outOfStock.length > 0 && (
                <p className="text-xs text-red-600">
                  {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''} out of stock
                </p>
              )}
              {lowOnly.length > 0 && (
                <p className="text-xs text-orange-600">
                  {lowOnly.length} item{lowOnly.length !== 1 ? 's' : ''} running low
                </p>
              )}
              <ul className="mt-2 space-y-0.5">
                {lowStock.slice(0, 4).map((item) => (
                  <li key={item.name} className="text-xs text-gray-600">
                    • {item.name}{' '}
                    <span className={item.stock_qty === 0 ? 'text-red-600 font-semibold' : 'text-orange-500'}>
                      {item.stock_qty === 0 ? '(out)' : `(${item.stock_qty} left)`}
                    </span>
                  </li>
                ))}
                {lowStock.length > 4 && (
                  <li className="text-xs text-gray-400">+{lowStock.length - 4} more…</li>
                )}
              </ul>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </a>
      )}

      {/* Nav cards */}
      <div className="space-y-3">
        <a
          href="/sale"
          className="flex items-center justify-between bg-orange-500 text-white rounded-2xl p-5 shadow-sm active:bg-orange-600"
        >
          <div>
            <p className="font-bold text-lg">Start a Sale</p>
            <p className="text-orange-100 text-sm">Scan products and record a sale</p>
          </div>
          <span className="text-3xl">🛒</span>
        </a>

        <a
          href="/stock"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Check Stock</p>
            <p className="text-gray-400 text-sm">See what you have left</p>
          </div>
          <span className="text-3xl">📦</span>
        </a>

        <a
          href="/stock-take"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Stock Take</p>
            <p className="text-gray-400 text-sm">Count and update your stock</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>

        <a
          href="/products"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Products</p>
            <p className="text-gray-400 text-sm">Manage your product list</p>
          </div>
          <span className="text-3xl">🏷️</span>
        </a>

        <a
          href="/tellers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Tellers</p>
            <p className="text-gray-400 text-sm">Manage staff who use the till</p>
          </div>
          <span className="text-3xl">👤</span>
        </a>
      </div>
    </main>
  )
}
