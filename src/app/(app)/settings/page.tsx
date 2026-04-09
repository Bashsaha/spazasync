'use client'

import { useState, useEffect } from 'react'

interface ShopSettings {
  id: string
  name: string
  code: string
  whatsapp_number: string | null
  low_stock_threshold: number
  registration_number: string | null
  location: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  subscription_ends_at: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [name, setName] = useState('')
  const [threshold, setThreshold] = useState(5)
  const [regNumber, setRegNumber] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: ShopSettings) => {
        setSettings(data)
        setName(data.name)
        setThreshold(data.low_stock_threshold)
        setRegNumber(data.registration_number ?? '')
        setLocation(data.location ?? '')
      })
      .catch(() => setMessage({ type: 'err', text: 'Could not load settings.' }))
      .finally(() => setLoading(false))
  }, [])

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
      }),
    })

    setSaving(false)

    if (res.ok) {
      const updated: ShopSettings = await res.json()
      setSettings(updated)
      setMessage({ type: 'ok', text: 'Settings saved!' })
    } else {
      const err = await res.json().catch(() => ({}))
      setMessage({ type: 'err', text: (err as { error?: string }).error ?? 'Could not save. Try again.' })
    }
  }

  async function handleDownloadReport() {
    setDownloading(true)
    try {
      const res = await fetch('/api/reports/compliance-pdf')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMessage({ type: 'err', text: (err as { error?: string }).error ?? 'Could not generate report.' })
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
      setMessage({ type: 'err', text: 'Could not download report. Try again.' })
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    )
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <a href="/dashboard" className="text-sm text-blue-600 mb-6 inline-block">
        ← Back
      </a>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Update your shop details</p>

      {/* Compliance report — at the top for quick access */}
      <div id="compliance" className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-4 mb-6">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-bold text-indigo-900">Compliance Report</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              If a health inspector visits your shop, show them this PDF. It has your full stock list, expiry dates, and 30 days of sales — everything they need to see.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadReport}
          disabled={downloading}
          className="w-full bg-indigo-600 text-white font-semibold rounded-xl py-3 text-sm active:bg-indigo-700 disabled:opacity-50"
        >
          {downloading ? 'Generating your report…' : 'Download Report PDF'}
        </button>
      </div>

      {/* Subscription status */}
      {settings?.subscription_status && (
        <a
          href="/subscribe"
          className="block bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-1">Subscription</p>
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
                  {settings.subscription_status === 'trialing'
                    ? 'Free Trial'
                    : settings.subscription_status === 'active'
                      ? 'Active'
                      : settings.subscription_status === 'cancelled'
                        ? 'Cancelled'
                        : 'Expired'}
                </span>
                {(() => {
                  const endDate =
                    settings.subscription_status === 'trialing'
                      ? settings.trial_ends_at
                      : settings.subscription_ends_at
                  if (!endDate) return null
                  const days = Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                  if (settings.subscription_status === 'active') {
                    return (
                      <span className="text-xs text-gray-400">
                        Renews {new Date(endDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </span>
                    )
                  }
                  return (
                    <span className="text-xs text-gray-400">
                      {days} day{days !== 1 ? 's' : ''} left
                    </span>
                  )
                })()}
              </div>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </div>
        </a>
      )}

      {/* Shop code — read only */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Your shop code</p>
          <p className="font-mono font-bold text-blue-600 text-lg">{settings?.code}</p>
        </div>
        <p className="text-xs text-gray-300 text-right max-w-[140px]">
          Tellers use this to log in. It cannot be changed.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Shop name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Shop name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder="e.g. Cape Town Corner Shop"
          />
        </div>

        {/* Registration number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Registration number <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder="e.g. CIPC or municipal reg number"
          />
          <p className="text-xs text-gray-400 mt-1">
            Your CIPC or municipal registration number. Shows on compliance reports.
          </p>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder="e.g. 12 Main Rd, Khayelitsha, Cape Town"
          />
          <p className="text-xs text-gray-400 mt-1">
            Your shop address. Shows on compliance reports.
          </p>
        </div>

        {/* Low stock threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Warn me when a product has fewer than
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
            <span className="text-sm text-gray-500">left in stock</span>
          </div>
        </div>

        {/* Feedback message */}
        {message && (
          <p
            className={`text-sm rounded-xl px-4 py-3 ${
              message.type === 'ok'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white font-semibold rounded-2xl py-4 text-base active:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </main>
  )
}
