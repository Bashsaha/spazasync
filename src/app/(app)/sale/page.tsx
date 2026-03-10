'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActiveTeller } from '@/hooks/useActiveTeller'
import { useCart } from '@/hooks/useCart'
import { TellerSelector } from '@/components/sale/TellerSelector'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { CartItem } from '@/components/sale/CartItem'
import { CartSummary } from '@/components/sale/CartSummary'
import { NewProductModal } from '@/components/sale/NewProductModal'
import type { Product } from '@/types'

export default function SalePage() {
  const router = useRouter()
  const { activeTeller, setActiveTeller, clearActiveTeller, isLoading, role } = useActiveTeller()
  const { items, total, addItem, removeItem, updateQty, clearCart } = useCart()

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Barcode scan handler ───────────────────────────────────────────────────

  async function handleScan(barcode: string) {
    const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`)
    if (!res.ok) {
      setUnknownBarcode(barcode)
      return
    }
    const products = (await res.json()) as Product[]
    if (products.length === 0) {
      setUnknownBarcode(barcode)
      return
    }
    addItem(products[0])
  }

  function handleNewProductCreated(product: Product) {
    setUnknownBarcode(null)
    addItem(product)
  }

  // ── Complete sale ──────────────────────────────────────────────────────────

  async function handleCompleteSale() {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teller_id: activeTeller?.id ?? null,
          items: items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            unit_price: i.product.price,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error ?? 'Something went wrong. Try again.')
        return
      }

      clearCart()
      router.push(`/sale/complete?total=${encodeURIComponent(total.toFixed(2))}`)
    } catch {
      setSubmitError('Network error. Check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    )
  }

  // ── Owner must pick a teller first ────────────────────────────────────────

  if (role === 'owner' && !activeTeller) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Start a Sale</h1>
        <p className="text-gray-500 text-sm mb-8">Select who is serving today.</p>
        <TellerSelector onSelect={setActiveTeller} selectedId={null} />
      </main>
    )
  }

  // ── Main sale UI ───────────────────────────────────────────────────────────

  return (
    <>
      <main className="px-4 pt-8 pb-36 max-w-lg mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Sale</h1>
          {role === 'owner' && (
            <button
              onClick={clearActiveTeller}
              className="text-xs text-orange-500 font-semibold active:text-orange-700"
            >
              Change teller
            </button>
          )}
        </div>

        {activeTeller && (
          <p className="text-sm text-gray-500 mb-6">
            Serving:{' '}
            <span className="font-semibold text-gray-900">{activeTeller.name}</span>
          </p>
        )}

        {/* error banner */}
        {submitError && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
            {submitError}
          </div>
        )}

        {/* scan button */}
        <button
          onClick={() => setIsScannerOpen(true)}
          className="w-full flex items-center justify-center gap-3 bg-orange-500 text-white font-semibold py-4 rounded-2xl active:bg-orange-600 text-base mb-6"
        >
          <span className="text-xl">📷</span>
          Scan Barcode
        </button>

        {/* cart */}
        {items.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-gray-400 text-sm">No items yet. Tap Scan Barcode to start.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm px-4">
            {items.map((item) => (
              <CartItem
                key={item.product.id}
                item={item}
                onRemove={removeItem}
                onUpdateQty={updateQty}
              />
            ))}
          </div>
        )}
      </main>

      {/* sticky bottom total + complete button */}
      <CartSummary
        total={total}
        itemCount={items.length}
        onCompleteSale={handleCompleteSale}
        isSubmitting={isSubmitting}
      />

      {/* full-screen scanner overlay */}
      {isScannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />
      )}

      {/* bottom-sheet: unknown barcode → quick-create product */}
      {unknownBarcode && (
        <NewProductModal
          barcode={unknownBarcode}
          onCreated={handleNewProductCreated}
          onDismiss={() => setUnknownBarcode(null)}
        />
      )}
    </>
  )
}
