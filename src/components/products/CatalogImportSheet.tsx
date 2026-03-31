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
  const [prices, setPrices] = useState<Map<string, string>>(new Map())
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
    setPrices(new Map())
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
      if (next.has(barcode)) {
        next.delete(barcode)
        setPrices((p) => { const m = new Map(p); m.delete(barcode); return m })
      } else {
        next.add(barcode)
      }
      return next
    })
  }

  function setPrice(barcode: string, value: string) {
    setPrices((prev) => new Map(prev).set(barcode, value))
  }

  function selectAll() {
    setSelected(new Set(filtered.map((i) => i.barcode)))
  }

  function clearAll() {
    setSelected(new Set())
  }

  // All selected items must have a valid price > 0
  const allPriced = selected.size > 0 && [...selected].every((b) => {
    const v = parseFloat(prices.get(b) ?? '')
    return !isNaN(v) && v > 0
  })

  async function handleImport() {
    if (!allPriced || importing) return
    setImporting(true)

    const toImport = items
      .filter((i) => selected.has(i.barcode))
      .map(({ barcode, name }) => ({
        barcode,
        name,
        price: parseFloat(prices.get(barcode) ?? '0'),
      }))

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
      setPrices(new Map())
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
                ✓ {result.imported} product{result.imported !== 1 ? 's' : ''} added with prices set.
                {result.skipped > 0 ? ` ${result.skipped} already in your shop.` : ''}
                {' '}Go to Stock to add quantities when you&apos;re ready.
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
                      <div key={item.barcode}>
                        <button
                          onClick={() => toggle(item.barcode)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left active:bg-gray-100 transition-colors ${
                            checked ? 'bg-blue-50 rounded-b-none' : 'bg-white'
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

                        {/* price input — visible when selected */}
                        {checked && (
                          <div className="bg-blue-50 px-3 pb-3 pt-1 rounded-b-xl flex items-center gap-2 ml-8">
                            <span className="text-sm text-gray-500 font-medium">R</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0.01"
                              step="0.01"
                              placeholder="Selling price"
                              value={prices.get(item.barcode) ?? ''}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setPrice(item.barcode, e.target.value)}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* import button */}
            {selected.size > 0 && (
              <div className="pt-3 border-t border-gray-100 mt-2">
                {!allPriced && (
                  <p className="text-xs text-amber-600 mb-2">
                    Set a selling price for every selected product before importing.
                  </p>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing || !allPriced}
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
