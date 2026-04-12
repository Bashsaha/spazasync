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
  searchParams: Promise<{ search?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { search = '' } = await searchParams
  const locale = await getServerLocale()
  const [products, { t }] = await Promise.all([
    listProducts(search || undefined),
    getServerTranslations(locale, ['products']),
  ])

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
            {t('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CatalogImportSheet />
          <Link
            href="/products/new"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700"
          >
            {t('btn_add')}
          </Link>
        </div>
      </div>

      <form method="GET" className="mb-4">
        <input
          name="search"
          defaultValue={search}
          placeholder={t('search_placeholder')}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {products.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          {search ? t('empty_search') : t('empty_no_search')}
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link
                href={`/products/${p.id}`}
                className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{p.barcode || t('no_barcode')}</p>
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
      )}
    </main>
  )
}
