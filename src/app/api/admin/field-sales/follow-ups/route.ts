import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { listDueFollowUps } from '@/lib/db/field-sales'

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const leads = await listDueFollowUps()
    return NextResponse.json({ leads })
  } catch (err) {
    console.error('Field-sales follow-ups error:', err)
    return NextResponse.json({ error: 'Failed to load follow-ups' }, { status: 500 })
  }
}
