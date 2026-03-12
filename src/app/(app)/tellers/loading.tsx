import { Skeleton } from '@/components/Skeleton'

export default function TellersLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-16 rounded-xl" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl mb-2" />
      ))}
    </main>
  )
}
