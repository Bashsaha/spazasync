'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { t } = useTranslation('products')
  const [productId, setProductId] = useState<string>('')
  const [product, setProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', price: '', cost_price: '', stock_qty: '' })
  const [profitTracking, setProfitTracking] = useState(false)
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    params.then(({ id }) => {
      setProductId(id)
      Promise.all([
        fetch(`/api/products/${id}`).then((r) => r.json()),
        fetch('/api/settings').then((r) => (r.ok ? r.json() : null)),
      ])
        .then(([data, settings]: [Product, { profit_tracking_enabled?: boolean } | null]) => {
          setProduct(data)
          setForm({
            name: data.name,
            price: String(data.price),
            cost_price: data.cost_price != null ? String(data.cost_price) : '',
            stock_qty: String(data.stock_qty),
          })
          if (settings?.profit_tracking_enabled) setProfitTracking(true)
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
      router.push('/products')
    } catch {
      setErrorKey('error_network')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm(t('confirm_delete'))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!res.ok) {
        setErrorKey('error_delete')
        return
      }
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
          {loading ? t('btn_saving') : t('btn_save_changes')}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="w-full text-red-500 font-semibold py-3 text-sm active:text-red-700 disabled:opacity-50"
        >
          {t('btn_delete_product')}
        </button>
      </div>
    </main>
  )
}
