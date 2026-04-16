'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { useTranslation } from '@/components/LanguageProvider'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

function NewProductContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation('products')

  const prefillBarcode = searchParams.get('barcode') ?? ''
  const prefillName = searchParams.get('name') ?? ''

  const [form, setForm] = useState({
    barcode: prefillBarcode,
    name: prefillName,
    price: '',
    cost_price: '',
    stock_qty: '0',
  })
  const [profitTracking, setProfitTracking] = useState(false)
  const [trackExpiry, setTrackExpiry] = useState(false)
  const [expiryEntries, setExpiryEntries] = useState<ExpiryEntry[]>([])
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profit_tracking_enabled) setProfitTracking(true)
      })
      .catch(() => { /* default off */ })
  }, [])

  const stockQty = parseInt(form.stock_qty, 10) || 0

  const validEntries = expiryEntries.filter(
    (e) => e.expiry_date && parseInt(e.quantity, 10) > 0,
  )
  const hasExpiry = trackExpiry && validEntries.length > 0 && stockQty > 0

  async function handleBarcodeScan(barcode: string) {
    setForm((f) => ({ ...f, barcode }))
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.catalog_suggestion?.name && !form.name) {
          setForm((f) => ({ ...f, barcode, name: data.catalog_suggestion.name }))
        }
      }
    } catch {
      // Barcode filled, catalog lookup failed — not critical
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    setLoading(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: form.barcode.trim() || null,
          name: form.name.trim(),
          price: parseFloat(form.price),
          cost_price: profitTracking && form.cost_price.trim() !== ''
            ? parseFloat(form.cost_price)
            : null,
          stock_qty: hasExpiry ? 0 : stockQty,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error) setErrorRaw(data.error)
        else setErrorKey('error_generic')
        return
      }

      if (hasExpiry) {
        let batchFailed = false
        for (const entry of validEntries) {
          const batchRes = await fetch('/api/batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: data.id,
              expiry_date: entry.expiry_date,
              quantity: parseInt(entry.quantity, 10),
            }),
          })
          if (!batchRes.ok) batchFailed = true
        }
        if (batchFailed) {
          setErrorKey('error_expiry_partial')
        }
      }

      router.push('/products')
    } catch {
      setErrorKey('error_network')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_barcode')} <span className="text-gray-400 font-normal">{t('label_optional')}</span>
          </label>
          <div className="flex gap-2">
            <input
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder={t('placeholder_barcode')}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="shrink-0 bg-blue-600 text-white px-4 py-3 rounded-xl active:bg-blue-700 text-sm font-semibold"
              aria-label={t('btn_scan_aria')}
            >
              {t('btn_scan')}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('placeholder_name')}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_price')}</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder={t('placeholder_price')}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {profitTracking && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_cost_price')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.cost_price}
              onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
              placeholder={t('placeholder_cost_price')}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">{t('hint_cost_price')}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_opening_stock')}</label>
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
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trackExpiry}
                onChange={(e) => {
                  setTrackExpiry(e.target.checked)
                  if (e.target.checked && expiryEntries.length === 0) {
                    setExpiryEntries([{ expiry_date: '', quantity: '' }])
                  }
                }}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{t('label_expiry')}</span>
            </label>

            {trackExpiry && (
              <ExpiryEntryList
                entries={expiryEntries}
                onChange={setExpiryEntries}
                totalStockQty={stockQty}
              />
            )}
          </div>
        )}

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? t('btn_saving') : t('btn_save_product')}
        </button>
      </form>

      {scanning && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScanning(false)}
        />
      )}
    </main>
  )
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-10 pb-24 max-w-lg mx-auto"><p className="text-center text-gray-400 text-sm mt-12">Loading...</p></main>}>
      <NewProductContent />
    </Suspense>
  )
}
