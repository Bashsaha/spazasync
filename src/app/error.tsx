'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang="en">
      <body className="antialiased bg-gray-50 text-gray-900">
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            The app hit an unexpected error. Your sales and stock data are safe.
          </p>
          <button
            onClick={reset}
            autoFocus
            className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl active:bg-orange-600"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
