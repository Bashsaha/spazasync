'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import LeadForm, { type LeadFormValues } from '@/components/admin/field-sales/LeadForm'

export default function NewLeadPage() {
  const router = useRouter()

  async function handleSubmit(values: LeadFormValues) {
    const res = await fetch('/api/admin/field-sales/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) throw new Error('Could not save the shop. Try again.')
    const { lead } = await res.json()
    router.push(`/admin/field-sales/${lead.id}`)
  }

  return (
    <div>
      <Link
        href="/admin/field-sales"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back
      </Link>
      <PageHeader title="Add shop" subtitle="A shop you've visited or want to visit" />
      <LeadForm submitLabel="Save shop" onSubmit={handleSubmit} />
    </div>
  )
}
