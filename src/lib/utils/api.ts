import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/**
 * Parse JSON body and validate against a Zod schema.
 * Returns parsed data on success, or a NextResponse error.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T | NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }
  return parsed.data
}
