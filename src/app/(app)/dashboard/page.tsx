import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Dashboard — Phase 2 placeholder.
 * Full implementation in Phase 10.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get shop info
  const { data: shopUser } = await supabase
    .from('shop_users')
    .select('role, shops(name, code)')
    .eq('user_id', user.id)
    .single()

  const shop = shopUser?.shops as unknown as { name: string; code: string } | null
  const shopName = shop?.name ?? 'Your Shop'
  const shopCode = shop?.code ?? ''

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-sm text-gray-400 mt-0.5">Shop code: <span className="font-mono font-semibold text-orange-500">{shopCode}</span></p>
      </div>

      <div className="space-y-3">
        <a
          href="/sale"
          className="flex items-center justify-between bg-orange-500 text-white rounded-2xl p-5 shadow-sm active:bg-orange-600"
        >
          <div>
            <p className="font-bold text-lg">Start a Sale</p>
            <p className="text-orange-100 text-sm">Scan products and record a sale</p>
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
            <p className="font-bold text-gray-900">Stock Take</p>
            <p className="text-gray-400 text-sm">Count and update your stock</p>
          </div>
          <span className="text-3xl">📋</span>
        </a>

        <a
          href="/products"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Products</p>
            <p className="text-gray-400 text-sm">Manage your product list</p>
          </div>
          <span className="text-3xl">🏷️</span>
        </a>

        <a
          href="/tellers"
          className="flex items-center justify-between bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:bg-gray-50"
        >
          <div>
            <p className="font-bold text-gray-900">Tellers</p>
            <p className="text-gray-400 text-sm">Manage staff who use the till</p>
          </div>
          <span className="text-3xl">👤</span>
        </a>
      </div>
    </main>
  )
}
