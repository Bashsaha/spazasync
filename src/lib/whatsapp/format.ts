import type { DailySummaryData, LowStockItem, ExpiringProductAlert } from '@/types'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { format as formatDate } from 'date-fns'
import { SAST_TZ } from '@/lib/utils/date'

function formatRand(amount: number): string {
  return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
}

/**
 * Build the daily WhatsApp summary message for a single shop.
 * Pure function — no DB or network calls.
 */
export function formatDailySummary(
  shopName: string,
  data: DailySummaryData,
  lowStock: LowStockItem[],
  expiringProducts: ExpiringProductAlert[] = [],
  date: Date = new Date(),
): string {
  const dateStr = formatInTimeZone(date, SAST_TZ, 'EEEE, d MMM yyyy')

  const lines: string[] = []

  lines.push(`SpazaSync Daily Report — ${shopName}`)
  lines.push(dateStr)
  lines.push('')

  if (data.salesCount === 0) {
    lines.push('No sales recorded today.')
  } else {
    lines.push(`Revenue today: ${formatRand(data.totalRevenue)}`)
    lines.push(`Sales: ${data.salesCount} transaction${data.salesCount !== 1 ? 's' : ''}`)
    lines.push(`Tellers active: ${data.tellerCount}`)

    if (data.topItems.length > 0) {
      lines.push('')
      lines.push('Top items sold:')
      data.topItems.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item.name} — ${item.totalQty} unit${item.totalQty !== 1 ? 's' : ''}`)
      })
    }
  }

  if (lowStock.length > 0) {
    lines.push('')
    lines.push(`⚠️ Low stock (${lowStock.length} item${lowStock.length !== 1 ? 's' : ''}):`)
    for (const item of lowStock) {
      if (item.stock_qty === 0) {
        lines.push(`  • ${item.name} — OUT OF STOCK`)
      } else {
        lines.push(`  • ${item.name} — ${item.stock_qty} left`)
      }
    }
  }

  if (expiringProducts.length > 0) {
    lines.push('')
    lines.push(`⏰ Expiry alert (${expiringProducts.length} item${expiringProducts.length !== 1 ? 's' : ''}):`)
    for (const item of expiringProducts) {
      const parts: string[] = []
      if (item.expired_qty > 0) {
        parts.push(`${item.expired_qty} expired`)
      }
      if (item.expiring_soon_qty > 0) {
        // Format earliest_expiry as "d MMM" (e.g. "25 Mar")
        const expiryDate = new Date(item.earliest_expiry + 'T00:00:00+02:00')
        const zonedDate = toZonedTime(expiryDate, SAST_TZ)
        const dateLabel = formatDate(zonedDate, 'd MMM')
        parts.push(`${item.expiring_soon_qty} expiring (earliest: ${dateLabel})`)
      }
      lines.push(`  • ${item.name} — ${parts.join(', ')}`)
    }
  }

  lines.push('')
  lines.push('Powered by SpazaSync')

  return lines.join('\n')
}
