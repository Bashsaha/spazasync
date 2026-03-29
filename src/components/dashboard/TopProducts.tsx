import { getTopProductsThisWeek } from '@/lib/db/reports'

export async function TopProducts({ shopId }: { shopId: string }) {
  try {
    const topProducts = await getTopProductsThisWeek(shopId, 5)
    if (topProducts.length === 0) return null

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          What sold most this week
        </p>
        <ol className="space-y-2">
          {topProducts.map((p, i) => (
            <li key={p.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-4">{i + 1}.</span>
                <span className="text-sm text-gray-800">{p.name}</span>
              </div>
              <span className="text-xs text-gray-400">
                {p.totalQty} sold
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  } catch {
    return null
  }
}
