import { Skeleton } from '@/components/Skeleton'

export default function StockLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <Skeleton className="h-8 w-24 mb-6" />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-11 rounded-xl mb-3" />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Product rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl mb-2" />
      ))}
    </main>
  )
}
