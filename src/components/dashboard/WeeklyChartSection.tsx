import { getWeeklySalesForShop } from '@/lib/db/reports'
import { WeeklySalesChart } from '@/components/dashboard/WeeklySalesChart'
import { getServerTranslations } from '@/lib/i18n/server'
import type { SupportedLocale } from '@/lib/i18n/types'

export async function WeeklyChartSection({ shopId, locale }: { shopId: string; locale: SupportedLocale }) {
  try {
    const [weeklyData, { t }] = await Promise.all([
      getWeeklySalesForShop(shopId),
      getServerTranslations(locale, ['dashboard']),
    ])

    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {t('weekly_title')}
        </p>
        <WeeklySalesChart data={weeklyData} />
      </div>
    )
  } catch {
    return null
  }
}
