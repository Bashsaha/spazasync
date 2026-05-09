'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { formatZAR } from '@/lib/utils/currency'
import { useTranslation } from '@/components/LanguageProvider'

function SaleCompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation('sale')

  const totalRaw = searchParams.get('total')
  const total = totalRaw ? parseFloat(totalRaw) : 0
  const isOffline = searchParams.get('offline') === '1'

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      {/* icon changes based on online/offline */}
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
          isOffline ? 'bg-amber-100' : 'bg-green-100'
        }`}
      >
        <span className="text-4xl">{isOffline ? '📶' : '✓'}</span>
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

      <button
        onClick={() => router.push('/sale')}
        className="w-full max-w-xs bg-brand text-white font-semibold py-4 rounded-full active:bg-brand-hover text-base"
      >
        {t('btn_new_sale')}
      </button>

      <button
        onClick={() => router.push('/dashboard')}
        className="mt-4 text-sm text-gray-500 active:text-gray-700"
      >
        {t('btn_go_dashboard')}
      </button>
    </main>
  )
}

function SaleCompleteFallback() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
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
