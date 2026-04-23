'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { LanguagePicker } from '@/components/LanguagePicker'
import type { SupportedLocale } from '@/lib/i18n/types'

export default function OnboardingPage() {
  const router = useRouter()
  const { locale, t, setLocale } = useTranslation()
  const [step, setStep] = useState<'language' | 'signup' | 'email-sent' | 'setup' | 'done'>('language')
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLocale>(locale)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [location, setLocation] = useState('')
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
    setStep('signup')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError(t('error_email_registered'))
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    // Try signing in immediately (works if Supabase auto-confirms emails)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInError) {
      setStep('setup')
    } else {
      // Email confirmation required — show the "check your email" screen
      setStep('email-sent')
    }
    setLoading(false)
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
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
    router.push('/dashboard')
  }

  const subtitle =
    step === 'language' ? t('language_step_subtitle') :
    step === 'signup' ? t('onboarding_step1_title') :
    step === 'email-sent' ? t('onboarding_step2_heading') :
    step === 'done' ? t('shop_created_title') :
    t('onboarding_step2_title')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Movestock</h1>
          <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors text-base min-h-[48px]"
              >
                {t('btn_continue')}
              </button>
            </div>
          ) : step === 'email-sent' ? (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">📧</div>
              <h2 className="text-lg font-bold text-gray-900">{t('email_sent_title')}</h2>
              <p className="text-gray-600 text-sm">
                {t('email_sent_text', { email })}
              </p>
              <p className="text-gray-400 text-xs">
                {t('email_sent_spam_hint')}
              </p>
              <a
                href="/login"
                className="block w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors text-base text-center mt-4"
              >
                {t('email_sent_link')}
              </a>
            </div>
          ) : step === 'done' ? (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">🎉</div>
              <h2 className="text-lg font-bold text-gray-900">{t('shop_created_title')}</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-1">{t('shop_created_text')}</p>
                <p className="text-3xl font-bold text-blue-600 tracking-wider">{generatedCode}</p>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className={`mt-3 text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                    codeCopied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white border border-blue-300 text-blue-700 active:bg-blue-100'
                  }`}
                >
                  {codeCopied ? `✓ ${t('shop_created_copied')}` : `📋 ${t('shop_created_copy')}`}
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  {t('shop_created_subtext')}
                </p>
              </div>
              <button
                onClick={handleContinueToDashboard}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors text-base min-h-[48px]"
              >
                {t('btn_go_to_dashboard')}
              </button>
            </div>
          ) : step === 'signup' ? (
            <SignupForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              error={error}
              loading={loading}
              onSubmit={handleSignup}
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
              error={error}
              loading={loading}
              onSubmit={handleSetup}
            />
          )}
        </div>

        {step !== 'language' && step !== 'done' && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {t('link_already_have_account')}{' '}
            <a href="/login" className="text-blue-600 font-medium">
              {t('link_sign_in_instead')}
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Step 1: Create account ───────────────────────────────────

function SignupForm({
  email, setEmail, password, setPassword, error, loading, onSubmit,
}: {
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        {t('onboarding_step1_subtitle')} — {t('onboarding_step1_description')}
      </p>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_choose_password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('placeholder_password_hint')}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_creating_account') : t('btn_continue')}
      </button>
    </form>
  )
}

// ── Step 2: Shop setup ───────────────────────────────────────

function ShopSetupForm({
  shopName, setShopName,
  ownerName, setOwnerName,
  registrationNumber, setRegistrationNumber,
  location, setLocation,
  error, loading, onSubmit,
}: {
  shopName: string; setShopName: (v: string) => void
  ownerName: string; setOwnerName: (v: string) => void
  registrationNumber: string; setRegistrationNumber: (v: string) => void
  location: string; setLocation: (v: string) => void
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          {t('hint_add_later')}
        </p>
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_creating_shop') : t('btn_create_shop')}
      </button>
    </form>
  )
}
