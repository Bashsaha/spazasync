import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, supabase } = auth

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner') return NextResponse.json({ error: 'Only owners can manage tellers' }, { status: 403 })

  const { data, error } = await supabase
    .from('tellers')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Teller not found' }, { status: 404 })
  return NextResponse.json(data)
}
