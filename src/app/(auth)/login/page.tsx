'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { FullScreenSpinner } from '@/components/Spinner'
import {
  getRecentUsers,
  recordRecentUser,
  removeRecentUser,
  initialForRecentUser,
  labelForRecentUser,
  type RecentUser,
} from '@/lib/auth/recent-users'

type Tab = 'owner' | 'teller'

export default function LoginPage() {
  const router = useRouter()
  const { locale, t, setLocale } = useTranslation()
  const [tab, setTab] = useState<Tab>('owner')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [tellerShopCode, setTellerShopCode] = useState('')
  const [tellerName, setTellerName] = useState('')
  const [recents, setRecents] = useState<RecentUser[]>([])

  useEffect(() => {
    setRecents(getRecentUsers())
  }, [])

  function handleSelectRecent(u: RecentUser) {
    if (u.kind === 'teller') {
      setTab('teller')
      setTellerShopCode(u.shop_code)
      setTellerName(u.display_name)
    } else {
      setTab('owner')
      setOwnerEmail(u.email)
    }
  }

  function handleRemoveRecent(u: RecentUser) {
    removeRecentUser(u)
    setRecents(getRecentUsers())
  }

  function handleOwnerSuccess(email: string) {
    recordRecentUser({ kind: 'owner', email })
    router.push('/dashboard')
  }

  function handleTellerSuccess(shopCode: string, name: string) {
    recordRecentUser({ kind: 'teller', shop_code: shopCode.toUpperCase(), display_name: name })
    router.push('/sale')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo / App name */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand">Movestock</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('login_subtitle')}</p>
        </div>

        {/* Recently used row */}
        {recents.length > 0 && (
          <RecentUsersRow
            users={recents}
            onSelect={handleSelectRecent}
            onRemove={handleRemoveRecent}
          />
        )}

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            onClick={() => setTab('owner')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'owner'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('tab_owner')}
          </button>
          <button
            onClick={() => setTab('teller')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'teller'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t('tab_teller')}
          </button>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {tab === 'owner' ? (
            <OwnerLoginForm
              email={ownerEmail}
              setEmail={setOwnerEmail}
              onSuccess={handleOwnerSuccess}
            />
          ) : (
            <TellerLoginForm
              shopCode={tellerShopCode}
              setShopCode={setTellerShopCode}
              name={tellerName}
              setName={setTellerName}
              onSuccess={handleTellerSuccess}
            />
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

// ── Recent users row ─────────────────────────────────────────

function RecentUsersRow({
  users,
  onSelect,
  onRemove,
}: {
  users: RecentUser[]
  onSelect: (u: RecentUser) => void
  onRemove: (u: RecentUser) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {t('recent_users_title')}
      </p>
      <ul className="space-y-2">
        {users.map((u, i) => (
          <li key={`${u.kind}-${i}`} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelect(u)}
              className="flex-1 flex items-center gap-3 bg-white border border-gray-200 rounded-full px-3 py-2.5 text-left active:bg-gray-50 min-h-[48px]"
            >
              <span className="w-9 h-9 rounded-full bg-brand-light text-brand-hover font-bold flex items-center justify-center shrink-0">
                {initialForRecentUser(u)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900 truncate">
                  {labelForRecentUser(u)}
                </span>
                <span className="block text-xs text-gray-400">
                  {u.kind === 'teller' ? t('tab_teller') : t('tab_owner')}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(u)}
              aria-label={t('recent_users_remove')}
              className="w-9 h-9 flex items-center justify-center text-gray-300 active:text-gray-600 shrink-0"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Owner login ──────────────────────────────────────────────

function OwnerLoginForm({
  email,
  setEmail,
  onSuccess,
}: {
  email: string
  setEmail: (v: string) => void
  onSuccess: (email: string) => void
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'enter-email' | 'enter-code'>('enter-email')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (otpError) {
      setError(otpError.message.toLowerCase().includes('not found')
        ? t('otp_error_no_account')
        : t('otp_error_send_failed'))
      setLoading(false)
      return
    }
    setCode('')
    setPhase('enter-code')
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    if (verifyError) {
      setError(t('otp_error_wrong_code'))
      setLoading(false)
      return
    }
    onSuccess(email)
  }

  if (phase === 'enter-code') {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-4" autoComplete="off">
        {loading && <FullScreenSpinner label={t('btn_signing_in')} />}
        <p className="text-sm text-gray-600">{t('otp_hint_check_email', { email })}</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('otp_label_code')}</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('otp_placeholder_code')}
            required
            autoComplete="one-time-code"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand text-lg tracking-[0.4em]"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover active:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
        >
          {loading ? t('btn_signing_in') : t('btn_sign_in')}
        </button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setPhase('enter-email')
              setCode('')
              setError('')
            }}
            className="text-gray-500 active:text-gray-700"
          >
            {t('otp_btn_change_email')}
          </button>
          <button
            type="button"
            onClick={handleSendCode as unknown as () => void}
            disabled={loading}
            className="text-brand font-medium active:text-brand-hover disabled:opacity-50"
          >
            {t('otp_btn_resend')}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4" autoComplete="off">
      {loading && <FullScreenSpinner label={t('otp_btn_sending_code')} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_email')}</label>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholder_email')}
          required
          autoComplete="email"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
        <p className="text-xs text-gray-400 mt-1">{t('otp_hint_send_code')}</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover active:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('otp_btn_sending_code') : t('otp_btn_send_code')}
      </button>

      <p className="text-center text-sm">
        <a href="/onboarding" className="text-brand font-medium">
          {t('link_create_shop')}
        </a>
      </p>
    </form>
  )
}

// ── Teller login ─────────────────────────────────────────────

function TellerLoginForm({
  shopCode,
  setShopCode,
  name,
  setName,
  onSuccess,
}: {
  shopCode: string
  setShopCode: (v: string) => void
  name: string
  setName: (v: string) => void
  onSuccess: (shopCode: string, name: string) => void
}) {
  const { t } = useTranslation()
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
        setError(t('teller_error_wrong_pin'))
        setLoading(false)
        return
      }

      onSuccess(shopCode, name)
    } catch {
      setError(t('error_generic'))
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {loading && <FullScreenSpinner label={t('btn_signing_in')} />}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('teller_label_shop_code')}</label>
        <input
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value.toUpperCase())}
          placeholder={t('teller_placeholder_shop_code')}
          required
          maxLength={10}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base uppercase tracking-wider"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('teller_label_pin')}</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('teller_placeholder_pin')}
          required
          autoComplete="off"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand text-lg tracking-[0.4em]"
        />
        <p className="text-xs text-gray-400 mt-1">{t('teller_hint_pin')}</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover active:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_signing_in') : t('btn_sign_in')}
      </button>
    </form>
  )
}
