/**
 * Phase 37d — Landlord Affidavit template PDF.
 *
 * Pre-fills the shop address (from settings) and the owner's name. The
 * landlord's name, ID, address, signature and the Commissioner of Oaths
 * stamp are all blank — those are filled in offline at the police station.
 */

import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getOwnerProfileReportData } from '@/lib/db/owner-profile-report'
import { formatSAST } from '@/lib/utils/date'
import { drawFooter, drawHeader, pdfFilename, pdfResponse } from '@/lib/pdf/shared'

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
    const pageWidth = doc.internal.pageSize.getWidth()
    const now = new Date()

    let y = drawHeader(doc, {
      title: 'AFFIDAVIT',
      subtitle: 'Permission to Operate a Business',
      meta: [`Generated ${formatSAST(now, 'dd MMMM yyyy')}`],
    })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('I, the undersigned,', 14, y)
    y += 10

    const drawBlank = (label: string, hint: string) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, 14, y)
      doc.setDrawColor(150)
      doc.line(60, y + 0.5, pageWidth - 14, y + 0.5)
      y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120)
      doc.text(hint, 60, y)
      doc.setTextColor(0)
      y += 8
    }

    drawBlank('Full name', '(landlord — fill in)')
    drawBlank('ID number', '(landlord — fill in)')
    drawBlank('Residential address', '(landlord — fill in)')

    y += 4
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('do hereby declare under oath that:', 14, y)
    y += 8

    const para = (text: string) => {
      const lines = doc.splitTextToSize(text, pageWidth - 28)
      doc.text(lines, 14, y)
      y += 6 * lines.length + 3
    }

    doc.setFontSize(10)
    para(
      `1. I am the owner / authorised representative of the property located at:\n     ${data.shop.location ?? '[shop address — please update in Movestock Settings]'}`,
    )
    para(
      `2. I grant permission to ${data.ownerName ?? '[owner — update your account name in Settings]'} to operate a spaza shop / retail business on the above-mentioned property.`,
    )
    para('3. I am aware of the nature of the business to be conducted on my property.')
    para(
      '4. I understand that this affidavit may be submitted to the local municipality as part of a trading permit application.',
    )

    y += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Signature of property owner:', 14, y)
    y += 12
    doc.setDrawColor(150)
    doc.line(14, y, pageWidth - 14, y)
    y += 12

    doc.setFont('helvetica', 'bold')
    doc.text('Date:', 14, y)
    doc.setDrawColor(150)
    doc.line(35, y + 0.5, 100, y + 0.5)
    y += 14

    doc.text('Commissioner of Oaths:', 14, y)
    y += 12
    doc.line(14, y, pageWidth - 14, y)
    y += 12
    doc.text('Stamp:', 14, y)
    y += 4

    // Instructions block
    y += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Instructions:', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    const steps = [
      '1. Print this document.',
      '2. Have your landlord fill in their details and sign.',
      '3. Take it to your nearest police station to be commissioned (stamped) — this service is free.',
      '4. Submit with your trading permit application.',
    ]
    for (const s of steps) {
      doc.text(s, 14, y)
      y += 5
    }

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('landlord-affidavit', now))
  } catch (err) {
    console.error('Landlord affidavit PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
