import { Skeleton } from '@/components/Skeleton'

export default function DocumentsLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-20 rounded-2xl mb-6" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </main>
  )
}
