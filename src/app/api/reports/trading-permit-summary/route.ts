/**
 * Phase 37d — Trading Permit Application Summary PDF.
 *
 * Pre-fills everything we know from the owner's Movestock profile so they can
 * copy the values onto whatever form their municipality uses (the form layout
 * differs by municipality, hence the deliberate "transfer onto your form"
 * framing rather than reproducing any particular form).
 *
 * Per Design Rule 6: ID/passport fields are rendered as blank lines with a
 * "fill in yourself" hint — we never embed the value even if a future
 * migration adds it to owner_profiles.
 */

import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getOwnerProfileReportData } from '@/lib/db/owner-profile-report'
import { formatSAST } from '@/lib/utils/date'
import {
  assertNoSensitiveValues,
  drawFooter,
  drawFormRows,
  drawHeader,
  drawSectionHeading,
  pdfFilename,
  pdfResponse,
  type FormRow,
} from '@/lib/pdf/shared'

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  try {
    const data = await getOwnerProfileReportData(auth.shopId, auth.user.id)
    if (!data) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now = new Date()

    let y = drawHeader(doc, {
      title: 'Trading Permit Application — Your Details',
      subtitle: data.shop.name,
      meta: [
        `Generated ${formatSAST(now, 'dd MMMM yyyy')}`,
        data.areaLabel ? `Area: ${data.areaLabel}` : '',
      ].filter(Boolean) as string[],
    })

    // Intro
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(
      "Transfer this information to your municipality's trading permit application form.",
      14,
      y,
      { maxWidth: doc.internal.pageSize.getWidth() - 28 },
    )
    doc.setTextColor(0)
    y += 8

    // ── OWNER DETAILS ──
    y = drawSectionHeading(doc, y, 'Owner details')
    const ownerRows: FormRow[] = [
      { label: 'Full name', value: data.ownerName, hint: data.ownerName ? null : 'Add in Settings' },
      { label: 'ID / Passport number', value: null, blank: true, hint: '(fill in yourself)' },
      { label: 'Phone', value: data.shop.whatsapp_number, hint: data.shop.whatsapp_number ? null : 'Add in Settings' },
      { label: 'Email', value: data.ownerEmail },
      {
        label: 'Residential address',
        value: null,
        blank: true,
        hint: '(fill in yourself if different from shop address)',
      },
    ]
    assertNoSensitiveValues(ownerRows)
    y = drawFormRows(doc, y, ownerRows)

    // ── BUSINESS DETAILS ──
    y = drawSectionHeading(doc, y + 4, 'Business details')
    const businessRows: FormRow[] = [
      { label: 'Shop name', value: data.shop.name },
      { label: 'Shop address', value: data.shop.location, hint: data.shop.location ? null : 'Add in Settings' },
      { label: 'Type of business', value: 'Spaza shop / Retail' },
      { label: 'Goods sold', value: data.goodsDescription },
      { label: 'Trading hours', value: '07:00 – 21:00 (adjust if different)' },
    ]
    y = drawFormRows(doc, y, businessRows)

    // ── PREMISES ──
    y = drawSectionHeading(doc, y + 4, 'Premises')
    const premisesRows: FormRow[] = [
      { label: 'Ownership', value: null, blank: true, hint: 'Tick: Owned / Rented' },
      { label: 'Landlord name', value: null, blank: true, hint: '(if rented)' },
      { label: 'Landlord contact', value: null, blank: true, hint: '(if rented)' },
    ]
    y = drawFormRows(doc, y, premisesRows)

    // ── DECLARATION ──
    y = drawSectionHeading(doc, y + 4, 'Declaration')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(
      doc.splitTextToSize(
        'I declare that I am not engaged in the trade of illegal goods as defined in applicable by-laws and that my business will operate according to applicable norms and standards.',
        doc.internal.pageSize.getWidth() - 28,
      ),
      14,
      y,
    )
    y += 16

    doc.setDrawColor(150)
    doc.line(14, y, 90, y)
    doc.line(110, y, 180, y)
    y += 4
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text('Signature', 14, y)
    doc.text('Date', 110, y)
    doc.setTextColor(0)
    y += 12

    // Footer note
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(120)
    doc.text(
      doc.splitTextToSize(
        "This summary was generated from your Movestock profile. Bring your ID/passport and all supporting documents listed in your Movestock compliance journey.",
        doc.internal.pageSize.getWidth() - 28,
      ),
      14,
      y,
    )
    doc.setTextColor(0)

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('trading-permit-summary', now))
  } catch (err) {
    console.error('Trading permit summary PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
