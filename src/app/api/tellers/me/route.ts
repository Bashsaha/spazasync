import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/tellers/me
 * Returns the teller record for the currently logged-in teller.
 * Used by useActiveTeller hook to auto-select the teller on their own device.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tellers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Teller record not found' }, { status: 404 })
  return NextResponse.json(data)
}
