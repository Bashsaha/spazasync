'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { useToast } from '@/components/Toast'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
import { emitDataChanged } from '@/lib/events'

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TREATMENT_SUGGESTION_KEYS = [
  'treatment_suggestion_spraying',
  'treatment_suggestion_baiting',
  'treatment_suggestion_fumigation',
  'treatment_suggestion_inspection',
  'treatment_suggestion_other',
] as const

export default function NewPestControlVisitPage() {
  const router = useRouter()
  const { t } = useTranslation('waste-pest')
  const { addToast } = useToast()

  const [visitDate, setVisitDate] = useState(todayYmd())
  const [providerName, setProviderName] = useState('')
  const [treatment, setTreatment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!providerName.trim() || !treatment.trim() || !visitDate) return
    setSaving(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/pest-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visit_date: visitDate,
          provider_name: providerName.trim(),
          treatment_type: treatment.trim(),
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        setErrorKey('msg_save_failed')
        return
      }
      emitDataChanged()
      addToast(t('msg_visit_saved'), 'success')
      router.push('/waste-pest/pest')
    } catch {
      setErrorKey('msg_save_failed')
    } finally {
      setSaving(false)
    }
  }

  const canSave = providerName.trim() && treatment.trim() && visitDate && !saving

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {saving && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/waste-pest/pest" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('pest_new_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('pest_new_subtitle')}</p>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            {t('label_visit_date')}
          </label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            max={todayYmd()}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            {t('label_provider')}
          </label>
          <input
            type="text"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder={t('placeholder_provider')}
            maxLength={100}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">
            {t('label_treatment')}
          </label>
          <input
            type="text"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder={t('placeholder_treatment')}
            maxLength={100}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {TREATMENT_SUGGESTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTreatment(t(key))}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-700 active:bg-gray-100"
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-2">{t('label_notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('placeholder_notes')}
            maxLength={500}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {errorKey && <p className="text-red-600 text-sm">{t(errorKey)}</p>}

        <button
          type="submit"
          disabled={!canSave}
          className="w-full bg-brand text-white font-bold py-4 rounded-full active:bg-brand-hover disabled:opacity-50 min-h-[48px]"
        >
          {saving ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner size="sm" />
              {t('btn_saving')}
            </span>
          ) : (
            t('btn_save_visit')
          )}
        </button>
      </form>
    </main>
  )
}
