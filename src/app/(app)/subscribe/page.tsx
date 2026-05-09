'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SubscriptionInfo } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'

export default function SubscribePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const { t, tPlural, locale } = useTranslation('settings')

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
        alert(err.error || t('subscribe_error_generic'))
        setSubmitting(false)
        return
      }
      const data = await res.json()
      setCheckoutData(data)
    } catch {
      alert(t('subscribe_error_connect'))
      setSubmitting(false)
    }
  }

  const localeTag = locale === 'en' ? 'en-ZA' : locale

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return t('subscribe_soon')
    return new Date(dateStr).toLocaleDateString(localeTag, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  if (status === 'success') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('subscribe_success_title')}</h1>
          <p className="text-gray-600">
            {t('subscribe_success_desc')}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-full bg-brand py-3 text-white font-semibold hover:bg-brand-hover transition-colors"
          >
            {t('subscribe_btn_goto_dashboard')}
          </button>
        </div>
      </main>
    )
  }

  if (status === 'cancelled') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('subscribe_cancelled_title')}</h1>
          <p className="text-gray-600">
            {t('subscribe_cancelled_desc')}
          </p>
          <button
            onClick={() => router.replace('/subscribe')}
            className="w-full rounded-full bg-brand py-3 text-white font-semibold hover:bg-brand-hover transition-colors"
          >
            {t('subscribe_btn_try_again')}
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
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
        <h1 className="text-2xl font-bold text-gray-900 text-center">{t('subscribe_page_title')}</h1>

        <div className="rounded-2xl bg-white p-6 border border-gray-100 space-y-3">
          {isTrialing && (
            <>
              <span className="inline-block rounded-full bg-brand-light px-3 py-1 text-sm font-medium text-brand-hover">
                {t('sub_free_trial')}
              </span>
              <p className="text-gray-700">
                {tPlural('subscribe_trial_days_left', subInfo!.daysRemaining!, { count: subInfo!.daysRemaining! })}
              </p>
            </>
          )}

          {isActive && (
            <>
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                {t('sub_active')}
              </span>
              <p className="text-gray-700">
                {t('subscribe_renews_on', { date: formatDate(subInfo!.subscriptionEndsAt) })}
              </p>
            </>
          )}

          {isCancelled && (
            <>
              <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                {t('sub_cancelled')}
              </span>
              <p className="text-gray-700">
                {t('subscribe_access_ends', { date: formatDate(subInfo!.subscriptionEndsAt) })}
              </p>
            </>
          )}

          {isExpired && (
            <>
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                {t('sub_expired')}
              </span>
              <p className="text-gray-700">
                {subInfo?.status === 'trialing'
                  ? t('subscribe_trial_ended')
                  : t('subscribe_expired_desc')}
                {' '}{t('subscribe_expired_cta')}
              </p>
            </>
          )}
        </div>

        {!isActive && (
          <div className="rounded-2xl bg-white p-6 border border-gray-100 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 uppercase tracking-wide font-medium">{t('subscribe_price_title')}</p>
              <p className="mt-2">
                <span className="text-4xl font-bold text-gray-900">R349.99</span>
                <span className="text-gray-500">{t('subscribe_price_month')}</span>
              </p>
            </div>

            <ul className="space-y-2 text-sm text-gray-600">
              {[
                'subscribe_feature_scan',
                'subscribe_feature_stock',
                'subscribe_feature_summary',
                'subscribe_feature_dashboard',
                'subscribe_feature_tellers',
              ].map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t(key)}
                </li>
              ))}
            </ul>

            <button
              onClick={handleSubscribe}
              disabled={submitting}
              className="w-full rounded-full bg-brand py-3.5 text-white font-semibold hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? t('subscribe_btn_redirecting') : t('subscribe_btn_subscribe')}
            </button>

            <p className="text-center text-xs text-gray-400">
              {t('subscribe_payment_methods')}
            </p>
          </div>
        )}

        {isActive && (
          <button
            onClick={() => router.push('/settings')}
            className="w-full rounded-xl bg-gray-100 py-3 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
          >
            {t('subscribe_btn_goto_settings')}
          </button>
        )}
      </div>

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
