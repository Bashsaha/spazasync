import { Skeleton } from '@/components/Skeleton'

export default function InspectionLoading() {
  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />

      <Skeleton className="h-36 rounded-2xl mb-4" />
      <Skeleton className="h-20 rounded-2xl mb-4" />
      <Skeleton className="h-72 rounded-2xl mb-4" />
      <Skeleton className="h-56 rounded-2xl" />
    </main>
  )
}
