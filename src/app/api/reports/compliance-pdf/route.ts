import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComplianceReportData } from '@/lib/db/compliance-report'
import { formatSAST } from '@/lib/utils/date'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * GET /api/reports/compliance-pdf
 *
 * Generates a compliance report PDF for the authenticated owner's shop.
 * Returns application/pdf with Content-Disposition: attachment.
 */
export async function GET() {
  // Auth check (BUG-004 prevention rule)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shopId = user.app_metadata?.shop_id as string | undefined
  if (!shopId) {
    return NextResponse.json({ error: 'No shop associated' }, { status: 403 })
  }

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  try {
    const data = await getComplianceReportData(shopId)
    const now = new Date()

    // Create PDF (A4 portrait)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15

    // --- Header ---
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Compliance Report', pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(14)
    doc.text(data.shop.name, pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Report date: ${formatSAST(now, 'dd MMMM yyyy, HH:mm')} SAST`, pageWidth / 2, y, {
      align: 'center',
    })
    y += 7

    // Shop details
    doc.setFontSize(9)
    const shopDetails: string[] = [`Shop code: ${data.shop.code}`]
    if (data.shop.registration_number) {
      shopDetails.push(`Registration: ${data.shop.registration_number}`)
    }
    if (data.shop.location) {
      shopDetails.push(`Location: ${data.shop.location}`)
    }
    doc.text(shopDetails.join('   |   '), pageWidth / 2, y, { align: 'center' })
    y += 10

    // Divider
    doc.setDrawColor(200)
    doc.line(14, y, pageWidth - 14, y)
    y += 8

    // --- Section 1: Current Inventory ---
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('1. Current Inventory', 14, y)
    y += 2

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${data.inventory.length} product${data.inventory.length !== 1 ? 's' : ''} in stock`, 14, y + 4)
    y += 6

    if (data.inventory.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Barcode', 'Price (ZAR)', 'Stock Qty']],
        body: data.inventory.map((p) => [
          p.name,
          p.barcode ?? '—',
          `R ${p.price.toFixed(2)}`,
          String(p.stock_qty),
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    } else {
      y += 6
      doc.text('No products in inventory.', 14, y)
      y += 10
    }

    // --- Section 2: Expiry Register ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('2. Expiry Register', 14, y)
    y += 2

    const today = formatSAST(now, 'yyyy-MM-dd')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${data.expiryBatches.length} active batch${data.expiryBatches.length !== 1 ? 'es' : ''} with expiry dates`,
      14,
      y + 4,
    )
    y += 6

    if (data.expiryBatches.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Expiry Date', 'Batch Qty', 'Status']],
        body: data.expiryBatches.map((b) => {
          let status = 'OK'
          if (b.expiry_date < today) {
            status = 'EXPIRED'
          } else {
            const sevenDays = new Date()
            sevenDays.setDate(sevenDays.getDate() + 7)
            const soonDate = formatSAST(sevenDays, 'yyyy-MM-dd')
            if (b.expiry_date <= soonDate) {
              status = 'Expiring Soon'
            }
          }
          return [b.product_name, b.expiry_date, String(b.quantity), status]
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        didParseCell(hookData) {
          // Color-code the status column
          if (hookData.section === 'body' && hookData.column.index === 3) {
            const val = hookData.cell.raw as string
            if (val === 'EXPIRED') {
              hookData.cell.styles.textColor = [220, 38, 38] // red
              hookData.cell.styles.fontStyle = 'bold'
            } else if (val === 'Expiring Soon') {
              hookData.cell.styles.textColor = [217, 119, 6] // amber
            }
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    } else {
      y += 6
      doc.text('No batches with expiry dates recorded.', 14, y)
      y += 10
    }

    // --- Section 3: Stock Movement (30 days) ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('3. Stock Movement (Last 30 Days)', 14, y)
    y += 2

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${data.stockMovement.length} movement${data.stockMovement.length !== 1 ? 's' : ''} recorded`,
      14,
      y + 4,
    )
    y += 6

    if (data.stockMovement.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Product', 'Type', 'Qty Change', 'Reason']],
        body: data.stockMovement.map((m) => [
          m.date,
          m.product_name,
          m.type === 'sale' ? 'Sale' : 'Adjustment',
          m.delta > 0 ? `+${m.delta}` : String(m.delta),
          m.reason ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          4: { cellWidth: 40 }, // Reason column wider
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    } else {
      y += 6
      doc.text('No stock movements in the last 30 days.', 14, y)
      y += 10
    }

    // --- Footer ---
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150)
      doc.text(
        `Generated by SpazaSync on ${formatSAST(now, 'dd MMM yyyy HH:mm')} SAST — Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' },
      )
    }

    // Output
    const pdfBuffer = doc.output('arraybuffer')
    const filename = `compliance-report-${formatSAST(now, 'yyyyMMdd')}.pdf`

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('Compliance PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

/** Add a new page if remaining space is less than needed */
function checkPageBreak(doc: jsPDF, y: number, needed: number) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - 20) {
    doc.addPage()
  }
}

/** Get the current Y position (after potential page break) */
function getCurrentY(doc: jsPDF, y: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y > pageHeight - 20) {
    return 15 // top of new page
  }
  return y
}
