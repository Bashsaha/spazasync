'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ExpiryProductDetail, BatchDetail } from '@/types'

type UrgencyGroup = 'expired' | 'expiring_soon' | 'ok'

const groupConfig: Record<UrgencyGroup, { label: string; bg: string; border: string; text: string; badge: string }> = {
  expired: {
    label: 'Expired',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
  },
  expiring_soon: {
    label: 'Expiring soon',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  ok: {
    label: 'OK',
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-700',
  },
}

function formatExpiryLabel(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr + 'T00:00:00')
  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
  if (diffDays === -1) return 'Yesterday'
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`
  if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7)
    return `In ${weeks} week${weeks !== 1 ? 's' : ''}`
  }
  // Show the date for anything further out
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function BatchRow({ batch }: { batch: BatchDetail }) {
  const statusColors: Record<string, string> = {
    expired: 'text-red-600',
    expiring_soon: 'text-amber-600',
    ok: 'text-green-600',
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 text-sm">
      <div>
        <span className={`font-medium ${statusColors[batch.status]}`}>
          {formatExpiryLabel(batch.expiry_date)}
        </span>
        <span className="text-gray-400 ml-2 text-xs">
          {batch.expiry_date}
        </span>
      </div>
      <span className="text-gray-700 font-semibold">{batch.quantity} units</span>
    </div>
  )
}

function ProductCard({ product }: { product: ExpiryProductDetail }) {
  const [expanded, setExpanded] = useState(false)
  const config = groupConfig[product.urgency]

  const totalBatchQty = product.batches.reduce((sum, b) => sum + b.quantity, 0)

  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50"
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{product.product_name}</p>
          {product.barcode && (
            <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${config.badge}`}>
            {totalBatchQty} tracked
          </span>
          <span className="text-gray-300 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {product.batches.map((batch) => (
              <BatchRow key={batch.id} batch={batch} />
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Total stock: {product.stock_qty} units
            </span>
            <Link
              href={`/stock/${product.product_id}`}
              className="text-xs text-blue-600 font-semibold active:text-blue-700"
            >
              Adjust stock →
            </Link>
          </div>
        </div>
      )}
    </li>
  )
}

function UrgencySection({
  urgency,
  products,
}: {
  urgency: UrgencyGroup
  products: ExpiryProductDetail[]
}) {
  const [collapsed, setCollapsed] = useState(false)
  const config = groupConfig[urgency]

  if (products.length === 0) return null

  return (
    <section className="mb-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between ${config.bg} ${config.border} border rounded-xl px-4 py-3 mb-2`}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${config.text}`}>{config.label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${config.badge}`}>
            {products.length}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <ul className="space-y-2">
          {products.map((p) => (
            <ProductCard key={p.product_id} product={p} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function ExpiryPage() {
  const [products, setProducts] = useState<ExpiryProductDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/stock/expiry')
      .then((r) => r.json())
      .then((data: { products: ExpiryProductDetail[] }) => {
        setProducts(data.products ?? [])
        setLoading(false)
      })
      .catch(() => {
        setError('Could not load expiry data. Please try again.')
        setLoading(false)
      })
  }, [])

  const expired = products.filter((p) => p.urgency === 'expired')
  const expiringSoon = products.filter((p) => p.urgency === 'expiring_soon')
  const ok = products.filter((p) => p.urgency === 'ok')

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-gray-400 active:text-gray-600 text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Expiry Dates</h1>
      </div>

      {/* Summary strip */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div
            className={`rounded-2xl p-3 border text-center shadow-sm ${
              expired.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${expired.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {expired.length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Expired</p>
          </div>
          <div
            className={`rounded-2xl p-3 border text-center shadow-sm ${
              expiringSoon.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xl font-bold ${expiringSoon.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
              {expiringSoon.length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Soon</p>
          </div>
          <div className="bg-white border-gray-100 rounded-2xl p-3 border text-center shadow-sm">
            <p className="text-xl font-bold text-green-600">{ok.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">OK</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <p className="text-center text-gray-400 text-sm mt-12">Loading expiry dates…</p>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4 mb-4">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center mt-16">
          <p className="text-gray-400 text-sm">No products with expiry dates tracked yet.</p>
          <p className="text-gray-400 text-xs mt-2">
            Add expiry dates when you receive new stock.
          </p>
        </div>
      )}

      {/* Grouped sections */}
      {!loading && !error && products.length > 0 && (
        <>
          <UrgencySection urgency="expired" products={expired} />
          <UrgencySection urgency="expiring_soon" products={expiringSoon} />
          <UrgencySection urgency="ok" products={ok} />
        </>
      )}
    </main>
  )
}
