'use client'

import { useState } from 'react'
import type { Product } from '@/types'
import { ExpiryEntryList } from '@/components/ExpiryEntryList'

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
  const [name, setName] = useState(suggestedName ?? '')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [trackExpiry, setTrackExpiry] = useState(false)
  const [expiryEntries, setExpiryEntries] = useState<ExpiryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError('Enter a product name.')
      return
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Enter a valid price.')
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
          stock_qty: hasExpiry ? 0 : stockQty,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not create product. Try again.')
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
      setError('Network error. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    /* backdrop */
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      {/* sheet */}
      <div className="bg-white w-full rounded-t-2xl px-6 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-0.5">New Product</h2>
        <p className="text-sm text-gray-500 mb-5">
          Barcode <span className="font-mono text-gray-700">{barcode}</span> not in your catalogue.
          {suggestedName
            ? ' We found a matching name — just set your price.'
            : ' Fill in the details to add it.'}
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coca-Cola 500ml"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (R)
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock (units)
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                min="0"
                inputMode="numeric"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
                <span className="text-sm text-gray-700">Do you know the expiry dates?</span>
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
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium active:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold active:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving…' : 'Add & Scan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
