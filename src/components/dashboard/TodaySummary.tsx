import { getDailySalesForShop } from '@/lib/db/reports'
import { formatZAR } from '@/lib/utils/currency'

export async function TodaySummary({ shopId }: { shopId: string }) {
  try {
    const summary = await getDailySalesForShop(shopId)

    return (
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-3">
          Today
        </p>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{formatZAR(summary.totalRevenue)}</p>
            <p className="text-xs text-gray-400 mt-0.5">made</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">{summary.salesCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {summary.salesCount === 1 ? 'sale' : 'sales'}
            </p>
          </div>
          {summary.tellerCount > 0 && (
            <div className="flex-1">
              <p className="text-2xl font-bold text-gray-900">{summary.tellerCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.tellerCount === 1 ? 'teller' : 'tellers'}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  } catch {
    return null
  }
}
