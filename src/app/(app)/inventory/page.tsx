import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Tag, ClipboardList, Clock, Truck } from 'lucide-react'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getExpiryStats } from '@/lib/db/batches'
import { getTellerAccessStatus } from '@/lib/db/access-requests'
import { TellerAccessRequestPanel } from '@/components/access/TellerAccessRequestPanel'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function InventoryHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')
  const { shopId, supabase } = auth
  const role = auth.user.app_metadata?.role as string | undefined

  const locale = await getServerLocale()
  const { t, tPlural } = await getServerTranslations(locale, ['inventory'])

  // Tellers without an active grant see the request-access panel instead
  // of the tile grid. Granted tellers fall through to the normal hub.
  if (role === 'teller') {
    const status = await getTellerAccessStatus(supabase, auth.user.id)
    if (!status.has_access) {
      return <TellerAccessRequestPanel initialStatus={status} />
    }
  }

  // Fetch shop threshold + counts in parallel.
  const [{ data: shop }, { count: totalProducts }, expiryStats] = await Promise.all([
    supabase.from('shops').select('low_stock_threshold').eq('id', shopId).single(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('shop_id', shopId),
    getExpiryStats(shopId),
  ])

  const threshold = (shop?.low_stock_threshold as number | undefined) ?? 5
  const { count: lowCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .lte('stock_qty', threshold)

  const total = totalProducts ?? 0
  const low = lowCount ?? 0
  const expiring = expiryStats.expiringProducts + expiryStats.expiredProducts

  return (
    <main className="px-4 pt-10 pb-44 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center ">
          <p className="text-xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-tight">
            {tPlural('summary_total', total)}
          </p>
        </div>
        <div
          className={`rounded-2xl p-3 text-center border ${
            low > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
          }`}
        >
          <p className={`text-xl font-bold ${low > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
            {low}
          </p>
          <p className={`text-xs mt-0.5 leading-tight ${low > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
            {t('summary_low')}
          </p>
        </div>
        <div
          className={`rounded-2xl p-3 text-center border ${
            expiring > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
          }`}
        >
          <p className={`text-xl font-bold ${expiring > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {expiring}
          </p>
          <p className={`text-xs mt-0.5 leading-tight ${expiring > 0 ? 'text-red-700' : 'text-gray-500'}`}>
            {t('summary_expiring')}
          </p>
        </div>
      </div>

      {/* Tile grid */}
      <div className="space-y-3">
        <Link
          href="/stock"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_stock')}</p>
            <p className="text-gray-400 text-sm">{t('card_stock_desc')}</p>
          </div>
          <Package className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>

        <Link
          href="/products"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_products')}</p>
            <p className="text-gray-400 text-sm">{t('card_products_desc')}</p>
          </div>
          <Tag className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>

        <Link
          href="/stock-take"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_count')}</p>
            <p className="text-gray-400 text-sm">{t('card_count_desc')}</p>
          </div>
          <ClipboardList className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>

        <Link
          href="/expiry"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_expiry')}</p>
            <p className="text-gray-400 text-sm">{t('card_expiry_desc')}</p>
          </div>
          <Clock className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>

        <Link
          href="/suppliers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">{t('card_suppliers')}</p>
            <p className="text-gray-400 text-sm">{t('card_suppliers_desc')}</p>
          </div>
          <Truck className="w-7 h-7 text-brand" strokeWidth={1.75} />
        </Link>
      </div>
    </main>
  )
}
