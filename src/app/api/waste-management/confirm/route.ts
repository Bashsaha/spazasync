import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { confirmWasteStillActive, getWasteManagement } from '@/lib/db/waste-management'

/** POST /api/waste-management/confirm — stamp last_confirmed_date = today (SAST). */
export async function POST() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getWasteManagement()
  if (!existing) {
    return NextResponse.json(
      { error: 'Set up your waste arrangement first' },
      { status: 400 },
    )
  }

  try {
    const waste = await confirmWasteStillActive()
    return NextResponse.json(waste)
  } catch (err) {
    console.error('Failed to confirm waste arrangement:', err)
    return NextResponse.json({ error: 'Could not confirm arrangement' }, { status: 500 })
  }
}
