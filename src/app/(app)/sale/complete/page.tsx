'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { formatCurrency } from '@/lib/utils/currency'

function SaleCompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const totalRaw = searchParams.get('total')
  const total = totalRaw ? parseFloat(totalRaw) : 0

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      {/* success icon */}
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <span className="text-4xl">✓</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sale Complete</h1>
      <p className="text-gray-500 text-sm mb-2">Total charged</p>
      <p className="text-4xl font-bold text-gray-900 mb-10">{formatCurrency(total)}</p>

      <button
        onClick={() => router.push('/sale')}
        className="w-full max-w-xs bg-orange-500 text-white font-semibold py-4 rounded-2xl active:bg-orange-600 text-base"
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
