'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import type { SupportedLocale } from '@/lib/i18n/types'

interface ShopSettings {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  low_stock_threshold: number
  registration_number: string | null
  location: string | null
  language: string | null
  profit_tracking_enabled: boolean
  products_missing_cost: number
  subscription_status: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

export default function SettingsPage() {
  const { t, tPlural, locale, setLocale } = useTranslation('settings')
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState(5)
  const [regNumber, setRegNumber] = useState('')
  const [location, setLocation] = useState('')
  const [language, setLanguage] = useState<SupportedLocale>(locale)
  const [profitTracking, setProfitTracking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; key?: string; raw?: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: ShopSettings) => {
        setSettings(data)
        setName(data.name)
        setThreshold(data.low_stock_threshold)
        setRegNumber(data.registration_number ?? '')
        setLocation(data.location ?? '')
        setProfitTracking(Boolean(data.profit_tracking_enabled))
        if (data.language) setLanguage(data.language as SupportedLocale)
      })
      .catch(() => setMessage({ type: 'err', key: 'msg_load_failed' }))
      .finally(() => setLoading(false))
  }, [])

  // Re-fetch missing cost count when user returns from editing products
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data: ShopSettings) => {
          setSettings((prev) => prev ? { ...prev, products_missing_cost: data.products_missing_cost } : prev)
          setProfitTracking(Boolean(data.profit_tracking_enabled))
        })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function handleProfitToggle(nextValue: boolean) {
    setProfitTracking(nextValue)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || settings?.name,
        low_stock_threshold: threshold,
        registration_number: regNumber.trim() || null,
        location: location.trim() || null,
        language,
        profit_tracking_enabled: nextValue,
      }),
    })
    if (res.ok) {
      const updated: ShopSettings = await res.json()
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated))
    } else {
      setProfitTracking(!nextValue) // revert on failure
      setMessage({ type: 'err', key: 'msg_save_failed' })
    }
  }

  async function handleLanguageChange(newLang: SupportedLocale) {
    setLanguage(newLang)
    setLocale(newLang)

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || settings?.name,
        low_stock_threshold: threshold,
        registration_number: regNumber.trim() || null,
        location: location.trim() || null,
        language: newLang,
      }),
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        low_stock_threshold: threshold,
        registration_number: regNumber.trim() || null,
        location: location.trim() || null,
        language,
        profit_tracking_enabled: profitTracking,
      }),
    })

    setSaving(false)

    if (res.ok) {
      const updated: ShopSettings = await res.json()
      setSettings(updated)
      setMessage({ type: 'ok', key: 'msg_saved' })
    } else {
      const err = await res.json().catch(() => ({}))
      const raw = (err as { error?: string }).error
      setMessage({ type: 'err', key: raw ? undefined : 'msg_save_failed', raw })
    }
  }

  async function handleDownloadReport() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/compliance-pdf')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const raw = (err as { error?: string }).error
        setMessage({ type: 'err', key: raw ? undefined : 'msg_report_failed', raw })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'compliance-report.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setMessage({ type: 'err', key: 'msg_download_failed' })
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </main>
    )
  }

  const messageText = message?.raw || (message?.key ? t(message.key) : '')

  const statusLabel = (status: string): string => {
    switch (status) {
      case 'trialing': return t('sub_free_trial')
      case 'active': return t('sub_active')
      case 'cancelled': return t('sub_cancelled')
      default: return t('sub_expired')
    }
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <a href="/dashboard" className="text-sm text-blue-600 mb-6 inline-block">
        {t('back')}
      </a>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('title')}</h1>
      <p className="text-sm text-gray-400 mb-6">{t('subtitle')}</p>

      {/* Compliance report */}
      <div id="compliance" className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-bold text-indigo-900">{t('compliance_title')}</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              {t('compliance_desc')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={downloading}
          className="w-full bg-indigo-600 text-white font-semibold rounded-xl py-3 text-sm active:bg-indigo-700 disabled:opacity-50"
        >
          {downloading ? t('btn_generating_report') : t('btn_download_report')}
        </button>
      </div>

      {/* Language */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">{t('language_title')}</p>
        <LanguagePicker value={language} onChange={handleLanguageChange} variant="compact" />
      </div>

      {/* Profit tracking toggle */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">💰</span>
              <p className="font-semibold text-gray-900">{t('profit_tracking_title')}</p>
            </div>
            <p className="text-sm text-gray-500">{t('profit_tracking_desc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profitTracking}
            aria-label={profitTracking ? t('profit_tracking_on') : t('profit_tracking_off')}
            onClick={() => handleProfitToggle(!profitTracking)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              profitTracking ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                profitTracking ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {profitTracking && (settings?.products_missing_cost ?? 0) > 0 && (
          <a
            href="/products"
            className="mt-3 block bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm text-amber-800"
          >
            {tPlural('profit_tracking_hint_missing', settings!.products_missing_cost, {
              count: settings!.products_missing_cost,
            })}
          </a>
        )}
      </div>

      {/* Subscription status */}
      {settings?.subscription_status && (
        <a
          href="/subscribe"
          className="block bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('subscription_label')}</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    settings.subscription_status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : settings.subscription_status === 'trialing'
                        ? 'bg-blue-100 text-blue-700'
                        : settings.subscription_status === 'cancelled'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                  }`}
                >
                  {statusLabel(settings.subscription_status)}
                </span>
                {(() => {
                  const endDate =
                    settings.subscription_status === 'trialing'
                      ? settings.trial_ends_at
                      : settings.subscription_ends_at
                  if (!endDate) return null
                  const days = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                  const localeTag = locale === 'en' ? 'en-ZA' : locale
                  if (settings.subscription_status === 'active') {
                    return (
                      <span className="text-xs text-gray-400">
                        {t('sub_renews', { date: new Date(endDate).toLocaleDateString(localeTag, { day: 'numeric', month: 'short' }) })}
                      </span>
                    )
                  }
                  return (
                    <span className="text-xs text-gray-400">
                      {tPlural('sub_days_left', days, { count: days })}
                    </span>
                  )
                })()}
              </div>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </a>
      )}

      {/* Shop code */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{t('shop_code_label')}</p>
          <p className="font-mono font-bold text-blue-600 text-lg">{settings?.code}</p>
        </div>
        <p className="text-xs text-gray-300 text-right max-w-[140px]">
          {t('shop_code_hint')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_shop_name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder={t('placeholder_shop_name')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_reg_number')} <span className="text-gray-400 font-normal">{t('label_optional')}</span>
          </label>
          <input
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder={t('placeholder_reg_number')}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t('hint_reg_number')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_location')} <span className="text-gray-400 font-normal">{t('label_optional')}</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder={t('placeholder_location')}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t('hint_location')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('label_threshold')}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={9999}
              className="w-24 border border-gray-200 rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">{t('threshold_suffix')}</span>
          </div>
        </div>

        {messageText && (
          <p
            className={`text-sm rounded-xl px-4 py-3 ${
              message?.type === 'ok'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {messageText}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white font-semibold rounded-2xl py-4 text-base active:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('btn_saving') : t('btn_save')}
        </button>
      </form>
    </main>
  )
}
