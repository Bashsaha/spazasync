import { getDailySalesForShop } from '@/lib/db/reports'
import { TodaySummaryView } from '@/components/dashboard/TodaySummaryView'
import type { SupportedLocale } from '@/lib/i18n/types'

/**
 * Server-streamed "Today" card — used by the /sales hub (which is a server
 * component). The dashboard renders the same card cache-first via
 * [DashboardSummaryCards]; both share the presentational [TodaySummaryView].
 * `locale` is kept in the signature for call-site compatibility (the view reads
 * the client i18n context directly).
 */
export async function TodaySummary({
  shopId,
  profitTrackingEnabled = false,
}: {
  shopId: string
  locale?: SupportedLocale
  profitTrackingEnabled?: boolean
}) {
  try {
    const summary = await getDailySalesForShop(shopId)
    return <TodaySummaryView summary={summary} profitTrackingEnabled={profitTrackingEnabled} />
  } catch {
    return null
  }
}
