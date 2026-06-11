'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Mail, UserRound, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { FullScreenSpinner } from '@/components/Spinner'
import { Button, LinkButton, Card, FormField, Input, Callout } from '@/components/ui'
import { EmailOtpForm } from '@/components/auth/EmailOtpForm'
import {
  getRecentUsers,
  recordRecentUser,
  removeRecentUser,
  initialForRecentUser,
  labelForRecentUser,
  type RecentUser,
} from '@/lib/auth/recent-users'

// Single-page flow with view states (no extra routes):
//   home   → logo + "Sign in" / "Sign up" bubbles
//   signin → "Email" / "Connect with Google" / "I'm the teller" bubbles
//   email  → owner email + 6-digit code form
//   teller → teller shop-code + name + PIN form
type View = 'home' | 'signin' | 'email' | 'teller'

export default function LoginPage() {
  const { locale, t, setLocale } = useTranslation()
  const [view, setView] = useState<View>('home')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [tellerShopCode, setTellerShopCode] = useState('')
  const [tellerName, setTellerName] = useState('')
  const [recents, setRecents] = useState<RecentUser[]>([])
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  useEffect(() => {
    setRecents(getRecentUsers())
  }, [])

  function handleSelectRecent(u: RecentUser) {
    if (u.kind === 'teller') {
      setTellerShopCode(u.shop_code)
      setTellerName(u.display_name)
      setView('teller')
    } else {
      setOwnerEmail(u.email)
      setView('email')
    }
  }

  function handleRemoveRecent(u: RecentUser) {
    removeRecentUser(u)
    setRecents(getRecentUsers())
  }

  async function handleGoogleSignIn() {
    setGoogleError('')
    setGoogleLoading(true)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) {
      setGoogleError(t('google_signin_error'))
      setGoogleLoading(false)
    }
    // On success the browser redirects to Google and never returns here.
  }

  function handleOwnerSuccess(email: string) {
    recordRecentUser({ kind: 'owner', email })
    // Hard nav (not router.push) so the server re-renders with the freshly-set
    // session cookie — same cookie-race the teller flow hit in BUG-043.
    window.location.assign('/dashboard')
  }

  function handleTellerSuccess(shopCode: string, name: string) {
    recordRecentUser({ kind: 'teller', shop_code: shopCode.toUpperCase(), display_name: name })
    // Hard navigation so the server re-renders with the freshly-set session
    // cookie (a soft RSC nav raced the cookie propagation — BUG-043).
    window.location.assign('/sale')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-8">
      {googleLoading && <FullScreenSpinner label={t('btn_signing_in')} />}
      <div className="w-full max-w-sm">
        <Logo subtitle={t('login_subtitle')} />

        {view === 'home' ? (
          <div className="space-y-5">
            {recents.length > 0 && (
              <RecentUsersRow
                users={recents}
                onSelect={handleSelectRecent}
                onRemove={handleRemoveRecent}
              />
            )}
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="py-4"
                onClick={() => setView('signin')}
              >
                {t('btn_sign_in')}
              </Button>
              <LinkButton href="/onboarding" variant="outline" size="lg" fullWidth className="py-4">
                {t('btn_sign_up')}
              </LinkButton>
            </div>
          </div>
        ) : view === 'signin' ? (
          <div>
            <BackButton onClick={() => setView('home')} label={t('back')} />
            <p className="text-center text-sm text-gray-600 mb-5">{t('signin_choose_title')}</p>
            <div className="space-y-3">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="py-4"
                icon={Mail}
                onClick={() => setView('email')}
              >
                {t('btn_signin_with_email')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                className="py-4"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <GoogleGlyph />
                {t('btn_continue_with_google')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                className="py-4"
                icon={UserRound}
                onClick={() => setView('teller')}
              >
                {t('btn_im_the_teller')}
              </Button>
            </div>
            {googleError && (
              <div className="mt-4">
                <Callout tone="error">{googleError}</Callout>
              </div>
            )}
          </div>
        ) : view === 'email' ? (
          <div>
            <BackButton onClick={() => setView('signin')} label={t('back')} />
            <Card padding="lg">
              <EmailOtpForm
                initialEmail={ownerEmail}
                onVerified={handleOwnerSuccess}
                autoFocusEmail
              />
            </Card>
          </div>
        ) : (
          <div>
            <BackButton onClick={() => setView('signin')} label={t('back')} />
            <Card padding="lg">
              <TellerLoginForm
                shopCode={tellerShopCode}
                setShopCode={setTellerShopCode}
                name={tellerName}
                setName={setTellerName}
                onSuccess={handleTellerSuccess}
              />
            </Card>
          </div>
        )}

        {/* Language switcher */}
        <div className="mt-6">
          <LanguagePicker value={locale} onChange={setLocale} variant="compact" />
        </div>
      </div>
    </div>
  )
}

// ── Logo ─────────────────────────────────────────────────────

function Logo({ subtitle }: { subtitle: string }) {
  return (
    <div className="text-center mb-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon.svg"
        alt="Movestock"
        width={72}
        height={72}
        className="mx-auto rounded-2xl shadow-sm"
      />
      <h1 className="text-2xl font-bold text-brand mt-3">Movestock</h1>
      <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>
    </div>
  )
}

// ── Back button ──────────────────────────────────────────────

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-gray-500 font-medium active:opacity-70 mb-4 min-h-[44px]"
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
      {label}
    </button>
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
    <div>
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
      // The PIN sign-in now happens SERVER-SIDE in the rate-limited route (so a
      // 6-digit PIN can't be brute-forced straight against Supabase Auth). On
      // success the route has already set the session cookies on this response,
      // so the hard nav in onSuccess (BUG-043) carries a valid session.
      const res = await fetch('/api/auth/teller-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopCode: shopCode.toUpperCase(), tellerName: name, pin: password }),
      })

      if (!res.ok) {
        // 401 = wrong PIN; 404/400 = shop/name lookup failed; 429 = throttled.
        if (res.status === 401) {
          setError(t('teller_error_wrong_pin'))
        } else {
          const { error: msg } = await res.json().catch(() => ({ error: undefined }))
          setError(msg ?? t('teller_error_not_found'))
        }
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
