/**
 * Sync engine — attempts to POST every pending offline sale to the server.
 * Called automatically when the device comes back online.
 *
 * Deduplication: the server ignores a sale whose offline_id already exists
 * (returns 409). Either way we remove the local copy so it doesn't retry.
 */
import { listPendingSales, removePendingSale } from './db'

export interface SyncResult {
  synced: number
  failed: number
}

export async function syncPendingSales(): Promise<SyncResult> {
  const pending = await listPendingSales()
  let synced = 0
  let failed = 0

  for (const sale of pending) {
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
        failed++
      }
    } catch {
      // Network still down or server error — leave in queue, try again later
      failed++
    }
  }

  return { synced, failed }
}
