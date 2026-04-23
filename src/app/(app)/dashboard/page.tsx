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
import { ChecklistStatus } from '@/components/dashboard/ChecklistStatus'
import { ComplianceScoreCard } from '@/components/dashboard/ComplianceScoreCard'
import { DocumentComplianceStatus } from '@/components/dashboard/DocumentComplianceStatus'
import { PestControlReminder } from '@/components/dashboard/PestControlReminder'
import { WasteConfirmReminder } from '@/components/dashboard/WasteConfirmReminder'
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
  const { t, tPlural } = await getServerTranslations(locale, ['dashboard', 'checklist'])

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
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

      {/* Compliance score card — streams in, headline summary */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-20 rounded-2xl mb-4" />}>
          <ComplianceScoreCard shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Daily checklist status — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-14 rounded-2xl mb-4" />}>
          <ChecklistStatus shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Business documents compliance status — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-14 rounded-2xl mb-4" />}>
          <DocumentComplianceStatus locale={locale} />
        </Suspense>
      )}

      {/* Pest control overdue reminder — streams in, returns null when fresh */}
      {shop?.id && (
        <Suspense fallback={null}>
          <PestControlReminder shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Waste arrangement confirmation reminder — streams in, returns null when fresh */}
      {shop?.id && (
        <Suspense fallback={null}>
          <WasteConfirmReminder shopId={shop.id} locale={locale} />
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

      {/* Low stock alert — streams in */}
      {shop?.id && (
        <Suspense fallback={null}>
          <LowStockAlert shopId={shop.id} threshold={shop.low_stock_threshold} locale={locale} />
        </Suspense>
      )}

      {/* Expiring products alert — streams in */}
      {shop?.id && (
        <Suspense fallback={null}>
          <ExpiringAlert shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* This week chart — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-48 rounded-2xl mb-4" />}>
          <WeeklyChartSection shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* What sold most this week — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-32 rounded-2xl mb-4" />}>
          <TopProducts shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Latest sales (includes empty state) — streams in */}
      {shop?.id && (
        <Suspense fallback={<Skeleton className="h-40 rounded-2xl mb-4" />}>
          <LatestSales shopId={shop.id} locale={locale} />
        </Suspense>
      )}

      {/* Nav cards — instant */}
      <div className="space-y-3">
        <a
          href="/sale"
          className="flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 shadow-sm active:bg-blue-700"
        >
          <div>
            <p className="font-bold text-lg">{t('card_start_sale')}</p>
            <p className="text-blue-100 text-sm">{t('card_start_sale_desc')}</p>
          </div>
          <span className="text-3xl">🛒</span>
        </a>

        <a
          href="/stock"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_check_stock')}</p>
            <p className="text-gray-400 text-sm">{t('card_check_stock_desc')}</p>
          </div>
          <span className="text-3xl">📦</span>
        </a>

        <a
          href="/stock-take"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_count_stock')}</p>
            <p className="text-gray-400 text-sm">{t('card_count_stock_desc')}</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>

        <a
          href="/checklist"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('dashboard_card_title')}</p>
            <p className="text-gray-400 text-sm">{t('dashboard_card_desc')}</p>
          </div>
          <span className="text-3xl">✅</span>
        </a>

        <a
          href="/products"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_products')}</p>
            <p className="text-gray-400 text-sm">{t('card_products_desc')}</p>
          </div>
          <span className="text-3xl">🏷️</span>
        </a>

        <a
          href="/tellers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_staff')}</p>
            <p className="text-gray-400 text-sm">{t('card_staff_desc')}</p>
          </div>
          <span className="text-3xl">👤</span>
        </a>

        <a
          href="/settings"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_settings')}</p>
            <p className="text-gray-400 text-sm">{t('card_settings_desc')}</p>
          </div>
          <span className="text-3xl">⚙️</span>
        </a>

        <a
          href="/inspection"
          className="flex items-center justify-between bg-indigo-50 rounded-2xl p-5 border border-indigo-100 shadow-sm active:bg-indigo-100"
        >
          <div>
            <p className="font-bold text-indigo-900">{t('card_inspector')}</p>
            <p className="text-indigo-600 text-sm">{t('card_inspector_desc')}</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>
      </div>
    </main>
  )
}
