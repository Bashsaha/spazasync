'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
import type { DailyChecklist, ExpiredItemsAction } from '@/types'
import { emitDataChanged } from '@/lib/events'

interface ExpiringTodayItem {
  product_id: string
  product_name: string
  earliest_expiry: string | null
  expired_qty: number
  expiring_soon_qty: number
}

interface ChecklistResponse {
  date: string
  checklist: DailyChecklist | null
  hasFridge: boolean
  hasFreezer: boolean
  expiringToday: ExpiringTodayItem[]
  previousTemps?: { fridge_temp: number | null; freezer_temp: number | null }
}

type YesNo = true | false | null

function YesNoButtons({
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  value: YesNo
  onChange: (v: YesNo) => void
  yesLabel: string
  noLabel: string
}) {
  const base =
    'flex-1 rounded-xl py-3 text-sm font-semibold border transition-colors active:scale-[0.98]'
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(value === true ? null : true)}
        className={`${base} ${
          value === true
            ? 'bg-green-600 text-white border-green-600'
            : 'bg-white text-gray-700 border-gray-200'
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(value === false ? null : false)}
        className={`${base} ${
          value === false
            ? 'bg-red-600 text-white border-red-600'
            : 'bg-white text-gray-700 border-gray-200'
        }`}
      >
        {noLabel}
      </button>
    </div>
  )
}

export default function ChecklistPage() {
  const router = useRouter()
  const { t, tPlural, locale } = useTranslation('checklist')
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [data, setData] = useState<ChecklistResponse | null>(null)

  const [fridgeOk, setFridgeOk] = useState<YesNo>(null)
  const [fridgeTemp, setFridgeTemp] = useState('')
  const [freezerOk, setFreezerOk] = useState<YesNo>(null)
  const [freezerTemp, setFreezerTemp] = useState('')
  const [surfaces, setSurfaces] = useState<YesNo>(null)
  const [floor, setFloor] = useState<YesNo>(null)
  const [storage, setStorage] = useState<YesNo>(null)
  const [wasteBinsOk, setWasteBinsOk] = useState<YesNo>(null)
  const [expiredAction, setExpiredAction] = useState<ExpiredItemsAction | null>(null)

  useEffect(() => {
    fetch('/api/daily-checklist')
      .then(async (r) => {
        if (!r.ok) throw new Error('load')
        return r.json() as Promise<ChecklistResponse>
      })
      .then((json) => {
        setData(json)
        const c = json.checklist
        if (c) {
          setFridgeOk(c.fridge_ok)
          setFridgeTemp(c.fridge_temp !== null ? String(c.fridge_temp) : '')
          setFreezerOk(c.freezer_ok)
          setFreezerTemp(c.freezer_temp !== null ? String(c.freezer_temp) : '')
          setSurfaces(c.surfaces_cleaned)
          setFloor(c.floor_cleaned)
          setStorage(c.storage_clean)
          setWasteBinsOk(c.waste_bins_ok ?? null)
          setExpiredAction(c.expired_items_action)
        } else if (json.previousTemps) {
          // Pre-fill yesterday's temps so owners with stable fridges don't retype
          if (json.previousTemps.fridge_temp !== null) {
            setFridgeTemp(String(json.previousTemps.fridge_temp))
          }
          if (json.previousTemps.freezer_temp !== null) {
            setFreezerTemp(String(json.previousTemps.freezer_temp))
          }
        }
      })
      .catch(() => setErrorKey('msg_load_failed'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setErrorKey(null)
    try {
      const res = await fetch('/api/daily-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fridge_ok: fridgeOk,
          fridge_temp: fridgeTemp.trim() === '' ? null : Number(fridgeTemp),
          freezer_ok: freezerOk,
          freezer_temp: freezerTemp.trim() === '' ? null : Number(freezerTemp),
          surfaces_cleaned: surfaces,
          floor_cleaned: floor,
          storage_clean: storage,
          waste_bins_ok: wasteBinsOk,
          expired_items_action: expiredAction,
        }),
      })
      if (!res.ok) {
        setErrorKey('msg_save_failed')
        return
      }
      const saved = (await res.json()) as DailyChecklist
      setData((prev) => (prev ? { ...prev, checklist: saved } : prev))
      emitDataChanged()
      addToast(t('msg_saved'), 'success')
      // Re-run the (app) layout's server component so the pulsing
      // ChecklistReminderFab disappears now that today's checklist is done.
      router.refresh()
      router.push('/dashboard')
    } catch {
      setErrorKey('msg_save_failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </main>
    )
  }

  if (errorKey && !data) {
    return (
      <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
        <div className="mb-6">
          <BackButton fallbackHref="/manage" />
        </div>
        <p className="text-red-600">{t(errorKey)}</p>
      </main>
    )
  }

  const localeTag = locale === 'en' ? 'en-ZA' : locale
  const dateLabel = data
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString(localeTag, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : ''

  const expiringCount = data?.expiringToday.length ?? 0

  return (
    <main className="px-4 pt-10 pb-40 max-w-lg mx-auto">
      {saving && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="mb-2">
        <BackButton fallbackHref="/manage" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="text-sm text-gray-500 mb-1">{t('subtitle')}</p>
      <p className="text-xs text-gray-400 mb-6">{t('date_today', { date: dateLabel })}</p>

      {/* Temperature section */}
      {(data?.hasFridge || data?.hasFreezer) && (
        <section className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">{t('section_temps')}</h2>

          {data?.hasFridge && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-800">{t('q_fridge')}</p>
              <p className="text-xs text-gray-400 mb-2">{t('q_fridge_hint')}</p>
              <YesNoButtons
                value={fridgeOk}
                onChange={setFridgeOk}
                yesLabel={t('opt_yes')}
                noLabel={t('opt_no')}
              />
              <label className="block text-xs text-gray-500 mt-3 mb-1">
                {t('label_temp')}{' '}
                <span className="text-gray-400 font-normal">({t('temp_optional')})</span>
              </label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={fridgeTemp}
                onChange={(e) => setFridgeTemp(e.target.value)}
                placeholder={t('placeholder_temp')}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}

          {data?.hasFreezer && (
            <div className={data?.hasFridge ? 'pt-4 border-t border-gray-100' : ''}>
              <p className="text-sm font-medium text-gray-800">{t('q_freezer')}</p>
              <p className="text-xs text-gray-400 mb-2">{t('q_freezer_hint')}</p>
              <YesNoButtons
                value={freezerOk}
                onChange={setFreezerOk}
                yesLabel={t('opt_yes')}
                noLabel={t('opt_no')}
              />
              <label className="block text-xs text-gray-500 mt-3 mb-1">
                {t('label_temp')}{' '}
                <span className="text-gray-400 font-normal">({t('temp_optional')})</span>
              </label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={freezerTemp}
                onChange={(e) => setFreezerTemp(e.target.value)}
                placeholder={t('placeholder_freezer_temp')}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          )}
        </section>
      )}

      {/* Cleaning section */}
      <section className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">{t('section_cleaning')}</h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">{t('q_surfaces')}</p>
            <YesNoButtons
              value={surfaces}
              onChange={setSurfaces}
              yesLabel={t('opt_yes')}
              noLabel={t('opt_no')}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">{t('q_floor')}</p>
            <YesNoButtons
              value={floor}
              onChange={setFloor}
              yesLabel={t('opt_yes')}
              noLabel={t('opt_no')}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800 mb-2">{t('q_storage')}</p>
            <YesNoButtons
              value={storage}
              onChange={setStorage}
              yesLabel={t('opt_yes')}
              noLabel={t('opt_no')}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{t('q_waste_bins')}</p>
            <p className="text-xs text-gray-400 mb-2">{t('q_waste_bins_hint')}</p>
            <YesNoButtons
              value={wasteBinsOk}
              onChange={setWasteBinsOk}
              yesLabel={t('opt_yes')}
              noLabel={t('opt_no')}
            />
          </div>
        </div>
      </section>

      {/* Expired items section */}
      <section className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">{t('section_expired')}</h2>
        <p className="text-sm font-medium text-gray-800 mb-2">{t('q_expired')}</p>

        {expiringCount > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">
              {tPlural('expired_hint', expiringCount, { count: expiringCount })}
            </p>
            <ul className="text-xs text-amber-700 space-y-1">
              {data!.expiringToday.slice(0, 5).map((e) => (
                <li key={e.product_id}>
                  {t('expired_list_item', {
                    name: e.product_name,
                    date: e.earliest_expiry ?? '—',
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {(['none_found', 'removed', 'skipped'] as ExpiredItemsAction[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setExpiredAction(expiredAction === opt ? null : opt)}
              className={`rounded-full py-3 text-sm font-semibold border transition-colors ${
                expiredAction === opt
                  ? opt === 'removed'
                    ? 'bg-green-600 text-white border-green-600'
                    : opt === 'none_found'
                    ? 'bg-brand text-white border-brand'
                    : 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {t(`opt_${opt}`)}
            </button>
          ))}
        </div>
      </section>

      {errorKey && <p className="text-red-600 text-sm mb-4">{t(errorKey)}</p>}

      <a
        href="/checklist/history"
        className="block text-center text-sm text-brand mb-4"
      >
        {t('history_link')} →
      </a>

      {/* Sticky save button */}
      <div
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-3 z-40"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px) + 56px)' }}
      >
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-brand text-white font-bold py-4 rounded-full active:bg-brand-hover disabled:opacity-50 min-h-[48px]"
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
        </div>
      </div>
    </main>
  )
}
