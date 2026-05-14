'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
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
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {loading && <FullScreenSpinner label={t('btn_creating')} />}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t('add_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        {t('add_desc')}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_name')}</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('placeholder_name')}
            required
            autoComplete="off"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_password')}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder={t('placeholder_password')}
            required
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-xs text-gray-400 mt-1">
            {t('hint_password')}
          </p>
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
