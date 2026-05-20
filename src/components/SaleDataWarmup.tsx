'use client'

import { useEffect } from 'react'
import { cacheProducts } from '@/lib/offline/db'

/**
 * Warms the product list into the SW cache + IndexedDB shortly after the app
 * shell mounts, so the FIRST time the cashier opens the product picker (or
 * scans while offline) the data is already there — no network wait. The picker
 * itself still fetches on open, but by then the SW serves the cached response
 * instantly and the IndexedDB cache is the offline fallback.
 *
 * Best-effort and deferred: it runs ~1.2s after mount so it never competes with
 * the critical first paint, and it re-warms when the device comes back online.
 * Mounted in the (app) layout only for users tied to a shop (owners / tellers /
 * dual-role admins) — see the shopId gate at the call site.
 */
export function SaleDataWarmup() {
  useEffect(() => {
    let cancelled = false

    function warm() {
      // /api/products is in the SW's SWR_GET_PATHS, so this populates the SW
      // cache; we also mirror into IndexedDB for the picker's offline fallback.
      fetch('/api/products')
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (cancelled || !json) return
          const products = json.products ?? json
          if (Array.isArray(products) && products.length > 0) {
            cacheProducts(products)
          }
        })
        .catch(() => {})
      // Warm the top-sellers list too so the picker's "Top sellers" section is
      // ready on first open (best-effort).
      fetch('/api/products/popular').catch(() => {})
    }

    const timer = setTimeout(warm, 1200)
    window.addEventListener('online', warm)
    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('online', warm)
    }
  }, [])

  return null
}
