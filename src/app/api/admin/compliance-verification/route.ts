/**
 * Phase 41e — Compliance verification log API (admin-only).
 *
 * GET  → latest verification row + days_since (for the admin dashboard widget)
 * POST → record a new verification (button on the widget)
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

interface VerificationRow {
  id: string
  verified_at: string
  verified_by: string | null
  phase: string | null
  notes: string | null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('compliance_verification_log')
    .select('*')
    .order('verified_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('compliance-verification GET failed:', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }

  const row = data as VerificationRow | null
  let daysSince: number | null = null
  if (row) {
    const verifiedMs = Date.parse(row.verified_at)
    const todayMs = Date.now()
    daysSince = Math.floor((todayMs - verifiedMs) / (24 * 60 * 60 * 1000))
  }

  return NextResponse.json({
    latest: row,
    daysSince,
    overdue: daysSince !== null && daysSince >= 30,
  })
}

export async function POST(req: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { phase?: string; notes?: string } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    // Empty body is fine — verification can be recorded with no metadata.
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('compliance_verification_log')
    .insert({
      verified_by: user.id,
      phase: body.phase?.slice(0, 100) ?? null,
      notes: body.notes?.slice(0, 1000) ?? null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('compliance-verification POST failed:', error)
    return NextResponse.json({ error: 'Failed to record' }, { status: 500 })
  }

  return NextResponse.json({ row: data }, { status: 201 })
}
