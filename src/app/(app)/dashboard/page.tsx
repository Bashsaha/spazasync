import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getDailySalesForShop,
  getLowStockForShop,
  getWeeklySalesForShop,
  getRecentSalesForShop,
  getTopProductsThisWeek,
} from '@/lib/db/reports'
import { formatZAR } from '@/lib/utils/currency'
import { formatSAST } from '@/lib/utils/date'
import { WeeklySalesChart } from '@/components/dashboard/WeeklySalesChart'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: shopUser } = await supabase
    .from('shop_users')
    .select('role, shops(id, name, code, low_stock_threshold, subscription_status, trial_ends_at, subscription_ends_at)')
    .eq('user_id', user.id)
    .single()

  const shop = shopUser?.shops as unknown as {
    id: string
    name: string
    code: string
    low_stock_threshold: number
    subscription_status: string
    trial_ends_at: string | null
    subscription_ends_at: string | null
  } | null

  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  // Fetch all dashboard data in parallel — all best-effort
  let summary = { salesCount: 0, totalRevenue: 0, topItems: [] as { name: string; totalQty: number }[], tellerCount: 0 }
  let lowStock: { name: string; stock_qty: number }[] = []
  let weeklyData = [] as Awaited<ReturnType<typeof getWeeklySalesForShop>>
  let recentSales = [] as Awaited<ReturnType<typeof getRecentSalesForShop>>
  let topProducts = [] as Awaited<ReturnType<typeof getTopProductsThisWeek>>

  if (shop?.id) {
    const results = await Promise.allSettled([
      getDailySalesForShop(shop.id),
      getLowStockForShop(shop.id, shop.low_stock_threshold),
      getWeeklySalesForShop(shop.id),
      getRecentSalesForShop(shop.id, 10),
      getTopProductsThisWeek(shop.id, 5),
    ])
    if (results[0].status === 'fulfilled') summary = results[0].value
    if (results[1].status === 'fulfilled') lowStock = results[1].value
    if (results[2].status === 'fulfilled') weeklyData = results[2].value
    if (results[3].status === 'fulfilled') recentSales = results[3].value
    if (results[4].status === 'fulfilled') topProducts = results[4].value
  }

  const outOfStock = lowStock.filter((p) => p.stock_qty === 0)
  const lowOnly = lowStock.filter((p) => p.stock_qty > 0)

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Shop code:{' '}
          <span className="font-mono font-semibold text-blue-600">{shopCode}</span>
        </p>
      </div>

      {/* Subscription warning banner */}
      {(() => {
        const endDate = shop?.subscription_status === 'trialing'
          ? shop?.trial_ends_at
          : shop?.subscription_status === 'cancelled'
            ? shop?.subscription_ends_at
            : null
        if (!endDate) return null
        const daysLeft = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
        if (daysLeft > 3) return null
        const label = shop?.subscription_status === 'trialing' ? 'free trial' : 'subscription'
        return (
          <a
            href="/subscribe"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
          >
            <p className="text-sm font-semibold text-amber-800">
              {daysLeft === 0
                ? `Your ${label} has ended.`
                : `Your ${label} ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Tap here to subscribe and keep using SpazaSync.
            </p>
          </a>
        )
      })()}

      {/* Today's summary */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-3">
          Today
        </p>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{formatZAR(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">made</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{summary.salesCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.salesCount === 1 ? 'sale' : 'sales'}
            </p>
          </div>
          {summary.tellerCount > 0 && (
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.tellerCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.tellerCount === 1 ? 'teller' : 'tellers'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <a
          href="/stock?tab=low"
          className="block bg-red-50 border border-red-100 rounded-2xl p-4 mb-4"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700 mb-1">
                ⚠️ Stock running low
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
                    • {item.name}{' '}
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
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </a>
      )}

      {/* This week chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          This week
        </p>
        <WeeklySalesChart data={weeklyData} />
      </div>

      {/* What sold most this week */}
      {topProducts.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            What sold most this week
          </p>
          <ol className="space-y-2">
            {topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300 w-4">{i + 1}.</span>
                  <span className="text-sm text-gray-800">{p.name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {p.totalQty} sold
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Latest sales */}
      {recentSales.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Latest sales
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
      )}

      {recentSales.length === 0 && summary.salesCount === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 text-center">
          <p className="text-sm text-gray-400">No sales yet — tap &ldquo;Start a Sale&rdquo; below to begin!</p>
        </div>
      )}

      {/* Nav cards */}
      <div className="space-y-3">
        <a
          href="/sale"
          className="flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 shadow-sm active:bg-blue-700"
        >
          <div>
            <p className="font-bold text-lg">Start a Sale</p>
            <p className="text-blue-100 text-sm">Scan products and record a sale</p>
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
            <p className="font-bold text-gray-900">Count Stock</p>
            <p className="text-gray-400 text-sm">Go through your products and update the numbers</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>

        <a
          href="/products"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Products</p>
            <p className="text-gray-400 text-sm">Add or change the products you sell</p>
          </div>
          <span className="text-3xl">🏷️</span>
        </a>

        <a
          href="/tellers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Staff</p>
            <p className="text-gray-400 text-sm">Manage the people who use the till</p>
          </div>
          <span className="text-3xl">👤</span>
        </a>

        <a
          href="/settings"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Settings</p>
            <p className="text-gray-400 text-sm">Change your shop name, WhatsApp number and more</p>
          </div>
          <span className="text-3xl">⚙️</span>
        </a>
      </div>
    </main>
  )
}
