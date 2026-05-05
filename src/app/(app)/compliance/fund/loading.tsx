import { Skeleton } from '@/components/Skeleton'

export default function FundLoading() {
  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <Skeleton className="h-8 w-40 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />
      <Skeleton className="h-32 rounded-2xl mb-4" />
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </main>
  )
}
