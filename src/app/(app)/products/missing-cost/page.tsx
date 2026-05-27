import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listProducts } from '@/lib/db/products'
import { formatZAR } from '@/lib/utils/currency'
import { BackButton } from '@/components/BackButton'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function ProductsMissingCostPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const shopId = user.app_metadata?.shop_id as string

  const locale = await getServerLocale()
  const [products, { t }, shopRow] = await Promise.all([
    listProducts(undefined, { missingCost: true }),
    getServerTranslations(locale, ['products']),
    supabase
      .from('shops')
      .select('profit_tracking_enabled')
      .eq('id', shopId)
      .single(),
  ])

  const profitTracking = Boolean(shopRow.data?.profit_tracking_enabled)
  if (!profitTracking) redirect('/products')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BackButton fallbackHref="/products" />
        <h1 className="text-2xl font-bold text-gray-900">{t('missing_cost_page_title')}</h1>
      </div>

      {products.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-800">{t('missing_cost_all_done')}</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-amber-900">
              {t('missing_cost_filter_active', { count: products.length })}
            </p>
          </div>
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}?return=missing_cost`}
                  className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-400 font-mono">{p.barcode || t('no_barcode')}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        {t('missing_cost_pill')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="font-bold text-gray-900">{formatZAR(p.price)}</p>
                    <p
                      className={`text-xs mt-0.5 ${
                        p.stock_qty <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {p.stock_qty} {t('in_stock')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
