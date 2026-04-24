'use client'

import { useState } from 'react'
import type { Supplier } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { emitDataChanged } from '@/lib/events'

interface NewSupplierModalProps {
  onCreated: (supplier: Supplier) => void
  onDismiss: () => void
}

export function NewSupplierModal({ onCreated, onDismiss }: NewSupplierModalProps) {
  const { t } = useTranslation('suppliers')
  const { t: tCommon } = useTranslation('common')
  const [name, setName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact_number: contactNumber.trim() || null,
          type: type || null,
          location: location.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setErrorKey('error_duplicate')
        else if (data.error) setErrorRaw(data.error)
        else setErrorKey('error_create')
        return
      }
      emitDataChanged()
      onCreated(data as Supplier)
    } catch {
      setErrorKey('error_generic')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
      <div className="bg-white w-full rounded-t-2xl px-6 pt-6 pb-10 max-h-[85vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-0.5">{t('add_title')}</h2>
        <p className="text-sm text-gray-500 mb-5">{t('add_desc')}</p>

        {errorMessage && (
          <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{errorMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('placeholder_name')}
              autoFocus
              required
              maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_contact')} <span className="text-gray-400 font-normal">({t('type_none').toLowerCase()})</span>
            </label>
            <input
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder={t('placeholder_contact')}
              maxLength={50}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_type')} <span className="text-gray-400 font-normal">({t('type_none').toLowerCase()})</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('type_none')}</option>
              <option value="wholesaler">{t('type_wholesaler')}</option>
              <option value="distributor">{t('type_distributor')}</option>
              <option value="farmer">{t('type_farmer')}</option>
              <option value="other">{t('type_other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_location')} <span className="text-gray-400 font-normal">({t('type_none').toLowerCase()})</span>
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('placeholder_location')}
              maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-medium active:bg-gray-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold active:bg-blue-700 disabled:opacity-50"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {loading ? t('btn_creating') : t('btn_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
