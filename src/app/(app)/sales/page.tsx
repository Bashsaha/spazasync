import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, Calendar } from 'lucide-react'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { Skeleton } from '@/components/Skeleton'
import { TodaySummary } from '@/components/dashboard/TodaySummary'
import { WeeklyChartSection } from '@/components/dashboard/WeeklyChartSection'
import { TopProducts } from '@/components/dashboard/TopProducts'
import { LatestSales } from '@/components/dashboard/LatestSales'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function SalesHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')
  const { shopId, supabase } = auth

  const { data: shop } = await supabase
    .from('shops')
    .select('profit_tracking_enabled')
    .eq('id', shopId)
    .single()
  const profitTrackingEnabled = Boolean(shop?.profit_tracking_enabled)

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['sales'])

  return (
    <main className="px-4 pt-10 pb-44 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      {/* Big primary CTA — Start a Sale */}
      <Link
        href="/sale"
        className="flex items-center justify-between bg-brand text-white rounded-full p-5 mb-4 active:bg-brand-hover"
      >
        <div>
          <p className="font-bold text-lg">{t('hub_start_sale')}</p>
          <p className="text-brand-light text-sm">{t('hub_start_sale_desc')}</p>
        </div>
        <ShoppingCart className="w-7 h-7" strokeWidth={2} />
      </Link>

      {/* Today's totals — streams in */}
      <Suspense fallback={<Skeleton className="h-24 rounded-2xl mb-4" />}>
        <TodaySummary
          shopId={shopId}
          locale={locale}
          profitTrackingEnabled={profitTrackingEnabled}
        />
      </Suspense>

      {/* This week chart — streams in */}
      <Suspense fallback={<Skeleton className="h-48 rounded-2xl mb-4" />}>
        <WeeklyChartSection shopId={shopId} locale={locale} />
      </Suspense>

      {/* Top products this week — streams in */}
      <Suspense fallback={<Skeleton className="h-32 rounded-2xl mb-4" />}>
        <TopProducts shopId={shopId} locale={locale} />
      </Suspense>

      {/* Latest sales (also has its own "See all" link → /sales/history) */}
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl mb-4" />}>
        <LatestSales shopId={shopId} locale={locale} />
      </Suspense>

      {/* View by date — drill-down link */}
      <Link
        href="/sales/history"
        className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
      >
        <div>
          <p className="font-bold text-gray-900">{t('hub_view_history')}</p>
          <p className="text-gray-400 text-sm">{t('hub_view_history_desc')}</p>
        </div>
        <Calendar className="w-7 h-7 text-brand" strokeWidth={1.75} />
      </Link>
    </main>
  )
}
