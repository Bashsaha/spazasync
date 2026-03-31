'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Product, ProductBatch } from '@/types'
import { formatZAR } from '@/lib/utils/currency'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

type Mode = 'add' | 'remove'

const QUICK_AMOUNTS = [10, 24, 48, 100]

const REASONS = [
  'Received from supplier',
  'Damaged or expired',
  'Returned to supplier',
  'I counted it wrong before',
  'Other',
]

/** Classify a batch by its expiry date relative to today. */
function expiryStatus(expiryDate: string): 'expired' | 'soon' | 'ok' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate + 'T00:00:00')
  if (exp < today) return 'expired'
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  return diff <= 7 ? 'soon' : 'ok'
}

function expiryBadge(status: 'expired' | 'soon' | 'ok') {
  if (status === 'expired') return 'bg-red-100 text-red-700'
  if (status === 'soon') return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function expiryLabel(status: 'expired' | 'soon' | 'ok') {
  if (status === 'expired') return 'Expired'
  if (status === 'soon') return 'Expiring soon'
  return 'OK'
}

function StockAdjustContent() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const [product, setProduct] = useState<Product | null>(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState<Mode>(() => searchParams.get('mode') === 'remove' ? 'remove' : 'add')
  const [amount, setAmount] = useState(() => searchParams.get('qty') ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)
  const [resultQty, setResultQty] = useState(0)

  // Expiry dates for "Add stock" mode
  const [trackAddExpiry, setTrackAddExpiry] = useState(false)
  const [addExpiryEntries, setAddExpiryEntries] = useState<ExpiryEntry[]>([])

  // Batch state
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [batchDate, setBatchDate] = useState('')
  const [batchQty, setBatchQty] = useState('')
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [discardingId, setDiscardingId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Product) => setProduct(data))
      .catch(() => setLoadError('Product not found.'))
  }, [params.id])

  // Load batches
  useEffect(() => {
    if (!params.id) return
    fetch(`/api/batches?product_id=${params.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ProductBatch[]) => setBatches(data))
      .catch(() => {})
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

    // When adding stock with expiry dates, use the batch API for each entry
    const validAddEntries = addExpiryEntries.filter(
      (e) => e.expiry_date && parseInt(e.quantity, 10) > 0,
    )
    if (mode === 'add' && trackAddExpiry && validAddEntries.length > 0) {
      let totalAdded = 0
      let batchFailed = false
      for (const entry of validAddEntries) {
        const qty = parseInt(entry.quantity, 10)
        const res = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: product.id,
            expiry_date: entry.expiry_date,
            quantity: qty,
          }),
        })

        if (res.ok) {
          const newBatch: ProductBatch = await res.json()
          setBatches((prev) => [...prev, newBatch].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)))
          totalAdded += qty
        } else {
          batchFailed = true
        }
      }

      if (batchFailed) {
        setSaveError('Some expiry dates could not be saved. You can add them later.')
      }

      // Add remaining units that have no expiry date via regular stock adjustment
      const remainder = parsedAmount - totalAdded
      if (remainder > 0) {
        const stockRes = await fetch('/api/stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: product.id,
            qty_delta: remainder,
            reason: reason || undefined,
          }),
        })
        if (stockRes.ok) {
          totalAdded += remainder
        } else {
          setSaveError(`Expiry dates saved, but ${remainder} units without expiry could not be added.`)
        }
      }

      if (totalAdded > 0) {
        setResultQty(product.stock_qty + totalAdded)
        setDone(true)
      } else {
        setSaveError('Could not save. Please try again.')
      }

      setSaving(false)
      return
    }

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

  async function handleAddBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!product) return
    const qty = parseInt(batchQty, 10)
    if (!batchDate || isNaN(qty) || qty < 1) return

    setBatchSaving(true)
    setBatchError('')

    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: product.id,
        expiry_date: batchDate,
        quantity: qty,
      }),
    })

    if (res.ok) {
      const newBatch: ProductBatch = await res.json()
      setBatches((prev) => [...prev, newBatch].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)))
      setProduct((p) => (p ? { ...p, stock_qty: p.stock_qty + qty } : p))
      setBatchDate('')
      setBatchQty('')
      setShowAddBatch(false)
    } else {
      const body = await res.json().catch(() => ({}))
      setBatchError(body?.error ?? 'Could not add. Please try again.')
    }

    setBatchSaving(false)
  }

  async function handleDiscardBatch(batchId: string) {
    const batch = batches.find((b) => b.id === batchId)
    if (!batch) return

    const res = await fetch(`/api/batches/${batchId}`, { method: 'DELETE' })

    if (res.ok) {
      setBatches((prev) => prev.filter((b) => b.id !== batchId))
      setProduct((p) => (p ? { ...p, stock_qty: Math.max(0, p.stock_qty - batch.quantity) } : p))
    }
    setDiscardingId(null)
  }

  const batchTotal = batches.reduce((sum, b) => sum + b.quantity, 0)
  const untrackedQty = product ? Math.max(0, product.stock_qty - batchTotal) : 0

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
              setTrackAddExpiry(false)
              setAddExpiryEntries([])
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
        <Link href="/stock" className="flex items-center gap-1 text-gray-500 active:text-gray-700 font-medium py-1 pr-2">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'add' ? 'Add Stock' : 'Remove Stock'}
        </h1>
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
                  onClick={() => { setMode(m); if (m === 'remove') { setTrackAddExpiry(false); setAddExpiryEntries([]) } }}
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

            {/* Expiry dates (only when adding stock) */}
            {mode === 'add' && (
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackAddExpiry}
                    onChange={(e) => {
                      setTrackAddExpiry(e.target.checked)
                      if (e.target.checked && addExpiryEntries.length === 0) {
                        setAddExpiryEntries([{ expiry_date: '', quantity: '' }])
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Add expiry dates for this stock</span>
                </label>

                {trackAddExpiry && (
                  <ExpiryEntryList
                    entries={addExpiryEntries}
                    onChange={setAddExpiryEntries}
                    totalStockQty={validAmount ? parsedAmount : 0}
                  />
                )}
              </div>
            )}

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

          {/* ── Expiry Batches Section ── */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Expiry Dates</h2>
              <button
                type="button"
                onClick={() => setShowAddBatch(!showAddBatch)}
                className="text-sm font-semibold text-blue-600 active:text-blue-700"
              >
                {showAddBatch ? 'Cancel' : '+ Add expiry date'}
              </button>
            </div>

            {/* Add batch form */}
            {showAddBatch && (
              <form onSubmit={handleAddBatch} className="bg-blue-50 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry date
                  </label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={(e) => setBatchDate(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    placeholder="How many units with this expiry date?"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {batchError && (
                  <p className="text-red-600 text-sm">{batchError}</p>
                )}
                <button
                  type="submit"
                  disabled={batchSaving || !batchDate || !batchQty}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-blue-700 disabled:opacity-50"
                >
                  {batchSaving ? 'Adding…' : 'Add'}
                </button>
                <p className="text-xs text-gray-500">
                  This also adds the quantity to your total stock.
                </p>
              </form>
            )}

            {/* Batch list */}
            {batches.length === 0 ? (
              <p className="text-sm text-gray-400">
                No expiry dates tracked for this product. Tap &quot;+ Add expiry date&quot; to start tracking.
              </p>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => {
                  const status = expiryStatus(b.expiry_date)
                  return (
                    <div
                      key={b.id}
                      className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(b.expiry_date + 'T00:00:00').toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expiryBadge(status)}`}>
                            {expiryLabel(status)}
                          </span>
                          <span className="text-xs text-gray-500">{b.quantity} units</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDiscardingId(b.id)}
                        className="text-xs font-semibold text-red-500 active:text-red-700 px-3 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}

                {/* Untracked stock note */}
                {untrackedQty > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    {untrackedQty} unit{untrackedQty !== 1 ? 's' : ''} have no expiry date set.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Discard confirm modal */}
          {discardingId && (
            <ConfirmModal
              message="Remove this stock? The quantity will be reduced from your total."
              confirmLabel="Remove"
              isDestructive
              onConfirm={() => handleDiscardBatch(discardingId)}
              onCancel={() => setDiscardingId(null)}
            />
          )}
        </>
      )}
    </main>
  )
}

export default function StockAdjustPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-10 pb-24 max-w-lg mx-auto"><p className="text-center text-gray-400 text-sm mt-12">Loading…</p></main>}>
      <StockAdjustContent />
    </Suspense>
  )
}
