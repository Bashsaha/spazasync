import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { listBusinessDocuments } from '@/lib/db/business-documents'

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docs = await listBusinessDocuments()
  return NextResponse.json(docs)
}
