import { Skeleton } from '@/components/Skeleton'

export default function ExpiryLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <Skeleton className="h-8 w-40 mb-6" />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>

      {/* Section headers + product cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-6">
          <Skeleton className="h-11 rounded-xl mb-2" />
          <Skeleton className="h-16 rounded-2xl mb-2" />
          <Skeleton className="h-16 rounded-2xl mb-2" />
        </div>
      ))}
    </main>
  )
}
