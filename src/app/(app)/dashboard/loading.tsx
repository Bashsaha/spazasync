import { Skeleton } from '@/components/Skeleton'

export default function DashboardLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <Skeleton className="h-8 w-40 mb-1" />
      <Skeleton className="h-4 w-56 mb-6" />

      {/* Today summary */}
      <Skeleton className="h-24 rounded-2xl mb-4" />

      {/* Weekly chart */}
      <Skeleton className="h-48 rounded-2xl mb-4" />

      {/* Nav cards */}
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 rounded-2xl mb-3" />
      ))}
    </main>
  )
}
