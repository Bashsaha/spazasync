'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProductPage() {
  const router = useRouter()
  const [form, setForm] = useState({ barcode: '', name: '', price: '', stock_qty: '0' })
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const stockQty = parseInt(form.stock_qty, 10) || 0
  const hasExpiry = expiryDate !== '' && stockQty > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: form.barcode.trim() || null,
          name: form.name.trim(),
          price: parseFloat(form.price),
          stock_qty: hasExpiry ? 0 : stockQty,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }

      // If expiry date provided, create a batch (which adds the stock)
      if (hasExpiry) {
        const batchRes = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: data.id,
            expiry_date: expiryDate,
            quantity: stockQty,
          }),
        })
        if (!batchRes.ok) {
          setError('Product saved, but could not set the expiry date. You can add it from the Stock page.')
        }
      }

      router.push('/products')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Barcode <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={form.barcode}
            onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
            placeholder="e.g. 6001234567890"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Simba Chips 120g"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price (ZAR)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="e.g. 9.99"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opening stock</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.stock_qty}
            onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {stockQty > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">When does this stock expire?</p>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? 'Saving…' : 'Add Product'}
        </button>
      </form>
    </main>
  )
}
