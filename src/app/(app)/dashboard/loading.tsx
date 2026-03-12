import { Skeleton } from '@/components/Skeleton'

export default function DashboardLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <Skeleton className="h-8 w-40 mb-1" />
      <Skeleton className="h-4 w-56 mb-6" />

      {/* Today summary strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>

      {/* Weekly chart placeholder */}
      <Skeleton className="h-48 rounded-2xl mb-6" />

      {/* Two column cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>

      {/* List rows */}
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl mb-2" />
      ))}
    </main>
  )
}
