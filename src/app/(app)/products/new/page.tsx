'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { NewSupplierModal } from '@/components/NewSupplierModal'
import { BackButton } from '@/components/BackButton'
import { useTranslation } from '@/components/LanguageProvider'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, FormField, Input, Select, Callout } from '@/components/ui'
import type { Supplier } from '@/types'
import { emitDataChanged } from '@/lib/events'

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
    supplier_id: '',
  })
  const [trackExpiry, setTrackExpiry] = useState(false)
  const [expiryEntries, setExpiryEntries] = useState<ExpiryEntry[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)

  useEffect(() => {
    fetch('/api/suppliers')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Supplier[]) => setSuppliers(data))
      .catch(() => { /* non-critical */ })
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
          cost_price: form.cost_price.trim() !== ''
            ? parseFloat(form.cost_price)
            : null,
          stock_qty: hasExpiry ? 0 : stockQty,
          supplier_id: form.supplier_id || null,
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

      emitDataChanged()
      router.refresh()
      router.push('/products')
    } catch {
      setErrorKey('error_network')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      {loading && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="flex items-center gap-2 mb-8">
        <BackButton fallbackHref="/products" />
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label={
            <>
              {t('label_barcode')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
        >
          <div className="flex gap-2">
            <Input
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder={t('placeholder_barcode')}
              className="flex-1"
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => setScanning(true)}
              aria-label={t('btn_scan_aria')}
              className="shrink-0"
            >
              {t('btn_scan')}
            </Button>
          </div>
        </FormField>

        <FormField label={t('label_name')}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('placeholder_name')}
            required
          />
        </FormField>

        <FormField label={t('label_price')}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder={t('placeholder_price')}
            required
          />
        </FormField>

        <FormField
          label={
            <>
              {t('label_cost_price')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
          hint={t('hint_cost_price')}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.cost_price}
            onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
            placeholder={t('placeholder_cost_price')}
          />
        </FormField>

        <FormField
          label={
            <>
              {t('label_supplier')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
        >
          <Select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
          >
            <option value="">{t('placeholder_supplier_none')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between mt-1">
            {suppliers.length === 0 && (
              <span className="text-xs text-gray-400">{t('no_suppliers_hint')}</span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => setShowNewSupplier(true)}
                className="text-xs font-semibold text-brand active:text-brand-hover"
              >
                {t('btn_add_supplier')}
              </button>
              <Link
                href="/suppliers"
                className="text-xs text-brand active:text-brand-hover"
              >
                {t('link_manage_suppliers')} &rsaquo;
              </Link>
            </div>
          </div>
        </FormField>

        <FormField label={t('label_opening_stock')}>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.stock_qty}
            onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
          />
        </FormField>

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
                className="w-5 h-5 rounded border-gray-300 text-brand focus:ring-brand"
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

        {errorMessage && <Callout tone="error">{errorMessage}</Callout>}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {loading ? t('btn_saving') : t('btn_save_product')}
        </Button>
      </form>

      {scanning && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setScanning(false)}
        />
      )}

      {showNewSupplier && (
        <NewSupplierModal
          onCreated={(s) => {
            setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))
            setForm((f) => ({ ...f, supplier_id: s.id }))
            setShowNewSupplier(false)
          }}
          onDismiss={() => setShowNewSupplier(false)}
        />
      )}
    </main>
  )
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-10 pb-24 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto"><p className="text-center text-gray-400 text-sm mt-12">Loading...</p></main>}>
      <NewProductContent />
    </Suspense>
  )
}
