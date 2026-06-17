import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { listAllLeads } from '@/lib/db/field-sales'
import { groupByArea } from '@/lib/field-sales/logic'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const leads = await listAllLeads()
    return NextResponse.json({ areas: groupByArea(leads), total: leads.length })
  } catch (err) {
    console.error('Field-sales areas error:', err)
    return NextResponse.json({ error: 'Failed to load areas' }, { status: 500 })
  }
}
