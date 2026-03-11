/**
 * IndexedDB wrapper for offline sale queuing.
 * Uses the `idb` library for a promise-based API.
 *
 * Database: spazasync (v1)
 * Store:    pending_sales — keyed by offline_id (UUID generated locally)
 */
import { openDB } from 'idb'
import type { PendingSale } from '@/types'

const DB_NAME = 'spazasync'
const DB_VERSION = 1
const STORE = 'pending_sales'

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'offline_id' })
      }
    },
  })
}

/** Add (or replace) a pending sale in the queue. */
export async function enqueueSale(sale: PendingSale): Promise<void> {
  const db = await getDB()
  await db.put(STORE, sale)
}

/** Return all pending sales ordered by queued_at ascending. */
export async function listPendingSales(): Promise<PendingSale[]> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.sort((a, b) =>
    new Date(a.queued_at).getTime() - new Date(b.queued_at).getTime(),
  )
}

/** Remove a sale from the queue once it has been successfully synced. */
export async function removePendingSale(offlineId: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, offlineId)
}

/** Number of sales currently waiting to sync. */
export async function countPendingSales(): Promise<number> {
  const db = await getDB()
  return db.count(STORE)
}
