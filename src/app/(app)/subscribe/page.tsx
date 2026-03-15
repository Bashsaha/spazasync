'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SubscriptionInfo } from '@/types'

export default function SubscribePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [checkoutData, setCheckoutData] = useState<{
    params: Record<string, string>
    action: string
  } | null>(null)

  useEffect(() => {
    fetch('/api/subscribe/status')
      .then((r) => r.json())
      .then((data) => setSubInfo(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-submit the PayFast form once checkout data is ready
  useEffect(() => {
    if (checkoutData && formRef.current) {
      formRef.current.submit()
    }
  }, [checkoutData])

  async function handleSubscribe() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscribe/checkout', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      const data = await res.json()
      setCheckoutData(data)
    } catch {
      alert('Could not connect. Please check your internet and try again.')
      setSubmitting(false)
    }
  }

  // Success return from PayFast
  if (status === 'success') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
          <p className="text-gray-600">
            Your subscription is now active. You have full access to SpazaSync.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    )
  }

  // Cancelled return from PayFast
  if (status === 'cancelled') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Cancelled</h1>
          <p className="text-gray-600">
            No worries — you can subscribe any time.
          </p>
          <button
            onClick={() => router.replace('/subscribe')}
            className="w-full rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </main>
    )
  }

  const isExpired =
    subInfo?.status === 'expired' ||
    (subInfo?.status === 'trialing' && subInfo.daysRemaining === 0)

  const isActive = subInfo?.status === 'active'
  const isCancelled = subInfo?.status === 'cancelled'
  const isTrialing = subInfo?.status === 'trialing' && (subInfo.daysRemaining ?? 0) > 0

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Your Plan</h1>

        {/* Status Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-3">
          {isTrialing && (
            <>
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                Free Trial
              </span>
              <p className="text-gray-700">
                You have <span className="font-bold">{subInfo!.daysRemaining} day{subInfo!.daysRemaining !== 1 ? 's' : ''}</span> left on your free trial.
              </p>
            </>
          )}

          {isActive && (
            <>
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                Active
              </span>
              <p className="text-gray-700">
                Your plan renews on{' '}
                <span className="font-medium">
                  {subInfo!.subscriptionEndsAt
                    ? new Date(subInfo!.subscriptionEndsAt).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'soon'}
                </span>
              </p>
            </>
          )}

          {isCancelled && (
            <>
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                Cancelled
              </span>
              <p className="text-gray-700">
                Your access ends on{' '}
                <span className="font-medium">
                  {subInfo!.subscriptionEndsAt
                    ? new Date(subInfo!.subscriptionEndsAt).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'soon'}
                </span>
              </p>
            </>
          )}

          {isExpired && (
            <>
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                Expired
              </span>
              <p className="text-gray-700">
                {subInfo?.status === 'trialing'
                  ? 'Your free trial has ended.'
                  : 'Your subscription has expired.'}
                {' '}Subscribe to continue using SpazaSync.
              </p>
            </>
          )}
        </div>

        {/* Pricing Card */}
        {!isActive && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">SpazaSync Monthly</p>
              <p className="mt-2">
                <span className="text-4xl font-bold text-gray-900">R349.99</span>
                <span className="text-gray-500">/month</span>
              </p>
            </div>

            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Barcode scanning and sales
              </li>
              <li className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Stock management and stock take
              </li>
              <li className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Daily WhatsApp sales summary
              </li>
              <li className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Dashboard with charts and reports
              </li>
              <li className="flex items-start gap-2">
                <svg className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Unlimited tellers
              </li>
            </ul>

            <button
              onClick={handleSubscribe}
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Redirecting to payment...' : 'Subscribe — R349.99/month'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Pay with card, EFT, or SnapScan via PayFast
            </p>
          </div>
        )}

        {/* Active subscription — link to settings */}
        {isActive && (
          <button
            onClick={() => router.push('/settings')}
            className="w-full rounded-xl bg-gray-100 py-3 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
          >
            Go to Settings
          </button>
        )}
      </div>

      {/* Hidden PayFast form — auto-submitted when checkout data is ready */}
      {checkoutData && (
        <form ref={formRef} action={checkoutData.action} method="POST" className="hidden">
          {Object.entries(checkoutData.params).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      )}
    </main>
  )
}
