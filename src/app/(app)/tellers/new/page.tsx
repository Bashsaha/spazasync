'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, FormField, Input, Callout } from '@/components/ui'
import { emitDataChanged } from '@/lib/events'

export default function NewTellerPage() {
  const router = useRouter()
  const { t } = useTranslation('tellers')
  const [form, setForm] = useState({ name: '', password: '' })
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    setLoading(true)
    try {
      const res = await fetch('/api/tellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error) setErrorRaw(data.error)
        else setErrorKey('error_create')
        return
      }
      emitDataChanged()
      router.push('/tellers')
    } catch {
      setErrorKey('error_network')
    } finally {
      setLoading(false)
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      {loading && <FullScreenSpinner label={t('btn_creating')} />}
      <div className="flex items-center gap-2 mb-8">
        <BackButton fallbackHref="/tellers" />
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('add_desc')}</p>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <FormField label={t('label_name')}>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('placeholder_name')}
            required
            autoComplete="off"
          />
        </FormField>

        <FormField label={t('label_pin')} hint={t('hint_pin')}>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value.replace(/\D/g, '').slice(0, 6) }))
            }
            placeholder={t('placeholder_pin')}
            required
            autoComplete="off"
            className="text-lg tracking-[0.4em]"
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
