'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/types'
import { formatZAR } from '@/lib/utils/currency'
import { cacheProducts, getCachedProducts } from '@/lib/offline/db'

interface ProductPickerProps {
  onSelect: (product: Product) => void
  onClose: () => void
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
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 text-left"
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

export function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [popularIds, setPopularIds] = useState<string[]>([])

  // Fetch popular product IDs once on mount (best-effort — fails silently)
  useEffect(() => {
    fetch('/api/products/popular')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.popular) setPopularIds(data.popular) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const controller = new AbortController()
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
        }
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [search])

  // Split into top sellers + rest when no search is active
  const noSearch = !search.trim()
  const popularSet = new Set(popularIds)
  const topSellers = noSearch && popularIds.length > 0
    ? popularIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p !== undefined)
        .slice(0, 5)
    : []
  const restProducts = noSearch && topSellers.length > 0
    ? products.filter((p) => !popularSet.has(p.id))
    : products

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="bg-white w-full rounded-t-2xl px-4 pt-5 pb-8 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Add Product</h2>
          <button onClick={onClose} className="text-gray-400 text-sm font-medium active:text-gray-600">
            Close
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
        />

        <div className="overflow-y-auto flex-1 -mx-4 px-4">
          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No products found.</p>
          ) : noSearch && topSellers.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">
                Top sellers
              </p>
              <div className="space-y-1 mb-4">
                {topSellers.map((p) => (
                  <ProductRow key={p.id} product={p} onSelect={onSelect} onClose={onClose} />
                ))}
              </div>
              {restProducts.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pb-1">
                    All products
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
