'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import { useToast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
import type { WasteManagement, WasteFrequency, WasteRemovalType } from '@/types'
import { emitDataChanged } from '@/lib/events'

const REMOVAL_TYPES: WasteRemovalType[] = ['municipal', 'private', 'self_disposal']
const FREQUENCIES: WasteFrequency[] = ['daily', 'weekly', 'twice_weekly', 'monthly', 'other']
const STALE_DAYS = 30

function daysBetween(iso: string | null, today: string): number | null {
  if (!iso) return null
  const a = Date.parse(`${iso}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)))
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function WasteManagementPage() {
  const { t, locale } = useTranslation('waste-pest')
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [waste, setWaste] = useState<WasteManagement | null>(null)

  const [removalType, setRemovalType] = useState<WasteRemovalType | null>(null)
  const [frequency, setFrequency] = useState<WasteFrequency | null>(null)
  const [providerName, setProviderName] = useState('')

  useEffect(() => {
    fetch('/api/waste-management')
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const json = (await r.json()) as { waste: WasteManagement | null }
        if (json.waste) {
          setWaste(json.waste)
          setRemovalType(json.waste.removal_type)
          setFrequency(json.waste.frequency)
          setProviderName(json.waste.provider_name ?? '')
        }
      })
      .catch(() => setErrorKey('msg_load_failed'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!removalType || !frequency) return
    setSaving(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/waste-management', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removal_type: removalType,
          frequency,
          provider_name: providerName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        setErrorKey('msg_save_failed')
        return
      }
      const updated = (await res.json()) as WasteManagement
      setWaste(updated)
      emitDataChanged()
      addToast(t('msg_waste_saved'), 'success')
    } catch {
      setErrorKey('msg_save_failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await fetch('/api/waste-management/confirm', { method: 'POST' })
      if (!res.ok) throw new Error()
      const updated = (await res.json()) as WasteManagement
      setWaste(updated)
      emitDataChanged()
      addToast(t('msg_confirmed'), 'success')
    } catch {
      addToast(t('error_generic'), 'error')
    } finally {
      setConfirming(false)
    }
  }

  const today = todayYmd()
  const confirmDays = daysBetween(waste?.last_confirmed_date ?? null, today)
  const isStale =
    !waste?.last_confirmed_date ||
    (confirmDays !== null && confirmDays >= STALE_DAYS)

  const localeTag = locale === 'en' ? 'en-ZA' : locale
  const lastConfirmedLabel = waste?.last_confirmed_date
    ? new Date(`${waste.last_confirmed_date}T00:00:00`).toLocaleDateString(localeTag, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const canSave = removalType && frequency && !saving

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {saving && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/waste-pest" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('waste_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('waste_subtitle')}</p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4"
          >
            <h2 className="font-semibold text-gray-900 mb-4">{t('section_arrangement')}</h2>

            <div className="mb-5">
              <p className="text-sm font-medium text-gray-800 mb-2">{t('label_removal_type')}</p>
              <div className="space-y-2">
                {REMOVAL_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRemovalType(type)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium ${
                      removalType === type
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {t(`removal_${type}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-gray-800 mb-2">{t('label_frequency')}</p>
              <div className="grid grid-cols-2 gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium ${
                      frequency === f
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {t(`frequency_${f}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-800 mb-2">
                {t('label_waste_provider')}
              </label>
              <input
                type="text"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder={t('placeholder_waste_provider')}
                maxLength={100}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {errorKey && <p className="text-red-600 text-sm mb-4">{t(errorKey)}</p>}

            <button
              type="submit"
              disabled={!canSave}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  {t('btn_saving')}
                </span>
              ) : (
                t('btn_save_waste')
              )}
            </button>
          </form>

          {waste && (
            <div
              className={`rounded-2xl p-4 border ${
                isStale ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
              }`}
            >
              <h2 className="font-semibold text-gray-900 mb-1">{t('section_confirm')}</h2>
              {!waste.last_confirmed_date ? (
                <p className="text-sm text-gray-500 mb-3">{t('confirm_never')}</p>
              ) : (
                <p className={`text-sm mb-1 ${isStale ? 'text-amber-800' : 'text-gray-600'}`}>
                  {t('confirm_last', { date: lastConfirmedLabel ?? '' })}
                </p>
              )}
              {isStale && waste.last_confirmed_date && confirmDays !== null && (
                <p className="text-xs text-amber-700 mb-3">
                  {t('confirm_stale_warning', { days: String(confirmDays) })}
                </p>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className={`w-full font-bold py-3 rounded-2xl min-h-[44px] disabled:opacity-50 ${
                  isStale
                    ? 'bg-amber-500 text-white active:bg-amber-600'
                    : 'bg-green-600 text-white active:bg-green-700'
                }`}
              >
                {confirming ? t('btn_confirming') : t('btn_confirm')}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
