'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'

interface CatalogItem {
  barcode: string
  name: string
  category: string | null
}

export function CatalogImportSheet() {
  const { t } = useTranslation('products')
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/catalog/importable')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setItems(data?.items ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isOpen])

  function close() {
    setIsOpen(false)
    setSearch('')
  }

  function pick(item: CatalogItem) {
    close()
    const params = new URLSearchParams({
      barcode: item.barcode,
      name: item.name,
    })
    router.push(`/products/new?${params.toString()}`)
  }

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.barcode.includes(search),
      )
    : items

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        data-tour="products-import"
        className="w-full text-sm font-semibold text-brand border border-brand bg-white px-4 py-2.5 rounded-full active:bg-brand-light"
      >
        {t('import_btn_open')}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-white w-full rounded-t-2xl px-4 pt-5 pb-8 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('import_sheet_title')}</h2>
              <button
                onClick={close}
                className="text-gray-400 text-sm font-medium active:text-gray-600"
              >
                {t('import_btn_close')}
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('import_search_placeholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand"
            />

            <div className="overflow-y-auto flex-1 -mx-4 px-4">
              {loading ? (
                <p className="text-center text-gray-400 text-sm py-8">{t('import_loading')}</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  {items.length === 0 ? t('import_all_imported') : t('import_no_match')}
                </p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item) => (
                    <button
                      key={item.barcode}
                      onClick={() => pick(item)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-full text-left active:bg-brand-light transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{item.barcode}</p>
                      </div>
                      {item.category && (
                        <span className="text-xs text-gray-400 shrink-0">{item.category}</span>
                      )}
                      <span className="text-brand font-bold text-lg leading-none shrink-0">›</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
