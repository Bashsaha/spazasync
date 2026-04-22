import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { parseBody } from '@/lib/utils/api'
import { createPestControlLogSchema } from '@/lib/validation/schemas'
import {
  listPestControlLogs,
  createPestControlLog,
  getLastPestVisitDate,
} from '@/lib/db/pest-control'

/** GET /api/pest-control — list visits + most recent visit date (for reminders). */
export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [logs, lastVisitDate] = await Promise.all([
    listPestControlLogs(),
    getLastPestVisitDate(),
  ])

  return NextResponse.json({ logs, lastVisitDate })
}

/** POST /api/pest-control — create a new visit record. */
export async function POST(request: Request) {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(request, createPestControlLogSchema)
  if (parsed instanceof NextResponse) return parsed

  try {
    const log = await createPestControlLog(parsed)
    return NextResponse.json(log, { status: 201 })
  } catch (err) {
    console.error('Failed to create pest control log:', err)
    return NextResponse.json({ error: 'Could not save log' }, { status: 500 })
  }
}
