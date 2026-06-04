import { clearShopDataCaches } from '@/lib/offline/db'

/**
 * SECURITY-001 — purge every client-side cache that holds shop/user-scoped data
 * on sign-out or a detected user switch. Spaza shops routinely share one phone
 * between the owner and a teller, so a cache keyed only by endpoint (not by
 * user) would let the next person briefly see the previous user's data before
 * the background revalidate replaces it. RLS still prevents fetching NEW
 * cross-shop data — this closes the "data already on the device" gap.
 *
 * Deliberately KEPT (not data, or intentionally cross-session):
 *   - mvs_locale / spazasync_lang  → language preference
 *   - mvs_recent_users_v1          → the Switch-User feature's recent logins
 *   - mvs_checklist_intro_seen     → UX flag (the server `everCompleted` fact gates it)
 * Deliberately NOT touched: the IndexedDB `pending_sales` queue (unsynced sales).
 */

const EXACT_LOCAL_KEYS = [
  'mvs_shell_identity', // chrome identity mirror (name/role/shop)
  'spaza_shop_settings', // settings page cache-first snapshot
  'spaza_teller_me', // teller's own record
  'spaza_last_owner_teller', // owner's last-picked active teller
  'last_summary_seen', // daily-summary seen marker (per shop)
]
const LOCAL_PREFIXES = ['mvs_cache:'] // every useCachedData snapshot
const EXACT_SESSION_KEYS = ['spaza_active_teller']

export async function clearSessionCaches(): Promise<void> {
  // 1) localStorage — exact data keys + all cache-first snapshots.
  try {
    const ls = window.localStorage
    EXACT_LOCAL_KEYS.forEach((k) => ls.removeItem(k))
    const prefixed: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i)
      if (key && LOCAL_PREFIXES.some((p) => key.startsWith(p))) prefixed.push(key)
    }
    prefixed.forEach((k) => ls.removeItem(k))
  } catch {
    /* private mode / quota — best effort */
  }

  // 2) sessionStorage — active-teller selection.
  try {
    EXACT_SESSION_KEYS.forEach((k) => window.sessionStorage.removeItem(k))
  } catch {
    /* ignore */
  }

  // 3) IndexedDB — products / cart / settings / tellers (NOT pending_sales).
  try {
    await clearShopDataCaches()
  } catch {
    /* ignore */
  }

  // 4) Service-worker Cache Storage — drop cached /api/* responses across every
  //    cache version. Data-free shell docs + content-hashed static chunks stay,
  //    so the next login still opens instantly; only user data is evicted.
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys()
      await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name)
          const reqs = await cache.keys()
          await Promise.all(
            reqs
              .filter((req) => {
                try {
                  return new URL(req.url).pathname.startsWith('/api/')
                } catch {
                  return false
                }
              })
              .map((req) => cache.delete(req)),
          )
        }),
      )
    }
  } catch {
    /* ignore */
  }
}
