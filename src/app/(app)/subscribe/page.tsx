'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, CreditCard, ChevronRight, ShieldCheck } from 'lucide-react'
import type { SubscriptionInfo } from '@/types'
import { useTranslation } from '@/components/LanguageProvider'
import { Button, Card, Callout, PageHeader, Badge, LinkCard, cx } from '@/components/ui'

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

  async function handlePayfast() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscribe/checkout', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
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
            <ShieldCheck className="h-8 w-8 text-green-600" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('subscribe_success_title')}</h1>
          <p className="text-gray-600">{t('subscribe_success_desc')}</p>
          <Button fullWidth size="lg" onClick={() => router.push('/dashboard')}>
            {t('subscribe_btn_goto_dashboard')}
          </Button>
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
          <p className="text-gray-600">{t('subscribe_cancelled_desc')}</p>
          <Button fullWidth size="lg" onClick={() => router.replace('/subscribe')}>
            {t('subscribe_btn_try_again')}
          </Button>
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
    <main className="min-h-screen p-6 pt-12 pb-32">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <PageHeader title={t('subscribe_page_title')} />

        <Card className="space-y-3">
          {isTrialing && (
            <>
              <Badge tone="brand">{t('sub_free_trial')}</Badge>
              <p className="text-gray-700">
                {tPlural('subscribe_trial_days_left', subInfo!.daysRemaining!, {
                  count: subInfo!.daysRemaining!,
                })}
              </p>
            </>
          )}

          {isActive && (
            <>
              <Badge tone="green">{t('sub_active')}</Badge>
              <p className="text-gray-700">
                {t('subscribe_renews_on', { date: formatDate(subInfo!.subscriptionEndsAt) })}
              </p>
            </>
          )}

          {isCancelled && (
            <>
              <Badge tone="amber">{t('sub_cancelled')}</Badge>
              <p className="text-gray-700">
                {t('subscribe_access_ends', { date: formatDate(subInfo!.subscriptionEndsAt) })}
              </p>
            </>
          )}

          {isExpired && (
            <>
              <Badge tone="red">{t('sub_expired')}</Badge>
              <p className="text-gray-700">
                {subInfo?.status === 'trialing'
                  ? t('subscribe_trial_ended')
                  : t('subscribe_expired_desc')}{' '}
                {t('subscribe_expired_cta')}
              </p>
            </>
          )}
        </Card>

        {!isActive && (
          <>
            <Card>
              <div className="text-center">
                <p className="text-xs uppercase tracking-wide font-medium text-gray-500">
                  {t('subscribe_price_title')}
                </p>
                <p className="mt-2">
                  <span className="text-4xl font-bold text-gray-900">R349.99</span>
                  <span className="text-gray-500">{t('subscribe_price_month')}</span>
                </p>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                {[
                  'subscribe_feature_scan',
                  'subscribe_feature_stock',
                  'subscribe_feature_summary',
                  'subscribe_feature_dashboard',
                  'subscribe_feature_tellers',
                ].map((key) => (
                  <li key={key} className="flex items-start gap-2">
                    <svg
                      className="h-5 w-5 text-brand shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {t(key)}
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700 px-1">
                {t('subscribe_choose_method')}
              </p>

              <LinkCard
                href="/subscribe/eft"
                padding="md"
                aria-label={t('subscribe_method_eft_title')}
              >
                <PaymentMethodRow
                  icon={Building2}
                  title={t('subscribe_method_eft_title')}
                  desc={t('subscribe_method_eft_desc')}
                />
              </LinkCard>

              <button
                type="button"
                onClick={handlePayfast}
                disabled={submitting}
                aria-label={t('subscribe_method_payfast_title')}
                className={cx(
                  'w-full text-left bg-white border border-line rounded-2xl p-4 min-h-touch',
                  'active:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                <PaymentMethodRow
                  icon={CreditCard}
                  title={t('subscribe_method_payfast_title')}
                  desc={
                    submitting
                      ? t('subscribe_btn_redirecting')
                      : t('subscribe_method_payfast_desc')
                  }
                />
              </button>
            </div>

            <Callout tone="info">{t('subscribe_payment_safety')}</Callout>
          </>
        )}

        {isActive && (
          <Button
            fullWidth
            variant="outline"
            size="lg"
            onClick={() => router.push('/settings')}
          >
            {t('subscribe_btn_goto_settings')}
          </Button>
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

interface PaymentMethodRowProps {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  desc: string
}

function PaymentMethodRow({ icon: Icon, title, desc }: PaymentMethodRowProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light shrink-0">
        <Icon className="h-6 w-6 text-brand-dark" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" aria-hidden />
    </div>
  )
}
