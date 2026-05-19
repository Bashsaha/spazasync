'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, FormField, Input, Select, Callout } from '@/components/ui'
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
  const optionalLabel = `(${t('type_none').toLowerCase()})`

  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      {loading && <FullScreenSpinner label={t('btn_creating')} />}
      <div className="flex items-center gap-2 mb-8">
        <BackButton fallbackHref="/suppliers" />
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('add_desc')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label={t('label_name')}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder_name')}
            required
            maxLength={200}
          />
        </FormField>

        <FormField label={<>{t('label_contact')} <span className="text-gray-400 font-normal">{optionalLabel}</span></>}>
          <Input
            type="tel"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            placeholder={t('placeholder_contact')}
            maxLength={50}
          />
        </FormField>

        <FormField label={<>{t('label_type')} <span className="text-gray-400 font-normal">{optionalLabel}</span></>}>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('type_none')}</option>
            <option value="wholesaler">{t('type_wholesaler')}</option>
            <option value="distributor">{t('type_distributor')}</option>
            <option value="farmer">{t('type_farmer')}</option>
            <option value="other">{t('type_other')}</option>
          </Select>
        </FormField>

        <FormField label={<>{t('label_location')} <span className="text-gray-400 font-normal">{optionalLabel}</span></>}>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('placeholder_location')}
            maxLength={200}
          />
        </FormField>

        {errorMessage && <Callout tone="error">{errorMessage}</Callout>}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
          {loading ? t('btn_creating') : t('btn_create')}
        </Button>
      </form>
    </main>
  )
}
