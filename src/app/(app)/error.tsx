'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        The app hit an unexpected error. Your sales and stock data are safe.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          autoFocus
          className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl active:bg-orange-600"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="text-center text-orange-500 font-semibold px-6 py-3 rounded-xl border border-orange-200 active:bg-orange-50"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
