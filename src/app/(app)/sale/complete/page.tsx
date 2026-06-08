'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { Check, WifiOff } from 'lucide-react'
import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'
import { useUserRole } from '@/hooks/useUserRole'
import { Button, LinkButton, Callout } from '@/components/ui'

function SaleCompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation('sale')
  const role = useUserRole()

  const totalRaw = searchParams.get('total')
  const total = totalRaw ? parseFloat(totalRaw) : 0
  const isOffline = searchParams.get('offline') === '1'
  const hadNoName = searchParams.get('noname') === '1'

  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
      {/* icon changes based on online/offline */}
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
          isOffline ? 'bg-amber-100' : 'bg-green-100'
        }`}
      >
        {isOffline ? (
          <WifiOff className="w-9 h-9 text-amber-700" strokeWidth={2} />
        ) : (
          <Check className="w-10 h-10 text-green-700" strokeWidth={2.5} />
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {isOffline ? t('complete_title_offline') : t('complete_title')}
      </h1>

      {isOffline ? (
        <p className="text-gray-500 text-sm mb-2 max-w-xs leading-relaxed">
          {t('complete_offline_text')}
        </p>
      ) : (
        <p className="text-gray-500 text-sm mb-2">{t('complete_total_label')}</p>
      )}

      <p className="text-4xl font-bold text-gray-900 mb-10">{formatZAR(total)}</p>

      {/* Nudge owners to turn no-name sales into real products over time
          (Phase 47). Tellers can't manage products, so it's owner/admin-only. */}
      {hadNoName && role !== 'teller' && (
        <Callout tone="info" className="max-w-xs mb-8 text-left">
          {t('noname_nudge')}
          <LinkButton href="/products" variant="outline" size="sm" className="mt-3">
            {t('noname_nudge_cta')}
          </LinkButton>
        </Callout>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => router.push('/sale')}
        className="max-w-xs"
      >
        {t('btn_new_sale')}
      </Button>

      {/* Tellers have no dashboard — their only home is the sale flow, so the
          "Go to dashboard" link is owner/admin-only. */}
      {role !== 'teller' && (
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-sm text-gray-500 active:text-gray-700"
        >
          {t('btn_go_dashboard')}
        </button>
      )}
    </main>
  )
}

function SaleCompleteFallback() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading…</p>
    </main>
  )
}

export default function SaleCompletePage() {
  return (
    <Suspense fallback={<SaleCompleteFallback />}>
      <SaleCompleteContent />
    </Suspense>
  )
}
