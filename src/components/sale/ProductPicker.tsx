'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/types'
import { formatZAR } from '@/lib/utils/currency'
import { cacheProducts, getCachedProducts, isProductCacheStale } from '@/lib/offline/db'
import { useTranslation } from '@/components/LanguageProvider'

interface ProductPickerProps {
  onSelect: (product: Product) => void
  onClose: () => void
  /** Product IDs already in the cart — surfaced as a "In your cart" shortcut row. */
  recentIds?: string[]
}

function ProductRow({
  product,
  onSelect,
  onClose,
}: {
  product: Product
  onSelect: (p: Product) => void
  onClose: () => void
}) {
  return (
    <button
      onClick={() => {
        onSelect(product)
        onClose()
      }}
      className="w-full flex items-center justify-between px-4 py-3 rounded-full hover:bg-gray-50 active:bg-gray-100 text-left"
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{product.name}</p>
        {product.barcode && (
          <p className="text-xs text-gray-400 font-mono">{product.barcode}</p>
        )}
      </div>
      <p className="text-sm font-semibold text-gray-900">{formatZAR(product.price)}</p>
    </button>
  )
}

export function ProductPicker({ onSelect, onClose, recentIds = [] }: ProductPickerProps) {
  const { t } = useTranslation('sale')
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [usingStaleCache, setUsingStaleCache] = useState(false)
  const [popularIds, setPopularIds] = useState<string[]>([])

  // Paint the cached product list instantly on open (offline-first), before the
  // network fetch below resolves — the picker should never show a blank "loading"
  // screen when we already have products in IndexedDB. The network result (when
  // it lands) overwrites this; the guard stops a slow cache read from clobbering
  // a fast network response that arrived first.
  useEffect(() => {
    let cancelled = false
    getCachedProducts().then((cached) => {
      if (cancelled || cached.length === 0) return
      setProducts((prev) => (prev.length === 0 ? cached : prev))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // Fetch popular product IDs once on mount (best-effort — fails silently)
  useEffect(() => {
    fetch('/api/products/popular')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.popular) setPopularIds(data.popular) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    // No debounce on the initial / cleared-search load — fire immediately so the
    // list appears at once. Debounce only typed search keystrokes.
    const delay = search.trim() ? 200 : 0
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const url = search.trim()
          ? `/api/products?search=${encodeURIComponent(search.trim())}`
          : '/api/products'
        const res = await fetch(url, { signal: controller.signal })
        if (res.ok) {
          const json = await res.json()
          const fetched = json.products ?? json
          setProducts(fetched)
          // Cache full product list for offline use (unfiltered only)
          if (!search.trim()) {
            cacheProducts(fetched)
          }
        }
      } catch (err) {
        // On fetch failure (offline), fall back to cached products
        if (err instanceof DOMException && err.name === 'AbortError') return
        const cached = await getCachedProducts()
        if (cached.length > 0) {
          const q = search.trim().toLowerCase()
          setProducts(
            q
              ? cached.filter(
                  (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.barcode?.includes(search.trim()) ?? false),
                )
              : cached,
          )
          // Warn user if cached data may be outdated
          const stale = await isProductCacheStale()
          setUsingStaleCache(stale)
        }
      } finally {
        setLoading(false)
      }
    }, delay)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [search])

  // Split into in-cart shortcut + top sellers + rest when no search is active
  const noSearch = !search.trim()
  const recentSet = new Set(recentIds)
  const popularSet = new Set(popularIds)
  const inCart = noSearch && recentIds.length > 0
    ? recentIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p !== undefined)
    : []
  const topSellers = noSearch && popularIds.length > 0
    ? popularIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p !== undefined && !recentSet.has(p.id))
        .slice(0, 5)
    : []
  const restProducts = noSearch && (topSellers.length > 0 || inCart.length > 0)
    ? products.filter((p) => !popularSet.has(p.id) && !recentSet.has(p.id))
    : products

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="w-full px-4 pt-5 pb-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">{t('picker_title')}</h2>
          <button onClick={onClose} className="text-gray-400 text-sm font-medium active:text-gray-600">
            {t('close')}
          </button>
        </div>

        <div className="relative mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('picker_search_placeholder')}
            autoFocus
            // type=search + non-credential name + autofill opt-outs stop the
            // mobile keyboard's password/payment accessory bar from appearing
            // on a plain product search (BUG-042). The native ✕ cancel button is
            // hidden — we render our own clear button below.
            type="search"
            name="product-search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            className="w-full border border-gray-200 rounded-xl pl-4 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('picker_clear_search')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200"
            >
              ×
            </button>
          )}
        </div>

        {usingStaleCache && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3">
            {t('picker_offline_stale')}
          </p>
        )}

        <div className="overflow-y-auto flex-1 -mx-4 px-4">
          {/* Only show the full-area loading placeholder on the very first load
              (empty list). On subsequent keystrokes we keep the previous results
              visible so the list doesn't blink away while re-fetching (BUG-042). */}
          {loading && products.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('picker_loading')}</p>
          ) : products.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('picker_no_products')}</p>
          ) : noSearch && (inCart.length > 0 || topSellers.length > 0) ? (
            <>
              {inCart.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">
                    {t('picker_in_cart')}
                  </p>
                  <div className="space-y-1 mb-4">
                    {inCart.map((p) => (
                      <ProductRow key={p.id} product={p} onSelect={onSelect} onClose={onClose} />
                    ))}
                  </div>
                </>
              )}
              {topSellers.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">
                    {t('picker_top_sellers')}
                  </p>
                  <div className="space-y-1 mb-4">
                    {topSellers.map((p) => (
                      <ProductRow key={p.id} product={p} onSelect={onSelect} onClose={onClose} />
                    ))}
                  </div>
                </>
              )}
              {restProducts.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">
                    {t('picker_all_products')}
                  </p>
                  <div className="space-y-1">
                    {restProducts.map((p) => (
                      <ProductRow key={p.id} product={p} onSelect={onSelect} onClose={onClose} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-1">
              {products.map((p) => (
                <ProductRow key={p.id} product={p} onSelect={onSelect} onClose={onClose} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
