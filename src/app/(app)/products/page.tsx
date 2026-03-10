import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listProducts } from '@/lib/db/products'
import { formatZAR } from '@/lib/utils/currency'

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
  const products = await listProducts(search || undefined)

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        </div>
        <Link
          href="/products/new"
          className="bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-orange-600"
        >
          + Add
        </Link>
      </div>

      <form method="GET" className="mb-4">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search by name or barcode…"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </form>

      {products.length === 0 ? (
        <p className="text-center text-gray-400 text-sm mt-12">
          {search ? 'No products match that search.' : 'No products yet. Tap + Add to get started.'}
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
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{p.barcode}</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="font-bold text-gray-900">{formatZAR(p.price)}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      p.stock_qty <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    {p.stock_qty} in stock
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
