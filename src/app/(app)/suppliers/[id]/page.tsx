'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Supplier } from '@/types'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useTranslation } from '@/components/LanguageProvider'
import { Spinner } from '@/components/Spinner'
import { emitDataChanged } from '@/lib/events'

export default function EditSupplierPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { t } = useTranslation('suppliers')

  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [name, setName] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [type, setType] = useState('')
  const [location, setLocation] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [message, setMessage] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    fetch(`/api/suppliers/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data: Supplier = await res.json()
        setSupplier(data)
        setName(data.name)
        setContactNumber(data.contact_number ?? '')
        setType(data.type ?? '')
        setLocation(data.location ?? '')
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [params.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    setMessage('')
    setSaving(true)
    try {
      const res = await fetch(`/api/suppliers/${params.id}`, {
        method: 'PATCH',
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
        else setErrorKey('error_save')
        return
      }
      setSupplier(data as Supplier)
      setMessage('msg_saved')
      emitDataChanged()
    } catch {
      setErrorKey('error_generic')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/suppliers/${params.id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        emitDataChanged()
        router.push('/suppliers')
      } else {
        setErrorKey('error_delete')
      }
    } catch {
      setErrorKey('error_generic')
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </main>
    )
  }

  if (!supplier) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-red-500 text-sm">{t('error_load')}</p>
      </main>
    )
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('edit_title')}</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder_name')}
            required
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_contact')}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_type')}</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{t('type_none')}</option>
            <option value="wholesaler">{t('type_wholesaler')}</option>
            <option value="distributor">{t('type_distributor')}</option>
            <option value="farmer">{t('type_farmer')}</option>
            <option value="other">{t('type_other')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_location')}</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('placeholder_location')}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
        {message && <p className="text-green-600 text-sm">{t(message)}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
        >
          {saving ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner size="sm" />
              {t('btn_saving')}
            </span>
          ) : (
            t('btn_save')
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="w-full text-red-500 font-semibold py-3 text-sm active:text-red-700"
        >
          {t('btn_delete')}
        </button>
      </div>

      {showDelete && (
        <ConfirmModal
          message={t('confirm_delete', { name: supplier.name })}
          confirmLabel={t('btn_delete')}
          isDestructive
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </main>
  )
}
