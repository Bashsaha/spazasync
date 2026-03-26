/**
 * Sync engine — attempts to POST every pending offline sale to the server.
 * Called automatically when the device comes back online.
 *
 * Deduplication: the server rejects a sale whose offline_id already exists
 * (returns 409). Either way we remove the local copy so it doesn't retry.
 *
 * Retry strategy: exponential backoff (1s → 2s → 4s → 8s → 16s cap).
 * After MAX_RETRIES, the sale is marked as "failed" and left for manual retry.
 */
import { listPendingSales, removePendingSale, updateSaleRetry } from './db'

export const MAX_RETRIES = 5
const BASE_DELAY_MS = 1000

export interface SyncResult {
  synced: number
  failed: number
  errors: Array<{ offline_id: string; error: string }>
}

export async function syncPendingSales(): Promise<SyncResult> {
  const pending = await listPendingSales()
  let synced = 0
  let failed = 0
  const errors: Array<{ offline_id: string; error: string }> = []

  for (const sale of pending) {
    // Skip sales that have exceeded max retries
    if (sale.retry_count >= MAX_RETRIES) {
      failed++
      errors.push({ offline_id: sale.offline_id, error: sale.last_error ?? 'Max retries exceeded' })
      continue
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teller_id: sale.teller_id,
          items: sale.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          offline_id: sale.offline_id,
        }),
      })

      // 201 = synced, 409 = already exists (duplicate offline_id)
      // Remove the local copy in both cases.
      if (res.ok || res.status === 409) {
        await removePendingSale(sale.offline_id)
        synced++
      } else {
        const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        const errorMsg = errorBody.error ?? `HTTP ${res.status}`
        await updateSaleRetry(sale.offline_id, sale.retry_count + 1, errorMsg)
        failed++
        errors.push({ offline_id: sale.offline_id, error: errorMsg })

        // Exponential backoff before next attempt
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, sale.retry_count), 16000)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch {
      // Network still down or server unreachable
      await updateSaleRetry(sale.offline_id, sale.retry_count + 1, 'Network error')
      failed++
      errors.push({ offline_id: sale.offline_id, error: 'Network error' })
    }
  }

  return { synced, failed, errors }
}
