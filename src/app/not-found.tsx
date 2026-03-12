import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        We could not find what you were looking for.
      </p>
      <Link
        href="/dashboard"
        className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-xl active:bg-orange-600"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
