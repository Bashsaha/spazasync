/**
 * IndexedDB wrapper for offline support.
 * Uses the `idb` library for a promise-based API.
 *
 * Database: spazasync (v2)
 * Stores:
 *   pending_sales — keyed by offline_id (UUID generated locally)
 *   products      — cached product list for offline browsing/barcode lookup
 *   cart          — current cart state for crash recovery
 *
 * NOTE: DB_NAME is intentionally kept as 'spazasync' during the Phase 34b rebrand.
 * Renaming it would create a new empty database on every existing device — all
 * pending offline sales and cached products would be lost.
 */
import { openDB } from 'idb'
import type { PendingSale, Product, CartItem, Teller } from '@/types'
import type { SupportedLocale } from '@/lib/i18n/types'

const DB_NAME = 'spazasync'
const DB_VERSION = 3
const STORE = 'pending_sales'

/** Product cache is considered stale after 30 minutes. */
const PRODUCT_CACHE_TTL_MS = 30 * 60 * 1000

interface CachedSettings {
  key: 'shop'
  low_stock_threshold: number
  language?: SupportedLocale
  cached_at: string
}

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1: pending_sales
      if (oldVersion < 1) {
        db.createObjectStore(STORE, { keyPath: 'offline_id' })
      }
      // v2: product cache + cart persistence
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' })
          productStore.createIndex('by_barcode', 'barcode')
        }
        if (!db.objectStoreNames.contains('cart')) {
          db.createObjectStore('cart', { keyPath: 'key' })
        }
      }
      // v3: settings cache + teller cache
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains('tellers')) {
          db.createObjectStore('tellers', { keyPath: 'id' })
        }
      }
    },
  })
}

// ── Pending sales ─────────────────────────────────────────────────────────────

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

/** Update retry count and last error on a pending sale. */
export async function updateSaleRetry(offlineId: string, retryCount: number, lastError: string): Promise<void> {
  const db = await getDB()
  const sale = await db.get(STORE, offlineId)
  if (sale) {
    sale.retry_count = retryCount
    sale.last_error = lastError
    await db.put(STORE, sale)
  }
}

/** Count sales that have exceeded max retries. */
export async function countFailedSales(maxRetries: number): Promise<number> {
  const db = await getDB()
  const all = await db.getAll(STORE)
  return all.filter((s) => s.retry_count >= maxRetries).length
}

/** Reset retry count on failed sales so they can be retried. */
export async function resetFailedSales(maxRetries: number): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const all = await store.getAll()
  for (const sale of all) {
    if (sale.retry_count >= maxRetries) {
      sale.retry_count = 0
      sale.last_error = undefined
      await store.put(sale)
    }
  }
  await tx.done
}

// ── Product cache ─────────────────────────────────────────────────────────────

/** Replace the entire product cache with a fresh list and record timestamp. */
export async function cacheProducts(products: Product[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['products', 'settings'], 'readwrite')
  const store = tx.objectStore('products')
  await store.clear()
  for (const p of products) {
    await store.put(p)
  }
  // Record when products were cached so we can check staleness
  tx.objectStore('settings').put({ key: 'products_meta', cached_at: new Date().toISOString() })
  await tx.done
}

/** Return all cached products. */
export async function getCachedProducts(): Promise<Product[]> {
  const db = await getDB()
  return db.getAll('products')
}

/** Look up a single product by barcode from cache.
 * Tries both UPC-A (12 digits) and EAN-13 (13-digit leading-zero) forms. */
export async function getCachedProductByBarcode(barcode: string): Promise<Product | undefined> {
  const db = await getDB()
  const { barcodeCandidates } = await import('@/lib/utils/barcode')
  for (const candidate of barcodeCandidates(barcode)) {
    const hit = await db.getFromIndex('products', 'by_barcode', candidate)
    if (hit) return hit
  }
  return undefined
}

// ── Cart persistence ──────────────────────────────────────────────────────────

/** Save current cart items for crash recovery. */
export async function saveCart(items: CartItem[]): Promise<void> {
  const db = await getDB()
  await db.put('cart', { key: 'current', items, updated_at: new Date().toISOString() })
}

/** Load saved cart items. Returns null if no saved cart. */
export async function loadCart(): Promise<CartItem[] | null> {
  const db = await getDB()
  const record = await db.get('cart', 'current')
  return record?.items ?? null
}

/** Clear the saved cart. */
export async function clearCartCache(): Promise<void> {
  const db = await getDB()
  await db.delete('cart', 'current')
}

// ── Settings cache ───────────────────────────────────────────────────────────

/** Cache shop settings for offline use. */
export async function cacheSettings(settings: CachedSettings): Promise<void> {
  const db = await getDB()
  await db.put('settings', settings)
}

/** Load cached shop settings. Returns null if no cache. */
export async function getCachedSettings(): Promise<CachedSettings | null> {
  const db = await getDB()
  const record = await db.get('settings', 'shop')
  return record ?? null
}

// ── Teller cache ─────────────────────────────────────────────────────────────

/** Replace the entire teller cache with a fresh list. */
export async function cacheTellers(tellers: Teller[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('tellers', 'readwrite')
  const store = tx.objectStore('tellers')
  await store.clear()
  for (const t of tellers) {
    await store.put(t)
  }
  await tx.done
}

/** Return all cached tellers. */
export async function getCachedTellers(): Promise<Teller[]> {
  const db = await getDB()
  return db.getAll('tellers')
}

// ── Sign-out purge ─────────────────────────────────────────────────────────

/**
 * Clear every store that holds SHOP-SCOPED data on sign-out / user-switch, so a
 * shared device (owner + teller on one phone — the spaza norm) never paints the
 * previous user's cached products/settings/tellers/cart for the next user
 * (SECURITY-001). DELIBERATELY does NOT touch `pending_sales`: that store holds
 * unsynced offline sales — clearing it would lose recorded sales and (worse)
 * could let them sync under the next user's session. The sync layer drains it
 * normally; an unsynced queue surviving a switch is a separate, accepted edge.
 */
export async function clearShopDataCaches(): Promise<void> {
  const db = await getDB()
  const stores = ['products', 'cart', 'settings', 'tellers'] as const
  const tx = db.transaction(stores, 'readwrite')
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()))
  await tx.done
}

// ── Product cache staleness ──────────────────────────────────────────────────

/** Check if the product cache is older than PRODUCT_CACHE_TTL_MS. */
export async function isProductCacheStale(): Promise<boolean> {
  const db = await getDB()
  const meta = await db.get('settings', 'products_meta')
  if (!meta?.cached_at) return true
  return Date.now() - new Date(meta.cached_at).getTime() > PRODUCT_CACHE_TTL_MS
}

// ── Language cache ──────────────────────────────────────────────────────────

/** Get cached language preference. Returns undefined if not cached. */
export async function getCachedLanguage(): Promise<SupportedLocale | undefined> {
  const settings = await getCachedSettings()
  return settings?.language
}

/** Update just the language in the settings cache. */
export async function cacheLanguage(locale: SupportedLocale): Promise<void> {
  const db = await getDB()
  const existing = await db.get('settings', 'shop')
  if (existing) {
    existing.language = locale
    existing.cached_at = new Date().toISOString()
    await db.put('settings', existing)
  } else {
    await db.put('settings', {
      key: 'shop',
      low_stock_threshold: 5,
      language: locale,
      cached_at: new Date().toISOString(),
    })
  }
}
