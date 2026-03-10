'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types'

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [productId, setProductId] = useState<string>('')
  const [product, setProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', stock_qty: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    params.then(({ id }) => {
      setProductId(id)
      fetch(`/api/products/${id}`)
        .then((r) => r.json())
        .then((data: Product) => {
          setProduct(data)
          setForm({ name: data.name, price: String(data.price), stock_qty: String(data.stock_qty) })
        })
        .catch(() => setLoadError('Could not load product.'))
    })
  }, [params])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          price: parseFloat(form.price),
          stock_qty: parseInt(form.stock_qty, 10),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.push('/products')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this product? This cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Could not delete product.')
        return
      }
      router.push('/products')
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loadError) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="text-red-500">{loadError}</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    )
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
      </div>

      <p className="text-xs text-gray-400 font-mono mb-6">Barcode: {product.barcode}</p>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
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
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock quantity</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.stock_qty}
            onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white font-bold py-4 rounded-2xl active:bg-orange-600 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full text-red-500 font-semibold py-3 text-sm active:text-red-700 disabled:opacity-50"
        >
          Delete Product
        </button>
      </div>
    </main>
  )
}
