'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Product } from '@/types'

export default function StockTakePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => setProducts((data.products ?? data) as Product[]))
      .catch(() => setError('Could not load products. Please refresh.'))
      .finally(() => setIsLoading(false))
  }, [])

  const countedItems = Object.values(counts).filter((v) => v !== '').length

  function handleCount(productId: string, value: string) {
    setCounts((prev) => ({ ...prev, [productId]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const entries = products
      .filter((p) => counts[p.id] !== undefined && counts[p.id] !== '')
      .map((p) => ({
        product_id: p.id,
        qty_after: parseInt(counts[p.id], 10),
      }))
      .filter((e) => !isNaN(e.qty_after) && e.qty_after >= 0)

    if (entries.length === 0) {
      setError('Enter at least one count before saving.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/stock-take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save. Try again.')
        return
      }
      setSavedCount(entries.length)
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (savedCount !== null) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Count Saved</h1>
        <p className="text-gray-500 text-sm mb-10">
          {savedCount} product{savedCount !== 1 ? 's' : ''} updated.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full max-w-xs bg-blue-600 text-white font-semibold py-4 rounded-2xl active:bg-blue-700"
        >
          Back to Dashboard
        </button>
        <button
          onClick={() => {
            setCounts({})
            setSavedCount(null)
          }}
          className="mt-4 text-sm text-gray-400 active:text-gray-600"
        >
          Do another stock take
        </button>
      </main>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <>
      <main className="px-4 pt-8 pb-32 max-w-lg mx-auto">
        {/* header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/dashboard" className="text-gray-400 text-sm active:text-gray-600">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Count Stock</h1>
        </div>
        <p className="text-gray-500 text-sm mb-6 ml-11">
          Write in how many of each product you actually have. Leave blank to skip.
        </p>

        {/* error banner */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* content */}
        {isLoading ? (
          <p className="text-gray-400 text-sm text-center mt-16">Loading products…</p>
        ) : products.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-gray-400 text-sm">No products yet.</p>
            <Link href="/products/new" className="text-blue-600 text-sm mt-2 inline-block">
              Add your first product →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} id="stock-take-form">
            {/* table header */}
            <div className="flex items-center px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span className="flex-1">Product</span>
              <span className="w-14 text-right mr-3">Current</span>
              <span className="w-16 text-center">Count</span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {products.map((p, idx) => {
                const inputVal = counts[p.id] ?? ''
                const parsed = parseInt(inputVal, 10)
                const isChanged =
                  inputVal !== '' && !isNaN(parsed) && parsed !== p.stock_qty

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-4 py-3 ${
                      idx !== products.length - 1 ? 'border-b border-gray-100' : ''
                    } ${isChanged ? 'bg-blue-50' : ''}`}
                  >
                    {/* product info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.barcode}</p>
                    </div>

                    {/* current qty */}
                    <span
                      className={`w-14 text-right text-sm mr-1 shrink-0 ${
                        p.stock_qty <= 5 ? 'text-red-500 font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {p.stock_qty}
                    </span>

                    {/* count input */}
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      placeholder="—"
                      value={inputVal}
                      onChange={(e) => handleCount(p.id, e.target.value)}
                      aria-label={`Count for ${p.name}`}
                      className={`w-16 text-center border rounded-xl py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isChanged
                          ? 'border-blue-500 text-blue-800 bg-white'
                          : 'border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                )
              })}
            </div>
          </form>
        )}
      </main>

      {/* sticky submit bar */}
      {!isLoading && products.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-lg mx-auto px-4 py-3">
            <button
              type="submit"
              form="stock-take-form"
              disabled={isSubmitting || countedItems === 0}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Saving…'
                : countedItems === 0
                  ? 'Enter counts to save'
                  : `Save ${countedItems} count${countedItems !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
