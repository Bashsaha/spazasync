import Link from 'next/link'
import { getOverviewStats } from '@/lib/db/admin'

const statCards = [
  { key: 'totalShops', label: 'Total Shops', color: 'bg-gray-50 border-gray-200 text-gray-900' },
  { key: 'activeShops', label: 'Active', color: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'trialingShops', label: 'Trialing', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'expiredShops', label: 'Expired', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'manualOverrideShops', label: 'Manual Override', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'recentSignUps', label: 'New This Week', color: 'bg-purple-50 border-purple-200 text-purple-700' },
] as const

export default async function AdminOverviewPage() {
  let stats = {
    totalShops: 0,
    activeShops: 0,
    trialingShops: 0,
    expiredShops: 0,
    manualOverrideShops: 0,
    recentSignUps: 0,
  }

  try {
    stats = await getOverviewStats()
  } catch (err) {
    console.error('Failed to load admin overview stats:', err)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={`border rounded-2xl p-4 ${card.color}`}
          >
            <p className="text-3xl font-bold">{stats[card.key]}</p>
            <p className="text-sm mt-1 opacity-75">{card.label}</p>
          </div>
        ))}
      </div>

      <Link
        href="/admin/shops"
        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        View All Shops
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  )
}
