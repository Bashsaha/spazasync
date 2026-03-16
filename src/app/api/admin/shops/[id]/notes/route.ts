import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { adminUpdateNotesSchema } from '@/lib/validation/schemas'
import { updateShopNotes } from '@/lib/db/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = adminUpdateNotesSchema.safeParse({ ...body as Record<string, unknown>, shop_id: id })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    await updateShopNotes(id, parsed.data.admin_notes)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin update notes error:', err)
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
  }
}
