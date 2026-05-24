import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { checkRateLimit } from '@/lib/utils/rateLimit'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Soft-deletes a teller (sets active=false). 20 per IP per minute is
  // generous for an owner managing their roster and blocks abuse loops.
  if (checkRateLimit(request, { limit: 20, windowSecs: 60 }).limited) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  const { id } = await params
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user, supabase } = auth

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only owners can manage tellers' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tellers')
    .update({ active: false })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Teller not found' }, { status: 404 })
  return NextResponse.json(data)
}
