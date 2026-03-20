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
  const [whatsapp, setWhatsapp] = useState('')
  const [threshold, setThreshold] = useState(5)
  const [regNumber, setRegNumber] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data: ShopSettings) => {
        setSettings(data)
        setName(data.name)
        setWhatsapp(data.whatsapp_number ?? '')
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
        whatsapp_number: whatsapp.trim() || null,
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
      <p className="text-sm text-gray-400 mb-8">Update your shop details</p>

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

        {/* WhatsApp number */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your WhatsApp number
          </label>
          <p className="text-xs text-gray-400 mb-2">
            We send your daily sales report here. Leave blank to turn off reports.
          </p>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
            placeholder="+27821234567"
          />
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
