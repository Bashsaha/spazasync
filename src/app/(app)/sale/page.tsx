'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useActiveTeller } from '@/hooks/useActiveTeller'
import { useCart } from '@/hooks/useCart'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useToast } from '@/components/Toast'
import { TellerSelector } from '@/components/sale/TellerSelector'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { CartItem } from '@/components/sale/CartItem'
import { CartSummary } from '@/components/sale/CartSummary'
import { NewProductModal } from '@/components/sale/NewProductModal'
import { ProductPicker } from '@/components/sale/ProductPicker'
import { enqueueSale, getCachedProductByBarcode, getCachedSettings, cacheSettings } from '@/lib/offline/db'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types'

export default function SalePage() {
  const router = useRouter()
  const isOnline = useOnlineStatus()
  const { activeTeller, setActiveTeller, clearActiveTeller, isLoading, role } = useActiveTeller()
  const { items, total, addItem, removeItem, updateQty, clearCart } = useCart()
  const { addToast } = useToast()

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null)
  const [catalogSuggestion, setCatalogSuggestion] = useState<{ barcode: string; name: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Low-stock threshold from shop settings
  const [threshold, setThreshold] = useState(5)

  useEffect(() => {
    // Apply cached settings immediately (offline-first)
    getCachedSettings().then((cached) => {
      if (cached?.low_stock_threshold != null) setThreshold(cached.low_stock_threshold)
    })
    // Then try network for freshest value
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((shop) => {
        if (shop?.low_stock_threshold != null) {
          setThreshold(shop.low_stock_threshold)
          cacheSettings({ key: 'shop', low_stock_threshold: shop.low_stock_threshold, cached_at: new Date().toISOString() })
        }
      })
      .catch(() => {}) // offline: cached or default already applied
  }, [])

  // Show stock warning toast when adding a product
  function showStockToast(product: Product) {
    if (product.stock_qty === 0) {
      addToast('Heads up — this item is out of stock', 'error')
    } else if (product.stock_qty <= threshold) {
      addToast(`Heads up — only ${product.stock_qty} left in stock`, 'info')
    }
  }

  // ── Barcode scan handler ───────────────────────────────────────────────────

  async function handleScan(barcode: string) {
    // The SW caches /api/products responses so this works offline too
    try {
      const res = await fetch(`/api/products?barcode=${encodeURIComponent(barcode)}`)
      if (!res.ok) {
        setCatalogSuggestion(null)
        setUnknownBarcode(barcode)
        return
      }
      const json = await res.json()
      const products = (json.products ?? json) as Product[]
      if (products.length > 0) {
        addItem(products[0])
        showStockToast(products[0])
        return
      }
      // No shop product — check if catalog had a suggestion
      setCatalogSuggestion(json.catalog_suggestion ?? null)
      setUnknownBarcode(barcode)
    } catch {
      // Network failed and SW has no cached match — try IndexedDB product cache
      const cached = await getCachedProductByBarcode(barcode)
      if (cached) {
        addItem(cached)
        showStockToast(cached)
        return
      }
      setCatalogSuggestion(null)
      setUnknownBarcode(barcode)
    }
  }

  function handleNewProductCreated(product: Product) {
    setUnknownBarcode(null)
    setCatalogSuggestion(null)
    addItem(product)
    showStockToast(product)
  }

  function handleProductSelect(product: Product) {
    addItem(product)
    showStockToast(product)
  }

  // ── Queue sale offline (shared by offline path + network error fallback) ──

  async function queueAsOfflineSale() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const shopId = (session?.user.app_metadata?.shop_id as string) ?? ''

    await enqueueSale({
      offline_id: crypto.randomUUID(),
      shop_id: shopId,
      teller_id: activeTeller?.id ?? null,
      total,
      items: items.map((i) => ({
        product_id: i.product.id,
        barcode: i.product.barcode ?? '',
        quantity: i.quantity,
        unit_price: i.product.price,
        subtotal: i.subtotal,
      })),
      queued_at: new Date().toISOString(),
      retry_count: 0,
    })

    window.dispatchEvent(new Event('offlinequeue'))
    clearCart()
    router.push(`/sale/complete?total=${encodeURIComponent(total.toFixed(2))}&offline=1`)
  }

  // ── Complete sale ──────────────────────────────────────────────────────────

  async function handleCompleteSale() {
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      // ── Offline path: queue locally and sync later ─────────────────────────
      if (!isOnline) {
        await queueAsOfflineSale()
        return
      }

      // ── Online path: POST directly ─────────────────────────────────────────
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
      // Network error mid-POST — auto-queue offline instead of showing error
      await queueAsOfflineSale()
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Computed: oversell warning ──────────────────────────────────────────────

  const hasOversellWarning = items.some((i) => i.quantity > i.product.stock_qty)

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
      <main className={`px-4 pt-8 max-w-lg mx-auto ${role !== 'teller' ? 'pb-52' : 'pb-36'}`}>
        {/* header */}
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-gray-900">Sale</h1>
          {role === 'owner' && (
            <button
              onClick={clearActiveTeller}
              className="text-xs text-blue-600 font-semibold active:text-blue-800"
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

        {/* action buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-4 rounded-2xl active:bg-blue-700 text-base"
          >
            <span className="text-lg">📷</span>
            Scan
          </button>
          <button
            onClick={() => setIsPickerOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-blue-600 text-blue-600 font-semibold py-4 rounded-2xl active:bg-blue-50 text-base"
          >
            <span className="text-lg">📋</span>
            Add Manually
          </button>
        </div>

        {/* cart */}
        {items.length === 0 ? (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-gray-400 text-sm">No items yet. Scan a barcode or add manually.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm px-4">
            {items.map((item) => (
              <CartItem
                key={item.product.id}
                item={item}
                onRemove={removeItem}
                onUpdateQty={updateQty}
                threshold={threshold}
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
        aboveNav={role !== 'teller'}
        hasOversellWarning={hasOversellWarning}
      />

      {/* full-screen scanner overlay */}
      {isScannerOpen && (
        <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />
      )}

      {/* manual product picker */}
      {isPickerOpen && (
        <ProductPicker onSelect={handleProductSelect} onClose={() => setIsPickerOpen(false)} />
      )}

      {/* bottom-sheet: unknown barcode → quick-create product */}
      {unknownBarcode && (
        <NewProductModal
          barcode={unknownBarcode}
          suggestedName={catalogSuggestion?.name ?? null}
          onCreated={handleNewProductCreated}
          onDismiss={() => { setUnknownBarcode(null); setCatalogSuggestion(null) }}
        />
      )}
    </>
  )
}
