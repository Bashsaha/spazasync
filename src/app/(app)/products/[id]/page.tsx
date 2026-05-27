'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Product, Supplier } from '@/types'
import { NewSupplierModal } from '@/components/NewSupplierModal'
import { BackButton } from '@/components/BackButton'
import { useTranslation } from '@/components/LanguageProvider'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, FormField, Input, Select, Callout } from '@/components/ui'
import { emitDataChanged } from '@/lib/events'

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('return')
  const returnUrl =
    returnTo === 'missing_cost'
      ? '/products/missing-cost'
      : returnTo === 'missing_supplier'
        ? '/products/missing-supplier'
        : '/products'
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
      router.push(returnUrl)
    } catch {
      setErrorKey('error_network')
    } finally {
      setLoading(false)
    }
  }

  if (loadError) {
    return (
      <main className="px-4 pt-10 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <p className="text-red-500">{t('edit_error_load')}</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-4 pt-10 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
        <p className="text-gray-400 text-sm">{t('edit_loading')}</p>
      </main>
    )
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      {loading && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="flex items-center gap-2 mb-6">
        <BackButton fallbackHref={returnUrl} />
        <h1 className="text-2xl font-bold text-gray-900">{t('edit_title')}</h1>
      </div>

      <p className="text-xs text-gray-400 font-mono mb-6">
        {product.barcode ? t('edit_barcode_prefix', { barcode: product.barcode }) : t('no_barcode')}
      </p>

      <form onSubmit={handleSave} className="space-y-4">
        <FormField label={t('label_name')}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </FormField>

        <FormField label={t('label_price')}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none z-10">
              R
            </span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              required
              className="pl-8"
            />
          </div>
        </FormField>

        {profitTracking && (
          <FormField label={t('label_cost_price')} hint={t('hint_cost_price')}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none z-10">
                R
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                placeholder={t('placeholder_cost_price')}
                required
                className="pl-8"
              />
            </div>
          </FormField>
        )}

        <FormField
          label={
            <>
              {t('label_supplier')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
        >
          {suppliers.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowNewSupplier(true)}
              className="w-full flex items-center justify-between border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-brand font-semibold bg-white active:bg-gray-50"
            >
              <span>{t('btn_add_supplier')}</span>
              <span className="text-lg leading-none">+</span>
            </button>
          ) : (
            <Select
              value={form.supplier_id}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewSupplier(true)
                  return
                }
                setForm((f) => ({ ...f, supplier_id: e.target.value }))
              }}
            >
              <option value="">{t('placeholder_supplier_none')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__new__">+ {t('btn_add_supplier')}</option>
            </Select>
          )}
        </FormField>

        <FormField label={t('label_stock_qty')}>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={form.stock_qty}
            onChange={(e) => setForm((f) => ({ ...f, stock_qty: e.target.value }))}
            required
          />
        </FormField>

        {errorMessage && <Callout tone="error">{errorMessage}</Callout>}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {loading ? t('btn_saving') : t('btn_save_changes')}
        </Button>
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
