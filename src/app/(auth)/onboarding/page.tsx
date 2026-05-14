'use client'

import { useState } from 'react'
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
  const [step, setStep] = useState<'language' | 'enter-email' | 'enter-code' | 'setup' | 'done'>('language')
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLocale>(locale)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
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
    setStep('enter-email')
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (otpError) {
      setError(otpError.message)
      setLoading(false)
      return
    }

    setCode('')
    setStep('enter-code')
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

    setStep('setup')
    setLoading(false)
  }

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
    step === 'enter-email' ? t('onboarding_step1_title') :
    step === 'enter-code' ? t('onboarding_step1_title') :
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
          ) : step === 'enter-email' ? (
            <EmailStep
              email={email}
              setEmail={setEmail}
              error={error}
              loading={loading}
              onSubmit={handleSendCode}
            />
          ) : step === 'enter-code' ? (
            <CodeStep
              email={email}
              code={code}
              setCode={setCode}
              error={error}
              loading={loading}
              onSubmit={handleVerifyCode}
              onChangeEmail={() => {
                setStep('enter-email')
                setCode('')
                setError('')
              }}
              onResend={handleSendCode}
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

// ── Step 1a: Enter email, send OTP ───────────────────────────

function EmailStep({
  email, setEmail, error, loading, onSubmit,
}: {
  email: string; setEmail: (v: string) => void
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <p className="text-sm text-gray-600">
        {t('onboarding_step1_subtitle')} — {t('onboarding_step1_description')}
      </p>
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
        className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('otp_btn_sending_code') : t('otp_btn_send_code')}
      </button>
    </form>
  )
}

// ── Step 1b: Verify OTP ──────────────────────────────────────

function CodeStep({
  email, code, setCode, error, loading, onSubmit, onChangeEmail, onResend,
}: {
  email: string
  code: string; setCode: (v: string) => void
  error: string; loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onChangeEmail: () => void
  onResend: (e: React.FormEvent) => void
}) {
  const { t } = useTranslation()

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
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
        className="w-full bg-brand text-white font-semibold py-3 rounded-full hover:bg-brand-hover transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? t('btn_signing_in') : t('btn_continue')}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onChangeEmail} className="text-gray-500 active:text-gray-700">
          {t('otp_btn_change_email')}
        </button>
        <button
          type="button"
          onClick={onResend as unknown as () => void}
          disabled={loading}
          className="text-brand font-medium active:text-brand-hover disabled:opacity-50"
        >
          {t('otp_btn_resend')}
        </button>
      </div>
    </form>
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
