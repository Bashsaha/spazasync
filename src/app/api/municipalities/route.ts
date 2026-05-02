import { NextResponse } from 'next/server'
import { listMunicipalities } from '@/lib/db/municipalities'

/**
 * GET /api/municipalities
 *
 * Public-readable reference data (RLS allows SELECT to anyone). Used by the
 * area picker on /onboarding and by Screen 3 of the compliance-onboarding modal.
 */
export async function GET() {
  const rows = await listMunicipalities()
  return NextResponse.json({
    municipalities: rows.map((m) => ({
      id: m.id,
      name: m.name,
      short_name: m.short_name,
      province: m.province,
    })),
  })
}
