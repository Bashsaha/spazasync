import { getWeeklySalesForShop } from '@/lib/db/reports'
import { WeeklySalesChart } from '@/components/dashboard/WeeklySalesChart'

export async function WeeklyChartSection({ shopId }: { shopId: string }) {
  try {
    const weeklyData = await getWeeklySalesForShop(shopId)

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          This week
        </p>
        <WeeklySalesChart data={weeklyData} />
      </div>
    )
  } catch {
    return null
  }
}
