'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildTellerEmail } from '@/lib/auth/teller'

type Tab = 'owner' | 'teller'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('owner')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / App name */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-orange-500">SpazaSync</h1>
          <p className="text-gray-500 mt-1 text-sm">Your shop, in your pocket</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-6">
          <button
            onClick={() => setTab('owner')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'owner'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I&apos;m the owner
          </button>
          <button
            onClick={() => setTab('teller')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'teller'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            I&apos;m a teller
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
      </div>
    </div>
  )
}

// ── Owner login ──────────────────────────────────────────────

function OwnerLoginForm({ onSuccess }: { onSuccess: () => void }) {
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
      setError('Wrong email or password. Please try again.')
      setLoading(false)
      return
    }

    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-gray-500">
        New here?{' '}
        <a href="/onboarding" className="text-orange-500 font-medium">
          Create your shop
        </a>
      </p>
    </form>
  )
}

// ── Teller login ─────────────────────────────────────────────

function TellerLoginForm({ onSuccess }: { onSuccess: () => void }) {
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
        setError(msg ?? 'Could not find your account. Check your shop code and name.')
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
        setError('Wrong password. Please try again.')
        setLoading(false)
        return
      }

      onSuccess()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shop code</label>
        <input
          type="text"
          value={shopCode}
          onChange={(e) => setShopCode(e.target.value.toUpperCase())}
          placeholder="e.g. CAPE99"
          required
          maxLength={10}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base uppercase tracking-wider"
        />
        <p className="text-xs text-gray-400 mt-1">Ask your shop owner for this code</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Maria"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"
        />
        <p className="text-xs text-gray-400 mt-1">Your owner set this password for you</p>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange-500 text-white font-semibold py-3 rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors disabled:opacity-50 text-base min-h-[48px]"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
