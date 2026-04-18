import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createSupplierSchema } from '@/lib/validation/schemas'
import { listSuppliers, createSupplier } from '@/lib/db/suppliers'

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const suppliers = await listSuppliers()
  return NextResponse.json(suppliers)
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createSupplierSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supplier = await createSupplier(parsed)
    return NextResponse.json(supplier, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create supplier'
    if (message.includes('idx_suppliers_name_unique') || message.includes('23505')) {
      return NextResponse.json({ error: 'You already have a supplier with that name' }, { status: 409 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
