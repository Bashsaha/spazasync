'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface CatalogItem {
  barcode: string
  name: string
  category: string | null
}

export function CatalogImportSheet() {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const router = useRouter()

  // Load importable items when sheet opens
  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setResult(null)
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
    setSelected(new Set())
    setResult(null)
  }

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.barcode.includes(search),
      )
    : items

  function toggle(barcode: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(barcode)) next.delete(barcode)
      else next.add(barcode)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map((i) => i.barcode)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleImport() {
    if (selected.size === 0 || importing) return
    setImporting(true)

    const toImport = items
      .filter((i) => selected.has(i.barcode))
      .map(({ barcode, name }) => ({ barcode, name }))

    try {
      const res = await fetch('/api/products/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: toImport }),
      })
      const json = await res.json()

      if (!res.ok) {
        setImporting(false)
        return
      }

      setResult(json)
      setSelected(new Set())
      router.refresh()

      // Reload the importable list (imported items now in shop, so they disappear)
      const refreshed = await fetch('/api/catalog/importable')
      if (refreshed.ok) {
        const data = await refreshed.json()
        setItems(data?.items ?? [])
      }
    } catch {
      // silently ignore network errors — user can retry
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-semibold text-blue-600 border border-blue-300 px-3 py-2 rounded-xl active:bg-blue-50"
      >
        Import from catalog
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="bg-white w-full rounded-t-2xl px-4 pt-5 pb-8 max-h-[85vh] flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Import from catalog</h2>
              <button
                onClick={close}
                className="text-gray-400 text-sm font-medium active:text-gray-600"
              >
                Close
              </button>
            </div>

            {/* success banner */}
            {result && (
              <div className="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 mb-3">
                ✓ {result.imported} product{result.imported !== 1 ? 's' : ''} added.
                {result.skipped > 0 ? ` ${result.skipped} already in your shop.` : ''}
                {' '}Go to each product to set the correct price.
              </div>
            )}

            {/* search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or barcode…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* select all / clear row */}
            {!loading && filtered.length > 0 && (
              <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
                <button
                  onClick={selectAll}
                  className="text-blue-600 font-medium active:opacity-70"
                >
                  Select all
                </button>
                {selected.size > 0 && (
                  <button onClick={clearAll} className="active:opacity-70">
                    Clear
                  </button>
                )}
                <span className="ml-auto">{selected.size} selected</span>
              </div>
            )}

            {/* list */}
            <div className="overflow-y-auto flex-1 -mx-4 px-4">
              {loading ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  Loading catalog…
                </p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">
                  {items.length === 0
                    ? 'All catalog products are already in your shop.'
                    : 'No products match that search.'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item) => {
                    const checked = selected.has(item.barcode)
                    return (
                      <button
                        key={item.barcode}
                        onClick={() => toggle(item.barcode)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:bg-gray-100 transition-colors ${
                          checked ? 'bg-blue-50' : 'bg-white'
                        }`}
                      >
                        {/* checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            checked
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {checked && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            {item.barcode}
                          </p>
                        </div>

                        {item.category && (
                          <span className="text-xs text-gray-400 shrink-0">
                            {item.category}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* import button */}
            {selected.size > 0 && (
              <div className="pt-3 border-t border-gray-100 mt-2">
                <p className="text-xs text-gray-400 mb-2">
                  Products are added with R0.00 price and 0 stock. Tap each product
                  afterwards to set the correct price.
                </p>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50"
                >
                  {importing
                    ? 'Importing…'
                    : `Import ${selected.size} product${selected.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
