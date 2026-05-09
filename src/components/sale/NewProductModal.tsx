'use client'

import { useState, useEffect } from 'react'
import type { Product } from '@/types'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'
import { useTranslation } from '@/components/LanguageProvider'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

interface NewProductModalProps {
  /** The barcode that was scanned but not found in the catalogue. */
  barcode: string
  /** Pre-filled name from the shared barcode catalog (if matched). */
  suggestedName?: string | null
  /** Called with the newly created product so it can be added to the cart. */
  onCreated: (product: Product) => void
  /** Called when the user cancels without creating anything. */
  onDismiss: () => void
}

/**
 * Bottom-sheet modal shown when a scanned barcode has no matching product.
 * Lets the owner quick-create the product so the sale can continue.
 */
export function NewProductModal({ barcode, suggestedName, onCreated, onDismiss }: NewProductModalProps) {
  const { t } = useTranslation('products')
  const [name, setName] = useState(suggestedName ?? '')
  const [price, setPrice] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [profitTracking, setProfitTracking] = useState(false)
  const [stock, setStock] = useState('0')
  const [trackExpiry, setTrackExpiry] = useState(false)
  const [expiryEntries, setExpiryEntries] = useState<ExpiryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profit_tracking_enabled) setProfitTracking(true)
      })
      .catch(() => { /* default off */ })
  }, [])

  // When a duplicate name is found, store the existing product
  const [existingProduct, setExistingProduct] = useState<Product | null>(null)

  const stockQty = parseInt(stock, 10) || 0

  const validEntries = expiryEntries.filter(
    (e) => e.expiry_date && parseInt(e.quantity, 10) > 0,
  )
  const hasExpiry = trackExpiry && validEntries.length > 0 && stockQty > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const priceNum = parseFloat(price)
    if (!name.trim()) {
      setError(t('error_enter_name'))
      return
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError(t('error_enter_price'))
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode,
          name: name.trim(),
          price: priceNum,
          cost_price: profitTracking && costPrice.trim() !== ''
            ? parseFloat(costPrice)
            : null,
          stock_qty: hasExpiry ? 0 : stockQty,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        // Name duplicate — try to find the existing product
        if (res.status === 409 && json.error?.includes('product called that')) {
          await findExistingProduct(name.trim())
          return
        }
        setError(json.error ?? t('error_create_failed'))
        return
      }

      // If expiry dates provided, create a batch for each one
      if (hasExpiry) {
        for (const entry of validEntries) {
          await fetch('/api/batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: json.id,
              expiry_date: entry.expiry_date,
              quantity: parseInt(entry.quantity, 10),
            }),
          })
          // If batch fails, product is still created — user can add expiry later
        }
      }

      onCreated(json as Product)
    } catch {
      setError(t('error_network'))
    } finally {
      setIsLoading(false)
    }
  }

  /** Search for an existing product by name and offer to use it instead. */
  async function findExistingProduct(searchName: string) {
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(searchName)}`)
      if (!res.ok) {
        setError(t('error_product_name_exists'))
        return
      }
      const json = await res.json()
      const products = (json.products ?? json) as Product[]
      // Find exact case-insensitive match
      const match = products.find(
        (p) => p.name.toLowerCase() === searchName.toLowerCase(),
      )
      if (match) {
        setExistingProduct(match)
        setError(null)
        // If existing product has no barcode, silently link this barcode to it
        if (!match.barcode && barcode) {
          fetch(`/api/products/${match.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode }),
          }).catch(() => {}) // silent — not critical
        }
      } else {
        setError(t('error_product_name_exists'))
      }
    } catch {
      setError(t('error_product_name_exists'))
    } finally {
      setIsLoading(false)
    }
  }

  function handleUseExisting() {
    if (existingProduct) {
      onCreated(existingProduct)
    }
  }

  // ── "Already exists" screen ──
  if (existingProduct) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
        <div className="bg-white w-full rounded-t-2xl px-6 pt-6 pb-10">
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('existing_product_title')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {t('existing_product_text', { name: existingProduct.name })}
          </p>

          <div className="bg-gray-50 rounded-xl p-4 mb-5">
            <p className="font-semibold text-gray-900">{existingProduct.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              R{existingProduct.price.toFixed(2)} · {t('existing_product_in_stock', { qty: existingProduct.stock_qty })}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-full font-medium active:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleUseExisting}
              className="flex-1 bg-brand text-white py-3 rounded-full font-semibold active:bg-brand-hover"
            >
              {t('btn_add_to_sale')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    /* backdrop */
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      {/* sheet */}
      <div className="bg-white w-full rounded-t-2xl px-6 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-0.5">{t('new_product_title')}</h2>
        <p className="text-sm text-gray-500 mb-5">
          {t('new_product_barcode_not_found', { barcode })}{' '}
          {suggestedName ? t('new_product_catalog_hint') : t('new_product_fill_details')}
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_product_name')}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('placeholder_product_name')}
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('label_price')}
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('label_stock_units')}
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                min="0"
                inputMode="numeric"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          {profitTracking && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('label_cost_price')}
              </label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder={t('placeholder_cost_price')}
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-gray-400 mt-1">{t('hint_cost_price')}</p>
            </div>
          )}

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
                <span className="text-sm text-gray-700">{t('label_track_expiry')}</span>
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

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-full font-medium active:bg-gray-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-3 rounded-full font-semibold active:bg-brand-hover disabled:opacity-50"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {isLoading ? t('saving') : t('btn_add_scan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
