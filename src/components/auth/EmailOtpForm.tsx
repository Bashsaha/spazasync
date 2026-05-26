'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/components/LanguageProvider'
import { Button, FormField, Input, Callout } from '@/components/ui'
import {
  ownerEmailOtpRequestSchema,
  ownerOtpVerifySchema,
} from '@/lib/validation/schemas'

type Phase = 'idle' | 'sent'

/**
 * Email + 6-digit OTP auth — secondary to Google OAuth.
 *
 * Two-phase flow: (1) collect email → signInWithOtp, (2) collect 6-digit code → verifyOtp.
 * `shouldCreateUser: true` means Supabase creates the auth user if the email is new,
 * signs into the existing one otherwise — covers both login and signup paths.
 *
 * NO `<input type="password">` anywhere — see BUG-034 (Chrome Password Reuse Protection
 * fires on any password field on a low-reputation domain). The code input is plain text
 * + inputMode="numeric" so Chrome treats it as a one-time code, not a saved credential.
 *
 * Emails go through the custom SMTP wired to Resend on movestock.co.za. Supabase's
 * 4-emails-per-hour default cap does not apply.
 */
export function EmailOtpForm({
  initialEmail = '',
  onVerified,
  autoFocusEmail = false,
}: {
  initialEmail?: string
  onVerified: (email: string) => void
  autoFocusEmail?: boolean
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    const parsed = ownerEmailOtpRequestSchema.safeParse({ email })
    if (!parsed.success) {
      setError(t('otp_error_email_required'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (otpError) {
      setError(t('otp_error_send_failed'))
      setLoading(false)
      return
    }

    setEmail(parsed.data.email)
    setPhase('sent')
    setLoading(false)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')

    const parsed = ownerOtpVerifySchema.safeParse({ email, token: code })
    if (!parsed.success) {
      setError(t('otp_error_code_required'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: 'email',
    })

    if (verifyError) {
      const msg = verifyError.message.toLowerCase()
      if (msg.includes('expired')) {
        setError(t('otp_error_expired'))
      } else {
        setError(t('otp_error_invalid_code'))
      }
      setLoading(false)
      return
    }

    onVerified(parsed.data.email)
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setLoading(true)
    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (otpError) {
      setError(t('otp_error_send_failed'))
    } else {
      setInfo(t('otp_resent_hint'))
      setCode('')
    }
    setLoading(false)
  }

  function handleUseDifferentEmail() {
    setPhase('idle')
    setCode('')
    setError('')
    setInfo('')
  }

  if (phase === 'idle') {
    return (
      <form onSubmit={handleSendCode} className="space-y-3" noValidate>
        <FormField label={t('otp_email_label')}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('otp_email_placeholder')}
            autoFocus={autoFocusEmail}
            required
            className="text-base"
          />
        </FormField>

        {error && <Callout tone="error">{error}</Callout>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
          icon={Mail}
        >
          {loading ? t('otp_sending') : t('otp_send_btn')}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className="space-y-3" noValidate>
      <p className="text-sm text-gray-600">
        {t('otp_code_sent_to', { email })}
      </p>

      <FormField label={t('otp_code_label')}>
        <Input
          type="text"
          name="otp"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('otp_code_placeholder')}
          autoFocus
          required
          className="text-base text-center tracking-[0.4em] font-semibold"
        />
      </FormField>

      {error && <Callout tone="error">{error}</Callout>}
      {info && <Callout tone="success">{info}</Callout>}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={loading || code.length !== 6}
      >
        {loading ? t('otp_verifying') : t('otp_verify_btn')}
      </Button>

      <div className="flex items-center justify-between text-sm pt-1">
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          className="text-brand font-medium active:opacity-70 disabled:opacity-50"
        >
          {t('otp_resend_btn')}
        </button>
        <button
          type="button"
          onClick={handleUseDifferentEmail}
          disabled={loading}
          className="text-gray-500 active:opacity-70 disabled:opacity-50"
        >
          {t('otp_use_different_email')}
        </button>
      </div>
    </form>
  )
}
