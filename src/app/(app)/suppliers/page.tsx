'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Supplier } from '@/types'
import { Tag } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { BackButton } from '@/components/BackButton'
import { useTranslation } from '@/components/LanguageProvider'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

export default function SuppliersPage() {
  const { t } = useTranslation('suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState('')
  const [missingSupplierCount, setMissingSupplierCount] = useState(0)

  const loadSuppliers = useCallback(() => {
    fetch('/api/suppliers', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        setSuppliers(await res.json())
        setErrorKey('')
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
    fetch('/api/settings', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setMissingSupplierCount(data.products_missing_supplier ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  useRefetchOnVisible(loadSuppliers)

  const typeLabel = (type: string | null) => {
    if (!type) return t('type_none')
    return t(`type_${type}`)
  }

  return (
    <main className="px-4 pt-10 pb-36 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/profile" />
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        </div>
        <Link
          href="/suppliers/new"
          className="bg-brand text-white text-sm font-semibold px-4 py-2 rounded-full active:bg-brand-hover"
        >
          {t('btn_add')}
        </Link>
      </div>

      {errorKey && <p className="text-red-500 text-sm mb-4">{t(errorKey)}</p>}

      {!loading && suppliers.length > 0 && missingSupplierCount > 0 && (
        <Link
          href="/suppliers/assign"
          className="flex items-center gap-3 bg-brand-light border border-brand/30 rounded-2xl p-4 mb-4 active:bg-brand-light/70"
        >
          <span className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" strokeWidth={2.25} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-brand-dark">
              {t('assign_card_title', { count: missingSupplierCount })}
            </p>
            <p className="text-xs text-brand-dark/80 mt-0.5">{t('assign_card_desc')}</p>
          </div>
          <span className="text-brand-dark text-lg">&rsaquo;</span>
        </Link>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">{t('empty')}</p>
          <p className="text-gray-300 text-xs mt-1">{t('empty_hint')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Link
                href={`/suppliers/${s.id}`}
                className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{typeLabel(s.type)}</span>
                    {s.contact_number && (
                      <span className="text-xs text-gray-300">{s.contact_number}</span>
                    )}
                  </div>
                  {s.location && (
                    <p className="text-xs text-gray-300 mt-0.5 truncate">{s.location}</p>
                  )}
                </div>
                <span className="text-gray-300 text-lg ml-2">&rsaquo;</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
