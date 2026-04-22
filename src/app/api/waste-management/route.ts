import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { upsertWasteManagementSchema } from '@/lib/validation/schemas'
import { getWasteManagement, upsertWasteManagement } from '@/lib/db/waste-management'

/** GET /api/waste-management — fetch the singleton row (or null if not set). */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const waste = await getWasteManagement()
  return NextResponse.json({ waste })
}

/** PUT /api/waste-management — create or update the arrangement. */
export async function PUT(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, upsertWasteManagementSchema)
  if (parsed instanceof NextResponse) return parsed

  try {
    const waste = await upsertWasteManagement(parsed)
    return NextResponse.json(waste)
  } catch (err) {
    console.error('Failed to save waste management:', err)
    return NextResponse.json({ error: 'Could not save arrangement' }, { status: 500 })
  }
}
