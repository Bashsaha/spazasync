import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { getCatalogEntryById, updateCatalogEntry, deleteCatalogEntry } from '@/lib/db/catalog'
import { checkRateLimit } from '@/lib/utils/rateLimit'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional().transform((v) => v?.trim() || null),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const entry = await getCatalogEntryById(id)
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    return NextResponse.json(entry)
  } catch (err) {
    console.error('Admin catalog get error:', err)
    return NextResponse.json({ error: 'Failed to load entry' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const entry = await getCatalogEntryById(id)
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    await updateCatalogEntry(id, parsed.data)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin catalog update error:', err)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params

  try {
    const entry = await getCatalogEntryById(id)
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    await deleteCatalogEntry(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin catalog delete error:', err)
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
  }
}
