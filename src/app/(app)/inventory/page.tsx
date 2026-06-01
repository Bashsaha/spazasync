import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, Tag, ClipboardList, Clock, Truck } from 'lucide-react'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getTellerAccessStatus } from '@/lib/db/access-requests'
import { TellerAccessRequestPanel } from '@/components/access/TellerAccessRequestPanel'
import { InventorySummaryStrip } from '@/components/inventory/InventorySummaryStrip'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function InventoryHubPage() {
  const auth = await getShopAuth()
  if (!auth) redirect('/login')
  const { supabase } = auth
  const role = auth.user.app_metadata?.role as string | undefined

  const locale = await getServerLocale()
  const { t } = await getServerTranslations(locale, ['inventory'])

  // Tellers without an active grant see the request-access panel instead
  // of the tile grid. Granted tellers fall through to the normal hub.
  if (role === 'teller') {
    const status = await getTellerAccessStatus(supabase, auth.user.id)
    if (!status.has_access) {
      return <TellerAccessRequestPanel initialStatus={status} />
    }
  }

  return (
    <main className="px-4 pt-10 pb-44 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('hint')}</p>
      </div>

      {/* Summary strip — cache-first (Phase 44b) */}
      <InventorySummaryStrip />

      {/* Tile grid. Granted tellers get a single tile — count stock. Owners /
          admins get the full hub. */}
      {role === 'teller' ? (
        <div className="space-y-3">
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
        </div>
      ) : (
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
      )}
    </main>
  )
}
