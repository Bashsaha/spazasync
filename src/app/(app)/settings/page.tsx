'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, Shield, Wallet } from 'lucide-react'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { BackButton } from '@/components/BackButton'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, Card, FormField, Input, Callout, Badge, PageHeader } from '@/components/ui'
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
  has_fridge: boolean
  has_freezer: boolean
  fund_interest: boolean
  products_missing_cost: number
  subscription_status: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
  nationality_type: 'sa_citizen' | 'foreign_national' | null
}

export default function SettingsPage() {
  const router = useRouter()
  const { t, tPlural, locale, setLocale } = useTranslation('settings')
  const { t: tChk } = useTranslation('checklist')
  const { t: tCo } = useTranslation('compliance-onboarding')
  const [redoLoading, setRedoLoading] = useState(false)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState(5)
  const [regNumber, setRegNumber] = useState('')
  const [location, setLocation] = useState('')
  const [language, setLanguage] = useState<SupportedLocale>(locale)
  const [profitTracking, setProfitTracking] = useState(false)
  const [hasFridge, setHasFridge] = useState(true)
  const [hasFreezer, setHasFreezer] = useState(true)
  const [fundInterest, setFundInterest] = useState(false)
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
        setHasFridge(data.has_fridge !== false)
        setHasFreezer(data.has_freezer !== false)
        setFundInterest(Boolean(data.fund_interest))
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

  async function handleEquipmentToggle(kind: 'fridge' | 'freezer', nextValue: boolean) {
    if (kind === 'fridge') setHasFridge(nextValue)
    else setHasFreezer(nextValue)

    const payload = {
      name: name.trim() || settings?.name,
      low_stock_threshold: threshold,
      registration_number: regNumber.trim() || null,
      location: location.trim() || null,
      language,
      has_fridge: kind === 'fridge' ? nextValue : hasFridge,
      has_freezer: kind === 'freezer' ? nextValue : hasFreezer,
    }
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: ShopSettings = await res.json()
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated))
    } else {
      if (kind === 'fridge') setHasFridge(!nextValue)
      else setHasFreezer(!nextValue)
      setMessage({ type: 'err', key: 'msg_save_failed' })
    }
  }

  async function handleFundInterestToggle(nextValue: boolean) {
    setFundInterest(nextValue)
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || settings?.name,
        low_stock_threshold: threshold,
        registration_number: regNumber.trim() || null,
        location: location.trim() || null,
        language,
        fund_interest: nextValue,
      }),
    })
    if (res.ok) {
      const updated: ShopSettings = await res.json()
      setSettings((prev) => (prev ? { ...prev, ...updated } : updated))
    } else {
      setFundInterest(!nextValue)
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
        has_fridge: hasFridge,
        has_freezer: hasFreezer,
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

  async function handleRedoCompliance() {
    setRedoLoading(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || settings?.name,
          low_stock_threshold: threshold,
          registration_number: regNumber.trim() || null,
          location: location.trim() || null,
          language,
          redo_compliance_check: true,
        }),
      })
      router.push('/dashboard?redo_compliance=1')
    } finally {
      setRedoLoading(false)
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
      <main className="px-4 pt-10 pb-40 max-w-lg mx-auto">
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
    <main className="px-4 pt-10 pb-40 max-w-lg mx-auto">
      {saving && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="mb-6">
        <BackButton fallbackHref="/profile" />
      </div>

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Compliance report */}
      <div id="compliance" />
      <Callout tone="brand" icon={ClipboardList} title={t('compliance_title')} className="mb-6">
        <p>{t('compliance_desc')}</p>
        <Button
          variant="primary"
          size="md"
          fullWidth
          loading={downloading}
          onClick={handleDownloadReport}
          className="mt-3"
        >
          {downloading ? t('btn_generating_report') : t('btn_download_report')}
        </Button>
      </Callout>

      {/* Compliance check (Phase 37b) — re-open the onboarding flow */}
      <Callout tone="brand" icon={Shield} title={tCo('settings_section_title')} className="mb-6">
        <p>{tCo('settings_section_subtitle')}</p>
        <Button
          variant="primary"
          size="md"
          fullWidth
          loading={redoLoading}
          onClick={handleRedoCompliance}
          className="mt-3"
        >
          {tCo('settings_redo_btn')}
        </Button>
        <p className="text-xs text-brand-dark/70 mt-2">{tCo('settings_redo_hint')}</p>
      </Callout>

      {/* Language */}
      <Card padding="md" className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">{t('language_title')}</p>
        <LanguagePicker value={language} onChange={handleLanguageChange} variant="compact" />
      </Card>

      {/* Profit tracking toggle */}
      <Card padding="md" className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-5 h-5 text-brand" strokeWidth={1.75} />
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
          <Link
            href="/products/missing-cost"
            className="mt-3 block bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm text-amber-800"
          >
            {tPlural('profit_tracking_hint_missing', settings!.products_missing_cost, {
              count: settings!.products_missing_cost,
            })}
          </Link>
        )}
      </Card>

      {/* Shop equipment (fridge / freezer toggles) */}
      <Card padding="md" className="mb-6">
        <p className="font-semibold text-gray-900 mb-1">{tChk('settings_section')}</p>
        <p className="text-xs text-gray-500 mb-4">{tChk('settings_section_desc')}</p>

        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-gray-800">{tChk('settings_has_fridge')}</p>
          <button
            type="button"
            role="switch"
            aria-checked={hasFridge}
            onClick={() => handleEquipmentToggle('fridge', !hasFridge)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              hasFridge ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                hasFridge ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-800">{tChk('settings_has_freezer')}</p>
          <button
            type="button"
            role="switch"
            aria-checked={hasFreezer}
            onClick={() => handleEquipmentToggle('freezer', !hasFreezer)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              hasFreezer ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                hasFreezer ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <Link href="/checklist/history" className="block text-sm text-brand mt-4">
          {tChk('history_link')} →
        </Link>
      </Card>

      {/* Phase 37e — Government fund eligibility (SA citizens only) */}
      {settings?.nationality_type === 'sa_citizen' && (
        <Card padding="md" className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-5 h-5 text-brand" strokeWidth={1.75} />
                <p className="font-semibold text-gray-900">{t('fund_interest_label')}</p>
              </div>
              <p className="text-sm text-gray-500">{t('fund_interest_help')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fundInterest}
              onClick={() => handleFundInterestToggle(!fundInterest)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                fundInterest ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  fundInterest ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {fundInterest && (
            <Link
              href="/compliance/fund"
              className="mt-3 inline-block text-sm text-brand font-semibold active:text-brand-hover"
            >
              {t('fund_interest_open')} →
            </Link>
          )}
        </Card>
      )}

      {/* Subscription status */}
      {settings?.subscription_status && (
        <Link
          href="/subscribe"
          className="block bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('subscription_label')}</p>
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    settings.subscription_status === 'active' ? 'green'
                      : settings.subscription_status === 'trialing' ? 'brand'
                      : settings.subscription_status === 'cancelled' ? 'amber'
                      : 'red'
                  }
                >
                  {statusLabel(settings.subscription_status)}
                </Badge>
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
        </Link>
      )}

      {/* Shop code */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">{t('shop_code_label')}</p>
          <p className="font-mono font-bold text-brand text-lg">{settings?.code}</p>
        </div>
        <p className="text-xs text-gray-300 text-right max-w-[140px]">
          {t('shop_code_hint')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <FormField label={t('label_shop_name')}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder={t('placeholder_shop_name')}
          />
        </FormField>

        <FormField
          label={
            <>
              {t('label_reg_number')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
          hint={t('hint_reg_number')}
        >
          <Input
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            maxLength={100}
            placeholder={t('placeholder_reg_number')}
          />
        </FormField>

        <FormField
          label={
            <>
              {t('label_location')}{' '}
              <span className="text-gray-400 font-normal">{t('label_optional')}</span>
            </>
          }
          hint={t('hint_location')}
        >
          <Input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            placeholder={t('placeholder_location')}
          />
        </FormField>

        <FormField label={t('label_threshold')}>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={9999}
              className="w-24 text-center"
            />
            <span className="text-sm text-gray-500">{t('threshold_suffix')}</span>
          </div>
        </FormField>

        {messageText && (
          <Callout tone={message?.type === 'ok' ? 'success' : 'error'}>{messageText}</Callout>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth loading={saving}>
          {saving ? t('btn_saving') : t('btn_save')}
        </Button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-8 mb-4">
        Movestock — a product of Veyon
      </p>
    </main>
  )
}
