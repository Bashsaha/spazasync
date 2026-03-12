'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ProductWithStock } from '@/lib/db/stock'

type Tab = 'all' | 'low'

export default function StockPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [threshold, setThreshold] = useState(5)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/stock')
      .then((r) => r.json())
      .then((data: { products: ProductWithStock[]; threshold: number }) => {
        setProducts(data.products ?? [])
        setThreshold(data.threshold ?? 5)
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load stock. Please try again.')
        setLoading(false)
      })
  }, [])

  const filtered = products.filter((p) => {
    const matchesTab = tab === 'all' || p.low_stock
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search)
    return matchesTab && matchesSearch
  })

  const lowCount = products.filter((p) => p.low_stock).length
  const outCount = products.filter((p) => p.stock_qty === 0).length

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
      </div>

      {/* Summary strip */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 text-center shadow-sm">
            <p className="text-xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Products</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center shadow-sm ${
              lowCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${lowCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {lowCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Low stock</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center shadow-sm ${
              outCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${outCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {outCount}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Out of stock</p>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'low'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
            }`}
          >
            {t === 'all' ? 'All products' : `Low stock (${lowCount})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading stock…</p>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-center text-gray-400 text-sm mt-12">
          {tab === 'low' ? 'No low-stock items — great job!' : 'No products found.'}
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const isOut = p.stock_qty === 0
            const isLow = p.low_stock

            return (
              <li key={p.id}>
                <Link
                  href={`/stock/${p.id}`}
                  className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.barcode}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span
                      className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                        isOut
                          ? 'bg-red-100 text-red-700'
                          : isLow
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {p.stock_qty}
                    </span>
                    <span className="text-xs text-orange-500 font-semibold">Adjust →</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* Stock take prompt if many out of stock */}
      {!loading && !error && outCount >= 3 && (
        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-800">
          <p className="font-semibold mb-1">{outCount} products out of stock</p>
          <p className="text-orange-700 mb-3">
            Run a stock take to reconcile your full inventory count.
          </p>
          <Link
            href="/stock-take"
            className="inline-block bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-orange-600"
          >
            Run stock take
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        Low stock threshold: {threshold} units
      </p>
    </main>
  )
}
