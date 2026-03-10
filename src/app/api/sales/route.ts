import { NextResponse } from 'next/server'
import { completeSale } from '@/lib/db/sales'
import { completeSaleSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = completeSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  try {
    const sale = await completeSale(parsed.data)
    return NextResponse.json(sale, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to complete sale'

    // stock_qty >= 0 constraint violation
    if (message.includes('stock_qty') || message.includes('check')) {
      return NextResponse.json(
        { error: 'Not enough stock for one or more items.' },
        { status: 422 },
      )
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
