'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<'signup' | 'email-sent' | 'setup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopCode, setShopCode] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('That email is already registered. Go back and sign in instead.')
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

    if (shopCode.length < 6 || !/^[A-Z0-9]+$/.test(shopCode)) {
      setError('Shop code must be 6–10 letters and numbers only, e.g. CAPE99')
      setLoading(false)
      return
    }

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName,
        shopCode: shopCode.toUpperCase(),
        ownerName,
        whatsappNumber: whatsapp || undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Refresh the session to pick up the new app_metadata role
    const supabase = createClient()
    await supabase.auth.refreshSession()

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">SpazaSync</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {step === 'signup' ? 'Create your owner account' : step === 'email-sent' ? 'Almost there!' : 'Set up your shop'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {step === 'email-sent' ? (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">📧</div>
              <h2 className="text-lg font-bold text-gray-900">Check your email</h2>
              <p className="text-gray-600 text-sm">
                We sent a confirmation link to <strong>{email}</strong>.
                Click the link in the email, then come back here and sign in.
              </p>
              <p className="text-gray-400 text-xs">
                Can&apos;t find it? Check your spam folder.
              </p>
              <a
                href="/login"
                className="block w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors text-base text-center mt-4"
              >
                Go to sign in
              </a>
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
              shopCode={shopCode}
              setShopCode={setShopCode}
              ownerName={ownerName}
              setOwnerName={setOwnerName}
              whatsapp={whatsapp}
              setWhatsapp={setWhatsapp}
              error={error}
              loading={loading}
              onSubmit={handleSetup}
            />
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <a href="/login" className="text-orange-500 font-medium">
            Sign in
          </a>
        </p>
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
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Step 1 of 2 — Create your login details
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Choose a password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? 'Creating account…' : 'Continue'}
      </button>
    </form>
  )
}

// ── Step 2: Shop setup ───────────────────────────────────────

function ShopSetupForm({
  shopName, setShopName, shopCode, setShopCode,
  ownerName, setOwnerName, whatsapp, setWhatsapp,
  error, loading, onSubmit,
}: {
  shopName: string; setShopName: (v: string) => void
  shopCode: string; setShopCode: (v: string) => void
  ownerName: string; setOwnerName: (v: string) => void
  whatsapp: string; setWhatsapp: (v: string) => void
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Step 2 of 2 — Tell us about your shop
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop name</label>
        <input
          type="text"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="e.g. Mlungu General Store"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop code</label>
        <input
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="e.g. MLUNGU01"
          required
          minLength={6}
          maxLength={10}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base uppercase tracking-wider"
        />
        <p className="text-xs text-gray-400 mt-1">
          Your tellers use this code to log in. 6–10 letters and numbers.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="e.g. Sipho"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          This is how you appear in the teller list when you serve customers yourself.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp number <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+27821234567"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          For daily sales summaries and low stock alerts.
        </p>
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? 'Creating your shop…' : 'Create my shop'}
      </button>
    </form>
  )
}
