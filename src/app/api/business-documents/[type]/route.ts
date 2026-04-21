import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import {
  DOCUMENT_TYPES,
  upsertBusinessDocumentSchema,
} from '@/lib/validation/schemas'
import {
  getBusinessDocument,
  upsertBusinessDocument,
  deleteBusinessDocument,
} from '@/lib/db/business-documents'
import type { DocumentType } from '@/types'

function isValidType(raw: string): raw is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(raw)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
  }

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const doc = await getBusinessDocument(type)
  if (!doc) return NextResponse.json({ error: 'Not logged' }, { status: 404 })
  return NextResponse.json(doc)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
  }

  const parsed = await parseBody(request, upsertBusinessDocumentSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const doc = await upsertBusinessDocument(type, parsed)
    return NextResponse.json(doc)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isValidType(type)) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })
  }

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteBusinessDocument(type)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
