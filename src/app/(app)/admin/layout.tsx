import AdminNav from '@/components/admin/AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav />
      <main className="px-4 pt-6 pb-12 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  )
}
