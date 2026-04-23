'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildTellerEmail } from '@/lib/auth/teller'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'

type Tab = 'owner' | 'teller'

export default function LoginPage() {
  const router = useRouter()
  const { locale, t, setLocale } = useTranslation()
  const [tab, setTab] = useState<Tab>('owner')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / App name */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Movestock</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('login_subtitle')}</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            onClick={() => setTab('owner')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'owner'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('tab_owner')}
          </button>
          <button
            onClick={() => setTab('teller')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'teller'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('tab_teller')}
          </button>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {tab === 'owner' ? (
            <OwnerLoginForm onSuccess={() => router.push('/dashboard')} />
          ) : (
            <TellerLoginForm onSuccess={() => router.push('/sale')} />
          )}
        </div>

        {/* Language switcher */}
        <div className="mt-6">
          <LanguagePicker value={locale} onChange={setLocale} variant="compact" />
        </div>
      </div>
    </div>
  )
}

// ── Owner login ──────────────────────────────────────────────

function OwnerLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(t('error_login'))
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_email')}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholder_email')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('placeholder_password')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_signing_in') : t('btn_sign_in')}
      </button>

      <p className="text-center text-sm">
        <a href="/onboarding" className="text-blue-600 font-medium">
          {t('link_create_shop')}
        </a>
      </p>
    </form>
  )
}

// ── Teller login ─��────────────────��───────────────────────��──

function TellerLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()
  const [shopCode, setShopCode] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Step 1: Validate that this teller exists in this shop
      const res = await fetch('/api/auth/teller-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopCode: shopCode.toUpperCase(), tellerName: name }),
      })

      if (!res.ok) {
        const { error: msg } = await res.json()
        setError(msg ?? t('teller_error_not_found'))
        setLoading(false)
        return
      }

      // Step 2: Sign in with the synthetic email + their password
      const { syntheticEmail } = await res.json()
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      })

      if (authError) {
        setError(t('teller_error_wrong_password'))
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setError(t('error_generic'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('teller_label_shop_code')}</label>
        <input
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value.toUpperCase())}
          placeholder={t('teller_placeholder_shop_code')}
          required
          maxLength={10}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base uppercase tracking-wider"
        />
        <p className="text-xs text-gray-400 mt-1">{t('teller_hint_shop_code')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('teller_label_name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('teller_placeholder_name')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('teller_label_password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('placeholder_password')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
        <p className="text-xs text-gray-400 mt-1">{t('teller_hint_password')}</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_signing_in') : t('btn_sign_in')}
      </button>
    </form>
  )
}
