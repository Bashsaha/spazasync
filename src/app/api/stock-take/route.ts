import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveStockTake } from '@/lib/db/stock-take'
import { stockTakeSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = stockTakeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  try {
    const result = await saveStockTake(parsed.data.entries)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save stock take'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
