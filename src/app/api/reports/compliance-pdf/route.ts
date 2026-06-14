import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getComplianceReportData } from '@/lib/db/compliance-report'
import { formatSAST } from '@/lib/utils/date'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'
import { computeDocumentStatus, EXPIRY_WARNING_DAYS, OWNER_ID_WARNING_DAYS } from '@/lib/compliance/document-status'
import type { DocumentType } from '@/types'
// jsPDF + autoTable are dynamically imported inside GET() to reduce cold start
import type { jsPDF } from 'jspdf'

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  municipal_registration: 'Municipal Registration',
  coa: 'Certificate of Acceptability (CoA)',
  cipc: 'CIPC Registration',
  business_license: 'Business License',
  owner_id: 'Owner Documentation',
  // Phase 37b
  sars_tax: 'SARS Tax Registration',
  uif: 'UIF Registration',
  food_safety_training: 'Food Safety Training',
  smmesa: 'SMMESA Registration',
}

const STATUS_LABELS: Record<string, string> = {
  valid: 'Valid',
  expired: 'Expired',
  pending: 'Pending',
  not_registered: 'Not Registered',
  not_required: 'Not Required',
  on_file: 'On File',
}

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

    // Lazy-load PDF libraries (only when report is actually requested)
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

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
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

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

    // --- Section 3: Expiry Register ---
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

    // --- Section 4: Stock Movement (30 days) ---
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

    // --- Section 5: Supplier Traceability ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('4. Supplier Traceability Report', 14, y)
    y += 2

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${data.suppliers.length} supplier${data.suppliers.length !== 1 ? 's' : ''}, ${data.goodsReceived.length} receipt${data.goodsReceived.length !== 1 ? 's' : ''} in the last 30 days`,
      14,
      y + 4,
    )
    y += 8

    // Sub-section: Supplier directory
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Supplier Directory', 14, y)
    y += 2

    if (data.suppliers.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['Name', 'Type', 'Contact', 'Location']],
        body: data.suppliers.map((s) => [
          s.name,
          s.type ?? '—',
          s.contact_number ?? '—',
          s.location ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      y += 6
      doc.text('No suppliers on file.', 14, y)
      y += 8
    }

    // Sub-section: Goods received log
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Goods Received Log (Last 30 Days)', 14, y)
    y += 2

    if (data.goodsReceived.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Item', 'Qty', 'Supplier', 'Notes']],
        body: data.goodsReceived.map((g) => [
          g.date,
          g.product_name,
          `+${g.quantity}`,
          g.supplier_name ?? '—',
          g.notes ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          4: { cellWidth: 40 }, // Notes column wider
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      y += 6
      doc.text('No goods received logged in the last 30 days.', 14, y)
      y += 10
    }

    // --- Section 6: Daily Compliance Log ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('5. Daily Compliance Log (Last 30 Days)', 14, y)
    y += 2

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const s = data.checklistStats
    doc.text(
      `Completed ${s.completedDays} of ${s.totalDays} days — ${s.compliancePct}% compliance`,
      14,
      y + 4,
    )
    y += 6
    const detailLines: string[] = []
    if (s.avgFridgeTemp !== null) detailLines.push(`Avg fridge: ${s.avgFridgeTemp}°C`)
    if (s.avgFreezerTemp !== null) detailLines.push(`Avg freezer: ${s.avgFreezerTemp}°C`)
    detailLines.push(`Cleaning: ${s.cleaningRate}% of completed days`)
    if (s.outOfRangeDays > 0) {
      detailLines.push(`${s.outOfRangeDays} day(s) temperature out of range`)
    }
    doc.text(detailLines.join('   |   '), 14, y + 4)
    y += 8

    // Build 30-day gap-filled table rows (most recent first)
    const checklistByDate = new Map(data.checklistHistory.map((c) => [c.date, c]))
    const tableBody: Array<Array<string>> = []
    for (let i = 0; i < 30; i += 1) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = formatSAST(d, 'yyyy-MM-dd')
      const entry = checklistByDate.get(ds)
      if (!entry) {
        tableBody.push([ds, 'MISSED', '—', '—', '—', '—'])
        continue
      }
      const fridgeCell = entry.fridge_temp !== null ? `${entry.fridge_temp}°C` : (entry.fridge_ok === true ? 'OK' : entry.fridge_ok === false ? 'NO' : '—')
      const freezerCell = entry.freezer_temp !== null ? `${entry.freezer_temp}°C` : (entry.freezer_ok === true ? 'OK' : entry.freezer_ok === false ? 'NO' : '—')
      const cleaningCount = [entry.surfaces_cleaned, entry.floor_cleaned, entry.storage_clean].filter((v) => v === true).length
      const cleaningCell = `${cleaningCount}/3`
      const expiredCell =
        entry.expired_items_action === 'removed' ? 'Removed'
        : entry.expired_items_action === 'none_found' ? 'None'
        : entry.expired_items_action === 'skipped' ? 'Skipped'
        : '—'
      const allCleaned = cleaningCount === 3
      const expiredOk = entry.expired_items_action === 'removed' || entry.expired_items_action === 'none_found'
      const statusCell = allCleaned && expiredOk ? 'DONE' : 'PARTIAL'
      tableBody.push([ds, statusCell, fridgeCell, freezerCell, cleaningCell, expiredCell])
    }

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Status', 'Fridge', 'Freezer', 'Cleaning', 'Expired Items']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      didParseCell(hookData) {
        if (hookData.section !== 'body') return
        const row = hookData.row.raw as string[]
        const status = row[1]
        // Whole-row red wash for missed days
        if (status === 'MISSED') {
          hookData.cell.styles.textColor = [220, 38, 38]
          if (hookData.column.index === 1) hookData.cell.styles.fontStyle = 'bold'
          return
        }
        // Amber for out-of-range temps
        if (hookData.column.index === 2) {
          const v = row[2]
          const n = Number(v.replace('°C', ''))
          if (!Number.isNaN(n) && (n < 1 || n > 5)) {
            hookData.cell.styles.textColor = [217, 119, 6]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
        if (hookData.column.index === 3) {
          const v = row[3]
          const n = Number(v.replace('°C', ''))
          if (!Number.isNaN(n) && n > -18) {
            hookData.cell.styles.textColor = [217, 119, 6]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
        // Partial status in amber
        if (hookData.column.index === 1 && status === 'PARTIAL') {
          hookData.cell.styles.textColor = [217, 119, 6]
        }
        if (hookData.column.index === 1 && status === 'DONE') {
          hookData.cell.styles.textColor = [22, 163, 74]
          hookData.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    // --- Section 7: Business Registration Status ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('6. Business Registration Status', 14, y)
    y += 2

    const docSummary = computeDocumentStatus(data.businessDocuments, today)
    const expiredCount = docSummary.expired.length
    const expiringSoonCount = docSummary.expiringSoon.length
    const onFileCount = docSummary.totalLogged

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
    doc.text(
      `${onFileCount} of ${DOCUMENT_TYPES.length} documents on file — ${docSummary.validCount} valid, ${expiringSoonCount} expiring within 30 days, ${expiredCount} expired`,
      14,
      y + 4,
    )
    y += 8

    const docByType = new Map(data.businessDocuments.map((d) => [d.document_type, d]))
    const docTableBody: Array<Array<string>> = DOCUMENT_TYPES.map((type) => {
      const entry = docByType.get(type)
      if (!entry) {
        return [DOCUMENT_LABELS[type], 'Not Logged', '—', '—']
      }
      const expiry = entry.expiry_date ?? '—'
      let statusCell = STATUS_LABELS[entry.status] ?? entry.status
      if (entry.expiry_date) {
        const daysOut = Math.round(
          (Date.parse(entry.expiry_date) - Date.parse(today)) / (1000 * 60 * 60 * 24),
        )
        const window = type === 'owner_id' ? OWNER_ID_WARNING_DAYS : EXPIRY_WARNING_DAYS
        if (daysOut < 0 && entry.status !== 'expired') {
          statusCell = 'Expired'
        } else if (daysOut >= 0 && daysOut <= window && entry.status === 'valid') {
          statusCell = `Expiring in ${daysOut}d`
        }
      }
      return [DOCUMENT_LABELS[type], statusCell, entry.reference_number ?? '—', expiry]
    })

    autoTable(doc, {
      startY: y,
      head: [['Document', 'Status', 'Reference Number', 'Expiry Date']],
      body: docTableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      didParseCell(hookData) {
        if (hookData.section !== 'body' || hookData.column.index !== 1) return
        const val = hookData.cell.raw as string
        if (val === 'Expired' || val === 'Not Registered' || val === 'Not Logged') {
          hookData.cell.styles.textColor = [220, 38, 38]
          hookData.cell.styles.fontStyle = 'bold'
        } else if (val.startsWith('Expiring in') || val === 'Pending') {
          hookData.cell.styles.textColor = [217, 119, 6]
          hookData.cell.styles.fontStyle = 'bold'
        } else if (val === 'Valid' || val === 'On File' || val === 'Not Required') {
          hookData.cell.styles.textColor = [22, 163, 74]
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    // --- Section 8: Waste & Pest Management ---
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text('7. Waste & Pest Management', 14, y)
    y += 2

    // Summary line
    const waste = data.wasteManagement
    const pestCount = data.pestControlLogs.length
    const binsPct = data.wasteBinsCompliance.pct
    const binsTotal = data.wasteBinsCompliance.totalDays
    const binsOk = data.wasteBinsCompliance.okDays

    const summaryPieces: string[] = []
    if (waste) {
      const freq = String(waste.frequency).replace('_', ' ')
      const removal = String(waste.removal_type).replace('_', ' ')
      const confirmed = waste.last_confirmed_date
        ? `confirmed ${Math.max(0, Math.round((Date.parse(today) - Date.parse(waste.last_confirmed_date)) / 86400000))} days ago`
        : 'never confirmed'
      summaryPieces.push(`Waste: ${removal} ${freq} (${confirmed})`)
    } else {
      summaryPieces.push('Waste: no arrangement recorded')
    }
    summaryPieces.push(`Pest control: ${pestCount} visit${pestCount !== 1 ? 's' : ''} in last 6 months`)
    summaryPieces.push(`Bins compliance: ${binsPct}%`)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(summaryPieces.join('.  '), 14, y + 4)
    y += 10

    // Sub-section: Waste Arrangement
    checkPageBreak(doc, y, 20)
    y = getCurrentY(doc, y)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Waste Arrangement', 14, y)
    y += 2

    if (waste) {
      const wasteRows: string[][] = [
        ['Removal type', String(waste.removal_type).replace('_', ' ')],
        ['Frequency', String(waste.frequency).replace('_', ' ')],
        ['Provider', waste.provider_name ?? '—'],
        ['Last confirmed', waste.last_confirmed_date ?? 'Never'],
      ]
      autoTable(doc, {
        startY: y + 2,
        head: [['Field', 'Value']],
        body: wasteRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        didParseCell(hookData) {
          if (hookData.section !== 'body' || hookData.column.index !== 1) return
          if (hookData.row.index === 3) {
            const v = hookData.cell.raw as string
            if (v === 'Never') {
              hookData.cell.styles.textColor = [220, 38, 38]
              hookData.cell.styles.fontStyle = 'bold'
            } else if (v && v !== '—') {
              const days = Math.round(
                (Date.parse(today) - Date.parse(v)) / (1000 * 60 * 60 * 24),
              )
              if (days >= 30) {
                hookData.cell.styles.textColor = [217, 119, 6]
                hookData.cell.styles.fontStyle = 'bold'
              } else {
                hookData.cell.styles.textColor = [22, 163, 74]
              }
            }
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      y += 6
      doc.setTextColor(220, 38, 38)
      doc.text('No waste removal arrangement on file.', 14, y)
      doc.setTextColor(0)
      y += 8
    }

    // Sub-section: Pest Control History
    checkPageBreak(doc, y, 20)
    y = getCurrentY(doc, y)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Pest Control History (Last 6 Months)', 14, y)
    y += 2

    if (pestCount > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['Date', 'Provider', 'Treatment', 'Notes']],
        body: data.pestControlLogs.map((p) => [
          p.visit_date,
          p.provider_name,
          p.treatment_type,
          p.notes ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: {
          3: { cellWidth: 50 },
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      y += 6
      doc.setTextColor(220, 38, 38)
      doc.text('No pest control visits recorded in the last 6 months.', 14, y)
      doc.setTextColor(0)
      y += 8
    }

    // Sub-section: Waste Bin Daily Compliance
    checkPageBreak(doc, y, 16)
    y = getCurrentY(doc, y)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Daily Waste Bin Compliance (30 Days)', 14, y)
    y += 2

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const binsTone: [number, number, number] =
      binsPct >= 90 ? [22, 163, 74] : binsPct >= 70 ? [217, 119, 6] : [220, 38, 38]
    doc.setTextColor(binsTone[0], binsTone[1], binsTone[2])
    doc.setFont('helvetica', 'bold')
    const binsLine = binsTotal > 0
      ? `Waste bins emptied and area clean on ${binsOk} of ${binsTotal} days (${binsPct}%)`
      : 'No bin checks logged in the last 30 days'
    doc.text(binsLine, 14, y + 4)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')
    y += 10

    // --- Footer ---
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(150)
      doc.text(
        `Generated by Movestock — Digital Compliance for Spaza Shops on ${formatSAST(now, 'dd MMM yyyy HH:mm')} SAST — Page ${i} of ${pageCount}`,
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
