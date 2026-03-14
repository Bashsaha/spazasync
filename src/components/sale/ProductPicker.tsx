'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/types'
import { formatZAR } from '@/lib/utils/currency'

interface ProductPickerProps {
  onSelect: (product: Product) => void
  onClose: () => void
}

export function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const url = search.trim()
          ? `/api/products?search=${encodeURIComponent(search.trim())}`
          : '/api/products'
        const res = await fetch(url, { signal: controller.signal })
        if (res.ok) setProducts(await res.json())
      } catch {
        // ignore abort errors
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [search])

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
          ) : (
            <div className="space-y-1">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelect(p)
                    onClose()
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    {p.barcode && (
                      <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatZAR(p.price)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
