'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { BackButton } from '@/components/BackButton'
import { Skeleton } from '@/components/Skeleton'
import { useTranslation } from '@/components/LanguageProvider'
import { useCachedData } from '@/hooks/useCachedData'
import { useToast } from '@/components/Toast'
import { emitDataChanged } from '@/lib/events'
import { formatZAR } from '@/lib/utils/currency'
import type { Product, Supplier } from '@/types'

const EMPTY_PRODUCTS: Product[] = []
const EMPTY_SUPPLIERS: Supplier[] = []

/**
 * Bulk-assign supplier flow — clears the "products without supplier" backlog
 * in one go. Owner picks one supplier from a dropdown, ticks the products to
 * assign, taps "Assign to N products". Calls PATCH /api/products/bulk-supplier.
 */
export default function AssignSupplierPage() {
  const router = useRouter()
  const { t, tPlural } = useTranslation('suppliers')
  const { addToast } = useToast()

  const [supplierId, setSupplierId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Cache-first (Phase 44b): the missing-supplier product list + supplier
  // dropdown paint instantly; selection state stays local. A successful assign
  // emitDataChanged()s, so this (and the products pages) refetch.
  const { data, loading } = useCachedData<{ products: Product[]; suppliers: Supplier[] }>(
    'suppliers-assign',
    async () => {
      const [pRes, sRes] = await Promise.all([
        fetch('/api/products?missing_supplier=1', { cache: 'no-store' }),
        fetch('/api/suppliers', { cache: 'no-store' }),
      ])
      const pData = pRes.ok ? await pRes.json() : { products: [] }
      const sData = sRes.ok ? await sRes.json() : []
      return {
        products: (pData.products ?? []) as Product[],
        suppliers: Array.isArray(sData) ? (sData as Supplier[]) : [],
      }
    },
  )
  const products = data?.products ?? EMPTY_PRODUCTS
  const suppliers = data?.suppliers ?? EMPTY_SUPPLIERS

  const allSelected = useMemo(
    () => products.length > 0 && selected.size === products.length,
    [products, selected],
  )

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map((p) => p.id)))
    }
  }

  async function handleAssign() {
    if (!supplierId || selected.size === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/products/bulk-supplier', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_ids: Array.from(selected),
          supplier_id: supplierId,
        }),
      })
      if (!res.ok) {
        addToast(t('assign_error'), 'error')
        return
      }
      const data = (await res.json()) as { updated: number }
      addToast(tPlural('assign_success', data.updated, { count: data.updated }), 'success')
      emitDataChanged()
      router.push('/suppliers')
    } catch {
      addToast(t('assign_error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // Empty state — zero products without supplier (everything's already covered)
  const noWork = !loading && products.length === 0
  const noSuppliers = !loading && suppliers.length === 0

  return (
    <main className="px-4 pt-10 pb-60 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <BackButton fallbackHref="/suppliers" />
        <h1 className="text-2xl font-bold text-gray-900">{t('assign_title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">{t('assign_hint')}</p>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : noSuppliers ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-600 mb-3">{t('assign_no_suppliers')}</p>
          <button
            type="button"
            onClick={() => router.push('/suppliers/new')}
            className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-full active:bg-brand-hover"
          >
            {t('btn_add')}
          </button>
        </div>
      ) : noWork ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-600">{t('assign_empty')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              {tPlural('assign_count', products.length, { count: products.length })}
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-semibold text-brand active:text-brand-hover"
            >
              {allSelected ? t('assign_clear_all') : t('assign_select_all')}
            </button>
          </div>

          <ul className="space-y-2">
            {products.map((p) => {
              const isOn = selected.has(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggleOne(p.id)}
                    className={`w-full flex items-center gap-3 bg-white rounded-2xl p-3 border text-left active:bg-gray-50 ${
                      isOn ? 'border-brand' : 'border-gray-100'
                    }`}
                    aria-pressed={isOn}
                  >
                    <span
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        isOn ? 'border-brand bg-brand' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isOn && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatZAR(p.price)}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {!loading && !noWork && !noSuppliers && (
        <div
          className="fixed inset-x-0 bg-white border-t border-gray-200 px-4 pt-3"
          style={{
            bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
            paddingBottom: '12px',
            zIndex: 35,
          }}
        >
          <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto space-y-2">
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
            >
              <option value="">{t('assign_pick_supplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={saving || !supplierId || selected.size === 0}
              className="w-full bg-brand text-white font-bold py-3 rounded-full active:bg-brand-hover disabled:opacity-50 min-h-[48px]"
            >
              {saving
                ? t('assign_saving')
                : tPlural('assign_action', selected.size, { count: selected.size })}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
