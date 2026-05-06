'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Product, Supplier } from '@/types'
import { NewSupplierModal } from '@/components/NewSupplierModal'
import { useTranslation } from '@/components/LanguageProvider'
import { Spinner } from '@/components/Spinner'
import { emitDataChanged } from '@/lib/events'

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { t } = useTranslation('products')
  const [productId, setProductId] = useState<string>('')
  const [product, setProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', cost_price: '', stock_qty: '', supplier_id: '' })
  const [profitTracking, setProfitTracking] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)

  useEffect(() => {
    params.then(({ id }) => {
      setProductId(id)
      Promise.all([
        fetch(`/api/products/${id}`).then((r) => r.json()),
        fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/suppliers').then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([data, settings, sups]: [Product, { profit_tracking_enabled?: boolean } | null, Supplier[]]) => {
          setProduct(data)
          setForm({
            name: data.name,
            price: String(data.price),
            cost_price: data.cost_price != null ? String(data.cost_price) : '',
            stock_qty: String(data.stock_qty),
            supplier_id: data.supplier_id ?? '',
          })
          if (settings?.profit_tracking_enabled) setProfitTracking(true)
          setSuppliers(sups)
        })
        .catch(() => setLoadError(true))
    })
  }, [params])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        price: parseFloat(form.price),
        stock_qty: parseInt(form.stock_qty, 10),
        supplier_id: form.supplier_id || null,
      }
      if (profitTracking) {
        body.cost_price = form.cost_price.trim() !== '' ? parseFloat(form.cost_price) : null
      }
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error) setErrorRaw(data.error)
        else setErrorKey('error_generic')
        return
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

  if (loadError) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="text-red-500">{t('edit_error_load')}</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">{t('edit_loading')}</p>
      </main>
    )
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('edit_title')}</h1>
      </div>

      <p className="text-xs text-gray-400 font-mono mb-6">
        {product.barcode ? t('edit_barcode_prefix', { barcode: product.barcode }) : t('no_barcode')}
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_supplier')} <span className="text-gray-400 font-normal">{t('label_optional')}</span>
          </label>
          <select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('placeholder_supplier_none')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex items-center justify-between mt-1">
            {suppliers.length === 0 && (
              <span className="text-xs text-gray-400">{t('no_suppliers_hint')}</span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => setShowNewSupplier(true)}
                className="text-xs font-semibold text-blue-600 active:text-blue-700"
              >
                {t('btn_add_supplier')}
              </button>
              <Link
                href="/suppliers"
                className="text-xs text-blue-600 active:text-blue-700"
              >
                {t('link_manage_suppliers')} &rsaquo;
              </Link>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_stock_qty')}</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.stock_qty}
            onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner size="sm" />
              {t('btn_saving')}
            </span>
          ) : (
            t('btn_save_changes')
          )}
        </button>
      </form>

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
