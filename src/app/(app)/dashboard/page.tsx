import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummary } from '@/components/dashboard/TodaySummary'
import { LowStockAlert } from '@/components/dashboard/LowStockAlert'
import { ExpiringAlert } from '@/components/dashboard/ExpiringAlert'
import { LatestSales } from '@/components/dashboard/LatestSales'
import { ComplianceCard } from '@/components/dashboard/ComplianceCard'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: shopUser } = await supabase
    .from('shop_users')
    .select('role, shops(id, name, code, low_stock_threshold, subscription_status, trial_ends_at, subscription_ends_at, profit_tracking_enabled)')
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
    profit_tracking_enabled: boolean
  } | null

  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  const locale = await getServerLocale()
  const { t, tPlural } = await getServerTranslations(locale, ['dashboard'])

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {t('staff_login_code')}{' '}
          <span className="font-mono font-semibold text-blue-600">{shopCode}</span>
          <span className="text-xs text-gray-400 ml-1">{t('staff_login_hint')}</span>
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
        const labelKey = shop?.subscription_status === 'trialing' ? 'sub_free_trial' : 'sub_subscription'
        const label = t(labelKey)
        return (
          <a
            href="/subscribe"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4"
          >
            <p className="text-sm font-semibold text-amber-800">
              {daysLeft === 0
                ? t('sub_ended', { label })
                : tPlural('sub_ending', daysLeft, { label, count: daysLeft })}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {t('sub_tap_subscribe')}
            </p>
          </a>
        )
      })()}

      {/* Unified compliance card — score + alerts OR all-clear with PDF link. Always present. */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <ComplianceCard shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Today's summary — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
          <TodaySummary
            shopId={shop.id}
            locale={locale}
            profitTrackingEnabled={Boolean(shop.profit_tracking_enabled)}
          />
        </Suspense>
      )}

      {/* Low stock alert — streams in, returns null when nothing's low */}
      {shop?.id && (
        <Suspense fallback={null}>
          <LowStockAlert shopId={shop.id} threshold={shop.low_stock_threshold} locale={locale} />
        </Suspense>
      )}

      {/* Expiring products alert — streams in, returns null when nothing's expiring */}
      {shop?.id && (
        <Suspense fallback={null}>
          <ExpiringAlert shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Latest sales (with "See all →" link to /sales/history) */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-40 rounded-2xl mb-4" />}>
          <LatestSales shopId={shop.id} locale={locale} />
        </Suspense>
      )}
    </main>
  )
}
