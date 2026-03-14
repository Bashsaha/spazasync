'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Product } from '@/types'
import { formatZAR } from '@/lib/utils/currency'

type Mode = 'add' | 'remove'

const QUICK_AMOUNTS = [10, 24, 48, 100]

const REASONS = [
  'Received from supplier',
  'Damaged / expired',
  'Returned to supplier',
  'Counting correction',
  'Other',
]

export default function StockAdjustPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [product, setProduct] = useState<Product | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<Mode>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)
  const [resultQty, setResultQty] = useState(0)

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Product) => setProduct(data))
      .catch(() => setLoadError('Product not found.'))
  }, [params.id])

  const parsedAmount = parseInt(amount, 10)
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0

  const projectedQty = product
    ? mode === 'add'
      ? product.stock_qty + (validAmount ? parsedAmount : 0)
      : Math.max(0, product.stock_qty - (validAmount ? parsedAmount : 0))
    : 0

  const wouldClamp =
    product && mode === 'remove' && validAmount && parsedAmount > product.stock_qty

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product || !validAmount) return
    setSaving(true)
    setSaveError('')

    const delta = mode === 'add' ? parsedAmount : -parsedAmount

    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        qty_delta: delta,
        reason: reason || undefined,
      }),
    })

    if (res.ok) {
      const updated: Product = await res.json()
      setResultQty(updated.stock_qty)
      setDone(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setSaveError(body?.error ?? 'Could not save. Please try again.')
    }

    setSaving(false)
  }

  /* ── Success screen ── */
  if (done && product) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto flex flex-col items-center text-center">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Stock updated</h2>
        <p className="text-gray-500 mb-2">{product.name}</p>
        <p className="text-4xl font-bold text-gray-900 mb-1">{resultQty}</p>
        <p className="text-sm text-gray-400 mb-8">units in stock</p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setDone(false)
              setAmount('')
              setReason('')
              setProduct((p) => (p ? { ...p, stock_qty: resultQty } : p))
            }}
            className="bg-blue-600 text-white font-semibold py-3 rounded-2xl active:bg-blue-700"
          >
            Adjust again
          </button>
          <Link
            href="/stock"
            className="bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl text-center active:bg-gray-50"
          >
            Back to Stock
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/stock" className="text-gray-400 active:text-gray-600 text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Adjust Stock</h1>
      </div>

      {loadError && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4">{loadError}</div>
      )}

      {!loadError && !product && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading…</p>
      )}

      {product && (
        <>
          {/* Product info */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
            <p className="font-bold text-gray-900 text-lg">{product.name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-500">Current stock</span>
              <span className="text-2xl font-bold text-gray-900">{product.stock_qty}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-gray-500">Price</span>
              <span className="text-sm font-semibold text-gray-700">{formatZAR(product.price)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mode toggle */}
            <div className="flex gap-2">
              {(['add', 'remove'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors ${
                    mode === m
                      ? m === 'add'
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 active:bg-gray-50'
                  }`}
                >
                  {m === 'add' ? '+ Add stock' : '− Remove stock'}
                </button>
              ))}
            </div>

            {/* Quick amounts */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Quick amounts</p>
              <div className="flex gap-2 flex-wrap">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      amount === String(q)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-200 text-gray-700 active:bg-gray-50'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity to {mode === 'add' ? 'add' : 'remove'}
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Projected result */}
            {validAmount && (
              <div
                className={`rounded-xl px-4 py-3 text-sm flex items-center justify-between ${
                  wouldClamp
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <span className={wouldClamp ? 'text-amber-700' : 'text-gray-600'}>
                  {wouldClamp
                    ? `Can't go below 0 — will set to 0`
                    : `New stock will be`}
                </span>
                <span className="font-bold text-gray-900 text-lg">{projectedQty}</span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason…</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {saveError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4">{saveError}</div>
            )}

            <button
              type="submit"
              disabled={saving || !validAmount}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-base active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? 'Saving…'
                : mode === 'add'
                ? `Add ${validAmount ? parsedAmount : '…'} units`
                : `Remove ${validAmount ? parsedAmount : '…'} units`}
            </button>
          </form>
        </>
      )}
    </main>
  )
}
