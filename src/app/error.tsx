'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

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
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" strokeWidth={1.75} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            The app hit an unexpected error. Your sales and stock data are safe.
          </p>
          <button
            onClick={reset}
            autoFocus
            className="bg-brand text-white font-semibold px-6 py-3 rounded-full active:bg-brand-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
