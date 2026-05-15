import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listProducts } from '@/lib/db/products'
import { formatZAR } from '@/lib/utils/currency'
import { CatalogImportSheet } from '@/components/products/CatalogImportSheet'
import { getServerLocale, getServerTranslations } from '@/lib/i18n/server'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; missing_cost?: string; missing_supplier?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { search = '', missing_cost, missing_supplier } = await searchParams
  const missingCostOnly = missing_cost === '1'
  const missingSupplierOnly = missing_supplier === '1'

  const shopId = user.app_metadata?.shop_id as string

  const locale = await getServerLocale()
  const [products, { t }, shopRow] = await Promise.all([
    listProducts(search || undefined, {
      missingCost: missingCostOnly,
      missingSupplier: missingSupplierOnly,
    }),
    getServerTranslations(locale, ['products']),
    supabase
      .from('shops')
      .select('profit_tracking_enabled, id')
      .eq('id', shopId)
      .single(),
  ])

  const profitTracking = Boolean(shopRow.data?.profit_tracking_enabled)

  // Banner counts run independently of the current filter so they stay
  // accurate when the user toggles between filtered + unfiltered views.
  const [missingCostRes, missingSupplierRes, suppliersRes] = await Promise.all([
    profitTracking
      ? supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('shop_id', shopId)
          .is('cost_price', null)
      : Promise.resolve({ count: 0 } as { count: number | null }),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .is('supplier_id', null),
    supabase
      .from('suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId),
  ])
  const missingCostCount = missingCostRes.count ?? 0
  const missingSupplierCount = missingSupplierRes.count ?? 0
  const suppliersCount = suppliersRes.count ?? 0

  return (
    <main className="px-4 pt-10 pb-36 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-gray-400 active:text-gray-600 text-sm">
            {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CatalogImportSheet />
          <Link
            href="/products/new"
            className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-full active:bg-brand-hover"
          >
            {t('btn_add')}
          </Link>
        </div>
      </div>

      {/* Missing-cost card — clickable, filters list */}
      {profitTracking && missingCostCount > 0 && !missingCostOnly && (
        <Link
          href="/products?missing_cost=1"
          className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 active:bg-amber-100"
        >
          <div className="min-w-0 pr-3">
            <p className="text-sm font-semibold text-amber-900">
              {t('missing_cost_banner', { count: missingCostCount })}
            </p>
            <p className="text-xs text-amber-700 font-semibold mt-1">
              {t('missing_cost_filter_btn')}
            </p>
          </div>
          <span className="text-amber-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      )}

      {profitTracking && missingCostCount > 0 && missingCostOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-amber-900">
            {t('missing_cost_filter_active', { count: missingCostCount })}
          </p>
          <Link
            href="/products"
            className="text-xs font-semibold text-amber-700 underline active:text-amber-900 mt-2 inline-block"
          >
            {t('missing_cost_show_all')}
          </Link>
        </div>
      )}

      {profitTracking && missingCostCount === 0 && missingCostOnly && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-800">{t('missing_cost_all_done')}</p>
          <Link
            href="/products"
            className="text-xs font-semibold text-green-700 underline active:text-green-900 mt-2 inline-block"
          >
            {t('missing_cost_show_all')}
          </Link>
        </div>
      )}

      {/* Missing-supplier tip (soft gray — supplier gaps are operational, not a data integrity issue) */}
      {suppliersCount === 0 ? (
        <Link
          href="/suppliers/new"
          className="block bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <p className="text-sm font-semibold text-gray-800">{t('add_first_supplier_tip')}</p>
          <p className="text-xs text-gray-600 mt-1">{t('add_first_supplier_btn')}</p>
        </Link>
      ) : missingSupplierCount > 0 ? (
        <Link
          href="/suppliers/assign"
          className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 active:bg-gray-100"
        >
          <div className="min-w-0 pr-3">
            <p className="text-sm font-semibold text-gray-800">
              {missingSupplierOnly
                ? t('missing_supplier_filter_active', { count: missingSupplierCount })
                : t('missing_supplier_banner', { count: missingSupplierCount })}
            </p>
            <p className="text-xs text-brand font-semibold mt-1">
              {t('missing_supplier_assign_btn')}
            </p>
          </div>
          <span className="text-gray-400 text-xl shrink-0">&rsaquo;</span>
        </Link>
      ) : missingSupplierOnly ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-800">{t('missing_supplier_all_done')}</p>
          <Link
            href="/products"
            className="text-xs font-semibold text-green-700 underline active:text-green-900 mt-2 inline-block"
          >
            {t('missing_supplier_show_all')}
          </Link>
        </div>
      ) : null}

      <form method="GET" className="mb-4">
        <input
          name="search"
          defaultValue={search}
          placeholder={t('search_placeholder')}
          className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {missingCostOnly && <input type="hidden" name="missing_cost" value="1" />}
        {missingSupplierOnly && <input type="hidden" name="missing_supplier" value="1" />}
      </form>

      {products.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          {missingCostOnly
            ? t('missing_cost_all_done')
            : missingSupplierOnly
              ? t('missing_supplier_all_done')
              : search
                ? t('empty_search')
                : t('empty_no_search')}
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => {
            const missingCost = profitTracking && p.cost_price == null
            const returnTo = missingCostOnly
              ? '?return=missing_cost'
              : missingSupplierOnly
                ? '?return=missing_supplier'
                : ''
            return (
              <li key={p.id}>
                <Link
                  href={`/products/${p.id}${returnTo}`}
                  className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-400 font-mono">{p.barcode || t('no_barcode')}</p>
                      {missingCost && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {t('missing_cost_pill')}
                        </span>
                      )}
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
            )
          })}
        </ul>
      )}
    </main>
  )
}
