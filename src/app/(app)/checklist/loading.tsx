import { Skeleton } from '@/components/Skeleton'

export default function ChecklistLoading() {
  return (
    <main className="px-4 pt-10 pb-32 max-w-lg mx-auto">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <Skeleton className="h-32 rounded-2xl mb-4" />
      <Skeleton className="h-32 rounded-2xl mb-4" />
      <Skeleton className="h-24 rounded-2xl mb-4" />
    </main>
  )
}
