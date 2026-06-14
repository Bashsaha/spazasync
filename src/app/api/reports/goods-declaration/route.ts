/**
 * Phase 37d — Goods Declaration Affidavit template PDF.
 *
 * A blank standard template — nothing is pre-filled. The owner writes in
 * their name, ID, and business address by hand (Design Rule 6) before the
 * police station Commissioner stamps the affidavit.
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
      subtitle: 'Declaration of Legal Trading',
      meta: [`Generated ${formatSAST(now, 'dd MMMM yyyy')}`],
    })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('I, the undersigned,', 14, y)
    y += 10

    // Blank standard template — every field is filled in by hand (Design Rule 6).
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

    drawBlank('Full name', '(fill in)')
    drawBlank('ID number', '(fill in)')
    drawBlank('Business address', '(fill in)')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    doc.text('do hereby declare under oath that:', 14, y)
    y += 8

    const para = (text: string) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0)
      const lines = doc.splitTextToSize(text, pageWidth - 28)
      doc.text(lines, 14, y)
      y += 6 * lines.length + 3
    }
    para(
      '1. I am not engaged in the trade of illegal goods as defined in applicable national legislation and municipal by-laws.',
    )
    para(
      '2. My business operates, and will continue to operate, according to applicable norms and standards.',
    )
    para(
      '3. All goods sold in my business are legally sourced and comply with health and safety regulations.',
    )
    para(
      '4. I understand that providing false information in this affidavit is a criminal offence.',
    )

    y += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Signature:', 14, y)
    y += 12
    doc.setDrawColor(150)
    doc.line(14, y, pageWidth - 14, y)
    y += 12

    doc.text('Date:', 14, y)
    doc.line(35, y + 0.5, 100, y + 0.5)
    y += 14

    doc.text('Commissioner of Oaths:', 14, y)
    y += 12
    doc.line(14, y, pageWidth - 14, y)
    y += 12
    doc.text('Stamp:', 14, y)
    y += 4

    y += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Instructions:', 14, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    const steps = [
      '1. Print this document.',
      '2. Fill in your ID number.',
      '3. Sign it.',
      '4. Take it to your nearest police station to be commissioned (stamped) — this service is free.',
      '5. Submit with your trading permit application.',
    ]
    for (const s of steps) {
      doc.text(s, 14, y)
      y += 5
    }

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('goods-declaration', now))
  } catch (err) {
    console.error('Goods declaration PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
