'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper, Check, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import { AreaPicker, type AreaPickerValue } from '@/components/compliance-onboarding/AreaPicker'
import { recordRecentUser } from '@/lib/auth/recent-users'
import type { SupportedLocale } from '@/lib/i18n/types'

export default function OnboardingPage() {
  const router = useRouter()
  const { locale, t, setLocale } = useTranslation()
  const [step, setStep] = useState<'language' | 'continue-with-google' | 'setup' | 'done'>('language')
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLocale>(locale)
  const [email, setEmail] = useState('')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [location, setLocation] = useState('')
  const [area, setArea] = useState<AreaPickerValue>({
    municipality_id: null,
    municipality_area_text: null,
  })
  const [generatedCode, setGeneratedCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      /* clipboard blocked — silent fail; the code is still visible to read */
    }
  }

  function handleLanguageContinue() {
    setLocale(selectedLanguage)
    setStep('continue-with-google')
  }

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
    // After auth, /auth/callback sees no role → redirects back to /onboarding.
    // The useEffect below picks up the signed-in session and jumps to 'setup'.
  }

  // If the user lands here already signed in (after Google OAuth callback)
  // but with no shop yet (no role), skip straight to the shop-setup step.
  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (user && !user.app_metadata?.role) {
        if (user.email) setEmail(user.email)
        setStep('setup')
      }
    }
    void checkSession()
  }, [])

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Area is compulsory — either a picked municipality or a free-text area.
    const trimmedArea = area.municipality_area_text?.trim() ?? ''
    if (!area.municipality_id && trimmedArea.length === 0) {
      setError(t('error_area_required'))
      return
    }

    setLoading(true)

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName,
        ownerName,
        registrationNumber: registrationNumber || undefined,
        location: location || undefined,
        language: locale,
        municipality_id: area.municipality_id,
        municipality_area_text: area.municipality_id ? null : trimmedArea || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('error_generic'))
      setLoading(false)
      return
    }

    // Show the generated shop code before redirecting
    setGeneratedCode(data.shopCode)
    setStep('done')
    setLoading(false)

    // Refresh the session to pick up the new app_metadata role
    const supabase = createClient()
    await supabase.auth.refreshSession()
  }

  function handleContinueToDashboard() {
    if (email) recordRecentUser({ kind: 'owner', email })
    router.push('/dashboard')
  }

  const subtitle =
    step === 'language' ? t('language_step_subtitle') :
    step === 'continue-with-google' ? t('onboarding_step1_title') :
    step === 'done' ? t('shop_created_title') :
    t('onboarding_step2_title')

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand">Movestock</h1>
          <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          {step === 'language' ? (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 text-center">
                {t('language_step_title')}
              </h2>
              <LanguagePicker
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                variant="full"
              />
              <button
                onClick={handleLanguageContinue}
                className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover transition-colors text-base min-h-[48px]"
              >
                {t('btn_continue')}
              </button>
            </div>
          ) : step === 'done' ? (
            <div className="text-center space-y-4 py-2">
              <PartyPopper className="w-12 h-12 mx-auto text-brand" strokeWidth={1.5} />
              <h2 className="text-lg font-bold text-gray-900">{t('shop_created_title')}</h2>
              <div className="bg-brand-light border border-brand-light rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">{t('shop_created_text')}</p>
                <p className="text-3xl font-bold text-brand tracking-wider">{generatedCode}</p>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className={`mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full transition-colors ${
                    codeCopied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white border border-brand-light text-brand-hover active:bg-brand-light'
                  }`}
                >
                  {codeCopied ? (
                    <>
                      <Check className="w-4 h-4" strokeWidth={2.25} />
                      {t('shop_created_copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" strokeWidth={1.75} />
                      {t('shop_created_copy')}
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  {t('shop_created_subtext')}
                </p>
              </div>
              <button
                onClick={handleContinueToDashboard}
                className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover transition-colors text-base min-h-[48px]"
              >
                {t('btn_go_to_dashboard')}
              </button>
            </div>
          ) : step === 'continue-with-google' ? (
            <GoogleSignInStep
              loading={loading}
              error={error}
              onSignIn={handleGoogleSignIn}
            />
          ) : (
            <ShopSetupForm
              shopName={shopName}
              setShopName={setShopName}
              ownerName={ownerName}
              setOwnerName={setOwnerName}
              registrationNumber={registrationNumber}
              setRegistrationNumber={setRegistrationNumber}
              location={location}
              setLocation={setLocation}
              area={area}
              setArea={setArea}
              error={error}
              loading={loading}
              onSubmit={handleSetup}
            />
          )}
        </div>

        {step !== 'language' && step !== 'done' && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {t('link_already_have_account')}{' '}
            <a href="/login" className="text-brand font-medium">
              {t('link_sign_in_instead')}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Sign in with Google ──────────────────────────────

function GoogleSignInStep({
  loading, error, onSignIn,
}: {
  loading: boolean
  error: string
  onSignIn: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t('google_signin_subtitle')}</p>

      <button
        type="button"
        onClick={onSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-800 font-semibold py-3 rounded-full hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        <GoogleGlyph />
        {t('btn_continue_with_google')}
      </button>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}
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

// ── Step 2: Shop setup ───────────────────────────────────────

function ShopSetupForm({
  shopName, setShopName,
  ownerName, setOwnerName,
  registrationNumber, setRegistrationNumber,
  location, setLocation,
  area, setArea,
  error, loading, onSubmit,
}: {
  shopName: string; setShopName: (v: string) => void
  ownerName: string; setOwnerName: (v: string) => void
  registrationNumber: string; setRegistrationNumber: (v: string) => void
  location: string; setLocation: (v: string) => void
  area: AreaPickerValue; setArea: (v: AreaPickerValue) => void
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        {t('onboarding_step2_subtitle')} — {t('onboarding_step2_description')}
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_shop_name')}</label>
        <input
          type="text"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder={t('placeholder_shop_name')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_your_name')}</label>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder={t('placeholder_your_name')}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          {t('hint_owner_name')}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('label_registration_number')} <span className="text-gray-400 font-normal">{t('label_optional')}</span>
        </label>
        <input
          type="text"
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          placeholder={t('placeholder_registration_number')}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          {t('hint_add_later')}
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
          placeholder={t('placeholder_location')}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          {t('hint_add_later')}
        </p>
      </div>
      <AreaPicker value={area} onChange={setArea} copyNamespace="auth" />
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_creating_shop') : t('btn_create_shop')}
      </button>
    </form>
  )
}
