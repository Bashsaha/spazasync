'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
import { emitDataChanged } from '@/lib/events'

export default function NewSupplierPage() {
  const router = useRouter()
  const { t } = useTranslation('suppliers')
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
      router.push('/suppliers')
    } catch {
      setErrorKey('error_generic')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {loading && <FullScreenSpinner label={t('btn_creating')} />}
      <div className="flex items-center gap-2 mb-8">
        <BackButton fallbackHref="/suppliers" />
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('add_desc')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder_name')}
            required
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_type')} <span className="text-gray-400 font-normal">({t('type_none').toLowerCase()})</span>
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
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
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white font-bold py-4 rounded-full active:bg-brand-hover disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner size="sm" />
              {t('btn_creating')}
            </span>
          ) : (
            t('btn_create')
          )}
        </button>
      </form>
    </main>
  )
}
