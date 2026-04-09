import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummary } from '@/components/dashboard/TodaySummary'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { ExpiringAlert } from '@/components/dashboard/ExpiringAlert'
import { WeeklyChartSection } from '@/components/dashboard/WeeklyChartSection'
import { TopProducts } from '@/components/dashboard/TopProducts'
import { LatestSales } from '@/components/dashboard/LatestSales'

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

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Staff login code:{' '}
          <span className="font-mono font-semibold text-blue-600">{shopCode}</span>
          <span className="text-xs text-gray-400 ml-1">(give this to your staff)</span>
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

      {/* Today's summary — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <TodaySummary shopId={shop.id} />
        </Suspense>
      )}

      {/* Low stock alert — streams in */}
      {shop?.id && (
        <Suspense fallback={null}>
          <LowStockAlert shopId={shop.id} threshold={shop.low_stock_threshold} />
        </Suspense>
      )}

      {/* Expiring products alert — streams in */}
      {shop?.id && (
        <Suspense fallback={null}>
          <ExpiringAlert shopId={shop.id} />
        </Suspense>
      )}

      {/* This week chart — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-48 rounded-2xl mb-4" />}>
          <WeeklyChartSection shopId={shop.id} />
        </Suspense>
      )}

      {/* What sold most this week — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-32 rounded-2xl mb-4" />}>
          <TopProducts shopId={shop.id} />
        </Suspense>
      )}

      {/* Latest sales (includes empty state) — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-40 rounded-2xl mb-4" />}>
          <LatestSales shopId={shop.id} />
        </Suspense>
      )}

      {/* Nav cards — instant */}
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
            <p className="text-gray-400 text-sm">Change your shop name, stock alerts and more</p>
          </div>
          <span className="text-3xl">⚙️</span>
        </a>

        <a
          href="/settings#compliance"
          className="flex items-center justify-between bg-indigo-50 rounded-2xl p-5 border border-indigo-100 shadow-sm active:bg-indigo-100"
        >
          <div>
            <p className="font-bold text-indigo-900">Inspector coming?</p>
            <p className="text-indigo-600 text-sm">Download your compliance report PDF — ready in seconds</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>
      </div>
    </main>
  )
}
