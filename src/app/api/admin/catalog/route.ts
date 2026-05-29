import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { adminCatalogSearchSchema, adminCatalogEntrySchema } from '@/lib/validation/schemas'
import { listCatalogEntries, createCatalogEntry } from '@/lib/db/catalog'
import { checkRateLimit } from '@/lib/utils/rateLimit'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = adminCatalogSearchSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const { entries, total } = await listCatalogEntries(parsed.data)
    return NextResponse.json({
      entries,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    })
  } catch (err) {
    console.error('Admin catalog list error:', err)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { limited } = await checkRateLimit(request, { limit: 30, windowSecs: 60 })
  if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = adminCatalogEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  try {
    const entry = await createCatalogEntry(parsed.data.barcode, parsed.data.name, parsed.data.category)
    return NextResponse.json(entry, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'Barcode already exists in catalog' }, { status: 409 })
    }
    console.error('Admin catalog create error:', err)
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
  }
}
