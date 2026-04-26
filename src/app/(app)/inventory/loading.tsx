import { Skeleton } from '@/components/Skeleton'

export default function InventoryLoading() {
  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-4 w-56 mb-5" />
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
    </main>
  )
}
