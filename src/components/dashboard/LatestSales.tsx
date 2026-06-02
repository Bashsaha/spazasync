import { getRecentSalesForShop } from '@/lib/db/reports'
import { LatestSalesView } from '@/components/dashboard/LatestSalesView'
import type { SupportedLocale } from '@/lib/i18n/types'

/**
 * Server data-fetcher for the latest-sales list — still used (server-streamed)
 * by the /sales hub. The dashboard now reads the same data cache-first and
 * renders <LatestSalesView> directly. `locale` is accepted for call-site
 * compatibility; the view translates client-side.
 */
export async function LatestSales({
  shopId,
}: {
  shopId: string
  locale?: SupportedLocale
}) {
  try {
    const recentSales = await getRecentSalesForShop(shopId, 10)
    return <LatestSalesView sales={recentSales} />
  } catch {
    return null
  }
}
