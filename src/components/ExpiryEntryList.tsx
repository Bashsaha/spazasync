'use client'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

interface ExpiryEntryListProps {
  entries: ExpiryEntry[]
  onChange: (entries: ExpiryEntry[]) => void
  /** The total stock quantity the entries should add up to. */
  totalStockQty: number
}

/**
 * Repeatable expiry date + quantity rows.
 * Used in all product creation flows + stock adjust (add mode).
 */
export function ExpiryEntryList({ entries, onChange, totalStockQty }: ExpiryEntryListProps) {
  const today = new Date().toISOString().split('T')[0]

  const entryTotal = entries.reduce((sum, e) => {
    const n = parseInt(e.quantity, 10)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const remaining = totalStockQty - entryTotal

  function updateEntry(index: number, field: keyof ExpiryEntry, value: string) {
    const updated = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    onChange(updated)
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index))
  }

  function addEntry() {
    onChange([...entries, { expiry_date: '', quantity: '' }])
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">
            {i === 0 && (
              <label className="block text-xs font-medium text-gray-500 mb-1">
                When does it expire?
              </label>
            )}
            <input
              type="date"
              value={entry.expiry_date}
              onChange={(e) => updateEntry(i, 'expiry_date', e.target.value)}
              min={today}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-24">
            {i === 0 && (
              <label className="block text-xs font-medium text-gray-500 mb-1">
                How many?
              </label>
            )}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={entry.quantity}
              onChange={(e) => updateEntry(i, 'quantity', e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => removeEntry(i)}
            className={`text-red-400 active:text-red-600 text-lg font-bold px-1 ${i === 0 ? 'mt-6' : 'mt-1'}`}
            aria-label="Remove this expiry date"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="text-sm font-semibold text-blue-600 active:text-blue-700"
      >
        + Add another expiry date
      </button>

      {/* Summary */}
      {totalStockQty > 0 && entries.length > 0 && (
        <div className="text-xs mt-1">
          {remaining > 0 && (
            <p className="text-gray-400">
              You&apos;ve entered {entryTotal} out of {totalStockQty} units.
              The rest ({remaining}) won&apos;t have an expiry date.
            </p>
          )}
          {remaining === 0 && (
            <p className="text-green-600">
              All {totalStockQty} units have an expiry date.
            </p>
          )}
          {remaining < 0 && (
            <p className="text-red-600">
              You&apos;ve entered more units than the stock amount.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
