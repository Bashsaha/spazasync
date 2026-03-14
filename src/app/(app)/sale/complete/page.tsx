'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { formatZAR } from '@/lib/utils/currency'

function SaleCompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

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
        {isOffline ? 'Sale Saved' : 'Sale Complete'}
      </h1>

      {isOffline ? (
        <p className="text-gray-500 text-sm mb-2 max-w-xs leading-relaxed">
          You&apos;re offline. This sale is saved on your phone and will sync to the
          server automatically when you reconnect.
        </p>
      ) : (
        <p className="text-gray-500 text-sm mb-2">Total charged</p>
      )}

      <p className="text-4xl font-bold text-gray-900 mb-10">{formatZAR(total)}</p>

      <button
        onClick={() => router.push('/sale')}
        className="w-full max-w-xs bg-blue-600 text-white font-semibold py-4 rounded-2xl active:bg-blue-700 text-base"
      >
        New Sale
      </button>

      <button
        onClick={() => router.push('/dashboard')}
        className="mt-4 text-sm text-gray-500 active:text-gray-700"
      >
        Go to Dashboard
      </button>
    </main>
  )
}

export default function SaleCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">Loading…</p>
        </main>
      }
    >
      <SaleCompleteContent />
    </Suspense>
  )
}
