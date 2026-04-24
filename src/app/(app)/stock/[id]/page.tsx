'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Product, ProductBatch, Supplier } from '@/types'
import { formatZAR } from '@/lib/utils/currency'
import { ConfirmModal } from '@/components/ConfirmModal'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'
import { NewSupplierModal } from '@/components/NewSupplierModal'
import { useTranslation } from '@/components/LanguageProvider'
import { emitDataChanged } from '@/lib/events'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

type Mode = 'add' | 'remove'

const QUICK_AMOUNTS = [10, 24, 48, 100]

const REASON_KEYS = [
  'adjust_reason_received',
  'adjust_reason_damaged',
  'adjust_reason_returned',
  'adjust_reason_correction',
  'adjust_reason_other',
] as const

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

function StockAdjustContent() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const { t, tPlural } = useTranslation('stock')
  const { t: tSup } = useTranslation('products')
  const todayStr = new Date().toISOString().split('T')[0]

  const [product, setProduct] = useState<Product | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [mode, setMode] = useState<Mode>(() => searchParams.get('mode') === 'remove' ? 'remove' : 'add')
  const [amount, setAmount] = useState(() => searchParams.get('qty') ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveErrorKey, setSaveErrorKey] = useState<string | null>(null)
  const [saveErrorCount, setSaveErrorCount] = useState(0)
  const [saveErrorRaw, setSaveErrorRaw] = useState('')
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
  const [batchErrorKey, setBatchErrorKey] = useState<string | null>(null)
  const [batchErrorRaw, setBatchErrorRaw] = useState('')
  const [discardingId, setDiscardingId] = useState<string | null>(null)
  const [showNewSupplier, setShowNewSupplier] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Product) => {
        setProduct(data)
        setSelectedSupplierId(data.supplier_id ?? '')
      })
      .catch(() => setLoadError(true))
  }, [params.id])

  // Load batches
  useEffect(() => {
    if (!params.id) return
    fetch(`/api/batches?product_id=${params.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ProductBatch[]) => setBatches(data))
      .catch(() => {})
  }, [params.id])

  // Load suppliers (for the add-mode dropdown)
  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Supplier[]) => setSuppliers(data))
      .catch(() => {})
  }, [])

  const parsedAmount = parseInt(amount, 10)
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0

  const projectedQty = product
    ? mode === 'add'
      ? product.stock_qty + (validAmount ? parsedAmount : 0)
      : Math.max(0, product.stock_qty - (validAmount ? parsedAmount : 0))
    : 0

  const wouldClamp =
    product && mode === 'remove' && validAmount && parsedAmount > product.stock_qty

  /**
   * Phase 30b: log the receipt + update product's last-known supplier when
   * the user actually added stock. Runs best-effort after the main adjust
   * succeeds — any error here is silent (audit trail only, not the main op).
   */
  async function logReceiptAndMaybeUpdateSupplier(productBefore: Product, quantityAdded: number) {
    if (quantityAdded <= 0) return
    try {
      await fetch('/api/goods-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productBefore.id,
          quantity: quantityAdded,
          supplier_id: selectedSupplierId || null,
        }),
      })
      if ((selectedSupplierId || null) !== (productBefore.supplier_id ?? null)) {
        await fetch(`/api/products/${productBefore.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: productBefore.name,
            price: productBefore.price,
            supplier_id: selectedSupplierId || null,
          }),
        })
      }
    } catch {
      /* audit trail best-effort — don't block the UX */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product || !validAmount) return
    setSaving(true)
    setSaveErrorKey(null)
    setSaveErrorRaw('')

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
        setSaveErrorKey('adjust_save_error_partial')
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
          setSaveErrorKey('adjust_save_error_expiry_partial')
          setSaveErrorCount(remainder)
        }
      }

      if (totalAdded > 0) {
        setResultQty(product.stock_qty + totalAdded)
        setDone(true)
        await logReceiptAndMaybeUpdateSupplier(product, totalAdded)
        emitDataChanged()
      } else if (!saveErrorKey) {
        setSaveErrorKey('adjust_save_error_generic')
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
      if (mode === 'add') {
        await logReceiptAndMaybeUpdateSupplier(product, parsedAmount)
      }
      emitDataChanged()
    } else {
      const body = await res.json().catch(() => ({}))
      if (body?.error) {
        setSaveErrorRaw(body.error)
      } else {
        setSaveErrorKey('adjust_save_error_generic')
      }
    }

    setSaving(false)
  }

  async function handleAddBatch(e: React.FormEvent) {
    e.preventDefault()
    if (!product) return
    const qty = parseInt(batchQty, 10)
    if (!batchDate || isNaN(qty) || qty < 1) return

    setBatchSaving(true)
    setBatchErrorKey(null)
    setBatchErrorRaw('')

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
      emitDataChanged()
    } else {
      const body = await res.json().catch(() => ({}))
      if (body?.error) {
        setBatchErrorRaw(body.error)
      } else {
        setBatchErrorKey('batches_error_add')
      }
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
      emitDataChanged()
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
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('adjust_success_title')}</h2>
        <p className="text-gray-500 mb-2">{product.name}</p>
        <p className="text-4xl font-bold text-gray-900 mb-1">{resultQty}</p>
        <p className="text-sm text-gray-400 mb-8">{t('adjust_success_units')}</p>

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
            {t('adjust_success_btn_again')}
          </button>
          <Link
            href="/stock"
            className="bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl text-center active:bg-gray-50"
          >
            {t('adjust_success_btn_back')}
          </Link>
        </div>
      </main>
    )
  }

  const statusLabelKey = (status: 'expired' | 'soon' | 'ok') =>
    status === 'expired' ? 'batches_status_expired' : status === 'soon' ? 'batches_status_soon' : 'batches_status_ok'

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/stock" className="flex items-center gap-1 text-gray-500 active:text-gray-700 font-medium py-1 pr-2">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'add' ? t('adjust_title_add') : t('adjust_title_remove')}
        </h1>
      </div>

      {loadError && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4">{t('adjust_product_not_found')}</div>
      )}

      {!loadError && !product && (
        <p className="text-center text-gray-400 text-sm mt-12">{t('adjust_loading')}</p>
      )}

      {product && (
        <>
          {/* Product info */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-5">
            <p className="font-bold text-gray-900 text-lg">{product.name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-gray-500">{t('adjust_current_stock')}</span>
              <span className="text-2xl font-bold text-gray-900">{product.stock_qty}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-gray-500">{t('adjust_price')}</span>
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
                  {m === 'add' ? t('adjust_btn_mode_add') : t('adjust_btn_mode_remove')}
                </button>
              ))}
            </div>

            {/* Quick amounts */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">{t('adjust_quick_amounts')}</p>
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
                {mode === 'add' ? t('adjust_label_qty_add') : t('adjust_label_qty_remove')}
              </label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('adjust_amount_placeholder')}
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
                  {wouldClamp ? t('adjust_clamp_warning') : t('adjust_new_stock')}
                </span>
                <span className="font-bold text-gray-900 text-lg">{projectedQty}</span>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('adjust_label_reason')} <span className="text-gray-400 font-normal">{t('adjust_reason_optional')}</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('adjust_reason_placeholder')}</option>
                {REASON_KEYS.map((rk) => (
                  <option key={rk} value={t(rk)}>
                    {t(rk)}
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier (only when adding stock) */}
            {mode === 'add' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('adjust_label_supplier')} <span className="text-gray-400 font-normal">{t('adjust_reason_optional')}</span>
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('adjust_placeholder_supplier_none')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-end gap-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewSupplier(true)}
                    className="text-xs font-semibold text-blue-600 active:text-blue-700"
                  >
                    {tSup('btn_add_supplier')}
                  </button>
                  <Link href="/suppliers" className="text-xs text-blue-600 active:text-blue-700">
                    {tSup('link_manage_suppliers')} &rsaquo;
                  </Link>
                </div>
              </div>
            )}

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
                        setAddExpiryEntries([{ expiry_date: todayStr, quantity: '' }])
                      }
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t('adjust_expiry_checkbox')}</span>
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

            {(saveErrorKey || saveErrorRaw) && (
              <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4">
                {saveErrorRaw
                  ? saveErrorRaw
                  : saveErrorKey === 'adjust_save_error_expiry_partial'
                    ? t(saveErrorKey, { count: saveErrorCount })
                    : saveErrorKey
                      ? t(saveErrorKey)
                      : ''}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !validAmount}
              className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-base active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? t('adjust_btn_saving')
                : mode === 'add'
                  ? validAmount
                    ? tPlural('adjust_btn_add_units', parsedAmount, { count: parsedAmount })
                    : t('adjust_btn_add_units_pending')
                  : validAmount
                    ? tPlural('adjust_btn_remove_units', parsedAmount, { count: parsedAmount })
                    : t('adjust_btn_remove_units_pending')}
            </button>
          </form>

          {/* ── Expiry Batches Section ── */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">{t('batches_title')}</h2>
              <button
                type="button"
                onClick={() => {
                  const next = !showAddBatch
                  setShowAddBatch(next)
                  if (next && !batchDate) setBatchDate(todayStr)
                }}
                className="text-sm font-semibold text-blue-600 active:text-blue-700"
              >
                {showAddBatch ? t('batches_btn_cancel') : t('batches_btn_add')}
              </button>
            </div>

            {/* Add batch form */}
            {showAddBatch && (
              <form onSubmit={handleAddBatch} className="bg-blue-50 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('batches_label_date')}
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
                    {t('batches_label_qty')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    placeholder={t('batches_qty_placeholder')}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(batchErrorKey || batchErrorRaw) && (
                  <p className="text-red-600 text-sm">
                    {batchErrorRaw ? batchErrorRaw : batchErrorKey ? t(batchErrorKey) : ''}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={batchSaving || !batchDate || !batchQty}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm active:bg-blue-700 disabled:opacity-50"
                >
                  {batchSaving ? t('batches_btn_saving') : t('batches_btn_save')}
                </button>
                <p className="text-xs text-gray-500">
                  {t('batches_hint')}
                </p>
              </form>
            )}

            {/* Batch list */}
            {batches.length === 0 ? (
              <p className="text-sm text-gray-400">
                {t('batches_none')}
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
                            {t(statusLabelKey(status))}
                          </span>
                          <span className="text-xs text-gray-500">{tPlural('batches_units', b.quantity, { count: b.quantity })}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDiscardingId(b.id)}
                        className="text-xs font-semibold text-red-500 active:text-red-700 px-3 py-1"
                      >
                        {t('batches_btn_remove')}
                      </button>
                    </div>
                  )
                })}

                {/* Untracked stock note */}
                {untrackedQty > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    {tPlural('batches_untracked', untrackedQty, { count: untrackedQty })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Discard confirm modal */}
          {discardingId && (
            <ConfirmModal
              message={t('batches_confirm_remove')}
              confirmLabel={t('batches_confirm_btn')}
              isDestructive
              onConfirm={() => handleDiscardBatch(discardingId)}
              onCancel={() => setDiscardingId(null)}
            />
          )}

          {showNewSupplier && (
            <NewSupplierModal
              onCreated={(s) => {
                setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))
                setSelectedSupplierId(s.id)
                setShowNewSupplier(false)
              }}
              onDismiss={() => setShowNewSupplier(false)}
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
