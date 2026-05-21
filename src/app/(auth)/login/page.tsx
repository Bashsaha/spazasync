'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, Card, FormField, Input, Callout } from '@/components/ui'
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
    // Hard navigation (not router.push) so the server re-renders with the
    // freshly-set session cookie. A soft RSC navigation right after a client-
    // side signInWithPassword raced the cookie propagation and left the page
    // spinning until a manual reload. A full load is instant here and reliable.
    window.location.assign('/sale')
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
        <Card padding="lg">
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
        </Card>

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
  onSuccess: _onSuccess,
}: {
  email: string
  setEmail: (v: string) => void
  onSuccess: (email: string) => void
}) {
  const { t } = useTranslation()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) {
      setError(t('google_signin_error'))
      setLoading(false)
    }
    // On success the browser redirects to Google and never returns here.
  }

  return (
    <div className="space-y-4">
      {loading && <FullScreenSpinner label={t('btn_signing_in')} />}
      <p className="text-sm text-gray-600">{t('google_signin_subtitle')}</p>

      <Button
        variant="outline"
        size="lg"
        fullWidth
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <GoogleGlyph />
        {t('btn_continue_with_google')}
      </Button>

      {error && <Callout tone="error">{error}</Callout>}

      <p className="text-center text-sm">
        <Link href="/onboarding" className="text-brand font-medium">
          {t('link_create_shop')}
        </Link>
      </p>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
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

      <FormField label={t('teller_label_shop_code')} hint={t('teller_hint_shop_code')}>
        <Input
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value.toUpperCase())}
          placeholder={t('teller_placeholder_shop_code')}
          required
          maxLength={10}
          className="uppercase tracking-wider text-base"
        />
      </FormField>

      <FormField label={t('teller_label_name')}>
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('teller_placeholder_name')}
          required
          className="text-base"
        />
      </FormField>

      <FormField label={t('teller_label_pin')} hint={t('teller_hint_pin')}>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('teller_placeholder_pin')}
          required
          autoComplete="off"
          className="text-lg tracking-[0.4em]"
        />
      </FormField>

      {error && <Callout tone="error">{error}</Callout>}

      <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
        {loading ? t('btn_signing_in') : t('btn_sign_in')}
      </Button>
    </form>
  )
}
