import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { updateSupplierSchema } from '@/lib/validation/schemas'
import { getSupplier, updateSupplier, deleteSupplier } from '@/lib/db/suppliers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supplier = await getSupplier(id)
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
  return NextResponse.json(supplier)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const parsed = await parseBody(request, updateSupplierSchema)
  if (parsed instanceof NextResponse) return parsed

  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supplier = await updateSupplier(id, parsed)
    return NextResponse.json(supplier)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed'
    if (message.includes('idx_suppliers_name_unique') || message.includes('23505')) {
      return NextResponse.json({ error: 'You already have a supplier with that name' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Supplier not found or update failed' }, { status: 404 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteSupplier(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
