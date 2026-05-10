'use client'

import { X } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'

interface ExpiryEntry {
  expiry_date: string
  quantity: string
}

interface ExpiryEntryListProps {
  entries: ExpiryEntry[]
  onChange: (entries: ExpiryEntry[]) => void
  totalStockQty: number
}

export function ExpiryEntryList({ entries, onChange, totalStockQty }: ExpiryEntryListProps) {
  const { t } = useTranslation('expiry')
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
                {t('entry_label_date')}
              </label>
            )}
            <input
              type="date"
              value={entry.expiry_date}
              onChange={(e) => updateEntry(i, 'expiry_date', e.target.value)}
              min={today}
              className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="w-24">
            {i === 0 && (
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {t('entry_label_qty')}
              </label>
            )}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={entry.quantity}
              onChange={(e) => updateEntry(i, 'quantity', e.target.value)}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            type="button"
            onClick={() => removeEntry(i)}
            className={`text-red-400 active:text-red-600 px-1 ${i === 0 ? 'mt-6' : 'mt-1'}`}
            aria-label={t('entry_btn_remove_aria')}
          >
            <X className="w-5 h-5" strokeWidth={2.25} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="text-sm font-semibold text-brand active:text-brand-hover"
      >
        {t('entry_btn_add')}
      </button>

      {totalStockQty > 0 && entries.length > 0 && (
        <div className="text-xs mt-1">
          {remaining > 0 && (
            <p className="text-gray-400">
              {t('entry_summary_remaining', { entered: entryTotal, total: totalStockQty, remaining })}
            </p>
          )}
          {remaining === 0 && (
            <p className="text-green-600">
              {t('entry_summary_all', { total: totalStockQty })}
            </p>
          )}
          {remaining < 0 && (
            <p className="text-red-600">
              {t('entry_summary_over')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
