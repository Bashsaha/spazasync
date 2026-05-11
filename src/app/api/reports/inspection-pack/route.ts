import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getComplianceReportData } from '@/lib/db/compliance-report'
import { computeDocumentStatus, EXPIRY_WARNING_DAYS, OWNER_ID_WARNING_DAYS } from '@/lib/compliance/document-status'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'
import { formatSAST } from '@/lib/utils/date'
import {
  BRAND_BLUE,
  TEXT_GREEN,
  TEXT_RED,
  checkPageBreak,
  drawFooter,
  drawHeader,
  drawSectionHeading,
  getCurrentY,
  pdfFilename,
  pdfResponse,
} from '@/lib/pdf/shared'
import type { jsPDF } from 'jspdf'
import type { Teller, OwnerProfile, DocumentType } from '@/types'

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  municipal_registration: 'Municipal Registration',
  coa: 'Certificate of Acceptability (CoA)',
  cipc: 'CIPC Registration',
  business_license: 'Business License',
  owner_id: 'Owner Documentation',
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

const BAND_LABELS: Record<'green' | 'amber' | 'red', string> = {
  green: 'Inspection-ready',
  amber: 'A few things to tidy up',
  red: 'Urgent: fix before an inspection',
}

const BAND_COLORS: Record<'green' | 'amber' | 'red', [number, number, number]> = {
  green: [22, 163, 74],
  amber: [217, 119, 6],
  red: [220, 38, 38],
}

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  try {
    const data = await getComplianceReportData(auth.shopId)

    const [tellersResult, ownerProfileResult] = await Promise.all([
      auth.supabase
        .from('tellers')
        .select('id, name, food_safety_trained_at, active')
        .eq('shop_id', auth.shopId)
        .eq('active', true)
        .order('name'),
      auth.supabase
        .from('owner_profiles')
        .select('*')
        .eq('user_id', auth.user.id)
        .maybeSingle(),
    ])
    const tellers = (tellersResult.data as Pick<Teller, 'id' | 'name' | 'food_safety_trained_at'>[] | null) ?? []
    const ownerProfile = (ownerProfileResult.data as OwnerProfile | null) ?? null

    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now = new Date()
    const today = formatSAST(now, 'yyyy-MM-dd')

    let y = drawHeader(doc, {
      title: 'Inspection Pack',
      subtitle: data.shop.name,
      meta: [
        `Generated: ${formatSAST(now, 'dd MMMM yyyy, HH:mm')} SAST`,
        data.shop.location ? data.shop.location : '',
        data.shop.registration_number ? `Reg: ${data.shop.registration_number}` : '',
      ].filter(Boolean) as string[],
    })

    // ── 1. Compliance Score ──
    y = drawSectionHeading(doc, y, '1. Compliance Score')
    const scoreColor = BAND_COLORS[data.score.band]
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
    doc.text(`${data.score.overall} / 100`, 14, y + 8)
    doc.setFontSize(11)
    doc.text(BAND_LABELS[data.score.band], 55, y + 8)
    doc.setTextColor(0)
    y += 14

    const missingSuppliers = Math.max(0, data.scoreInputs.productCount - data.scoreInputs.productsWithSupplier)
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Score', 'Weight', 'Contribution', 'Action']],
      body: data.score.categories.map((c) => {
        const tip =
          c.tipKey === 'tip_checklist'
            ? `Daily checklists at ${data.scoreInputs.checklistCompliancePct}% — log every morning`
            : c.tipKey === 'tip_expiry'
              ? `Remove ${data.scoreInputs.expiredBatchCount} expired batch(es) from stock`
              : c.tipKey === 'tip_suppliers'
                ? `Add suppliers to ${missingSuppliers} more product(s)`
                : c.tipKey === 'tip_documents'
                  ? 'Update missing or expired business documents'
                  : c.tipKey === 'tip_waste_pest'
                    ? 'Log pest control and confirm waste arrangement'
                    : '—'
        return [c.key.replace('_', ' '), `${c.score}/100`, `${c.weight}%`, c.weighted.toFixed(1), tip]
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      columnStyles: { 4: { cellWidth: 65 } },
      didParseCell(hookData) {
        if (hookData.section !== 'body' || hookData.column.index !== 1) return
        const n = parseInt((hookData.cell.raw as string).split('/')[0], 10)
        if (n === 100) { hookData.cell.styles.textColor = TEXT_GREEN; hookData.cell.styles.fontStyle = 'bold' }
        else if (n >= 50) hookData.cell.styles.textColor = [217, 119, 6]
        else { hookData.cell.styles.textColor = TEXT_RED; hookData.cell.styles.fontStyle = 'bold' }
      },
    })
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    y += 8

    // ── 2. Business Registration Status ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '2. Business Registration Status')
    const docSummary = computeDocumentStatus(data.businessDocuments, today)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${docSummary.totalLogged} of ${DOCUMENT_TYPES.length} documents on file — ${docSummary.validCount} valid, ${docSummary.expiringSoon.length} expiring soon, ${docSummary.expired.length} expired`,
      14,
      y,
    )
    y += 6
    const docByType = new Map(data.businessDocuments.map((d) => [d.document_type, d]))
    autoTable(doc, {
      startY: y,
      head: [['Document', 'Status', 'Reference', 'Expiry']],
      body: DOCUMENT_TYPES.map((type) => {
        const entry = docByType.get(type)
        if (!entry) return [DOCUMENT_LABELS[type], 'Not Logged', '—', '—']
        let statusCell = STATUS_LABELS[entry.status] ?? entry.status
        if (entry.expiry_date) {
          const daysOut = Math.round((Date.parse(entry.expiry_date) - Date.parse(today)) / 86400000)
          const window = type === 'owner_id' ? OWNER_ID_WARNING_DAYS : EXPIRY_WARNING_DAYS
          if (daysOut < 0 && entry.status !== 'expired') statusCell = 'Expired'
          else if (daysOut >= 0 && daysOut <= window && entry.status === 'valid') statusCell = `Expiring in ${daysOut}d`
        }
        return [DOCUMENT_LABELS[type], statusCell, entry.reference_number ?? '—', entry.expiry_date ?? '—']
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      didParseCell(hookData) {
        if (hookData.section !== 'body' || hookData.column.index !== 1) return
        const val = hookData.cell.raw as string
        if (val === 'Expired' || val === 'Not Registered' || val === 'Not Logged') {
          hookData.cell.styles.textColor = TEXT_RED; hookData.cell.styles.fontStyle = 'bold'
        } else if (val.startsWith('Expiring in') || val === 'Pending') {
          hookData.cell.styles.textColor = [217, 119, 6]; hookData.cell.styles.fontStyle = 'bold'
        } else if (val === 'Valid' || val === 'On File' || val === 'Not Required') {
          hookData.cell.styles.textColor = TEXT_GREEN
        }
      },
    })
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    y += 8

    // ── 3. Daily Checklist (30 days) ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '3. Daily Checklist (Last 30 Days)')
    const s = data.checklistStats
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const statsLine = [
      `Completed ${s.completedDays} of ${s.totalDays} days (${s.compliancePct}%)`,
      s.avgFridgeTemp !== null ? `Avg fridge: ${s.avgFridgeTemp}°C` : null,
      s.avgFreezerTemp !== null ? `Avg freezer: ${s.avgFreezerTemp}°C` : null,
      `Cleaning: ${s.cleaningRate}% of days`,
      s.outOfRangeDays > 0 ? `${s.outOfRangeDays} day(s) temp out of range` : null,
    ].filter(Boolean).join('   |   ')
    doc.text(statsLine, 14, y)
    y += 6
    const checklistByDate = new Map(data.checklistHistory.map((c) => [c.date, c]))
    const checklistRows: string[][] = []
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const ds = formatSAST(d, 'yyyy-MM-dd')
      const e = checklistByDate.get(ds)
      if (!e) { checklistRows.push([ds, 'MISSED', '—', '—', '—', '—', '—']); continue }
      const surfaces = e.surfaces_cleaned ? '✓' : '✗'
      const floor = e.floor_cleaned ? '✓' : '✗'
      const storage = e.storage_clean ? '✓' : '✗'
      const fridge = e.fridge_temp !== null ? `${e.fridge_temp}°C` : (e.fridge_ok === true ? '✓' : '—')
      const freezer = e.freezer_temp !== null ? `${e.freezer_temp}°C` : (e.freezer_ok === true ? '✓' : '—')
      const expired = e.expired_items_action === 'removed' ? 'Removed' : e.expired_items_action === 'none_found' ? 'None' : e.expired_items_action === 'skipped' ? 'Skipped' : '—'
      const waste = e.waste_bins_ok === true ? '✓' : e.waste_bins_ok === false ? '✗' : '—'
      checklistRows.push([ds, `${surfaces}/${floor}/${storage}`, fridge, freezer, expired, waste, 'Logged'])
    }
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Clean (S/F/Sto)', 'Fridge', 'Freezer', 'Expired', 'Bins', 'Status']],
      body: checklistRows,
      styles: { fontSize: 8, cellPadding: 1.8 },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
      didParseCell(hookData) {
        if (hookData.section !== 'body') return
        const status = (hookData.row.raw as string[])[1]
        if (status === 'MISSED') {
          hookData.cell.styles.textColor = TEXT_RED
          if (hookData.column.index === 1) hookData.cell.styles.fontStyle = 'bold'
        } else if (hookData.column.index === 6) {
          hookData.cell.styles.textColor = TEXT_GREEN
        }
      },
    })
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    y += 8

    // ── 4. Expiry Register ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '4. Expiry Register')
    if (data.expiryBatches.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Expiry Date', 'Qty', 'Status']],
        body: data.expiryBatches.map((b) => [b.product_name, b.expiry_date, String(b.quantity), b.expiry_date < today ? 'EXPIRED' : 'OK']),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        didParseCell(hookData) {
          if (hookData.section !== 'body' || hookData.column.index !== 3) return
          if ((hookData.cell.raw as string) === 'EXPIRED') { hookData.cell.styles.textColor = TEXT_RED; hookData.cell.styles.fontStyle = 'bold' }
        },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9); doc.text('No expiry batches on file.', 14, y)
    }
    y += 4
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(100)
    doc.text('Stock deduction method: First-Expiring-First-Out (FEFO).', 14, y)
    doc.setTextColor(0); doc.setFont('helvetica', 'normal')
    y += 8

    // ── 5. Stock Movement (30 days) ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '5. Stock Movement (Last 30 Days)')
    if (data.stockMovement.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Product', 'Type', 'Qty Change', 'Reason']],
        body: data.stockMovement.slice(0, 100).map((m) => [m.date, m.product_name, m.type === 'sale' ? 'Sale' : 'Adjustment', m.delta > 0 ? `+${m.delta}` : String(m.delta), m.reason ?? '—']),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: { 4: { cellWidth: 40 } },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      if (data.stockMovement.length > 100) {
        y += 4; doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(120)
        doc.text(`Showing first 100 of ${data.stockMovement.length} movements.`, 14, y)
        doc.setTextColor(0)
      }
    } else {
      doc.setFontSize(9); doc.text('No stock movements recorded in this period.', 14, y)
    }
    y += 8

    // ── 6. Supplier Traceability ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '6. Supplier Traceability')
    if (data.suppliers.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Supplier', 'Type', 'Phone', 'Location']],
        body: data.suppliers.map((s) => [s.name, s.type ?? '—', s.contact_number ?? '—', s.location ?? '—']),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9); doc.text('No suppliers on file.', 14, y)
    }
    y += 8

    // ── 7. Waste & Pest Management ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '7. Waste & Pest Management')
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    if (data.wasteManagement) {
      const w = data.wasteManagement
      const lines = [
        `Removal type: ${w.removal_type.replace('_', ' ')}`,
        `Frequency: ${w.frequency.replace('_', ' ')}`,
        `Provider: ${w.provider_name ?? '—'}`,
        `Last confirmed active: ${w.last_confirmed_date ?? 'Never'}`,
      ]
      for (const line of lines) { doc.text(line, 14, y); y += 5 }
    } else {
      doc.setTextColor(TEXT_RED[0], TEXT_RED[1], TEXT_RED[2])
      doc.text('No waste arrangement recorded.', 14, y)
      doc.setTextColor(0)
      y += 5
    }
    y += 4

    if (data.pestControlLogs.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Provider', 'Treatment', 'Notes']],
        body: data.pestControlLogs.map((p) => [p.visit_date, p.provider_name, p.treatment_type, p.notes ?? '—']),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        columnStyles: { 3: { cellWidth: 50 } },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9); doc.text('No pest control visits logged in the last 6 months.', 14, y)
    }
    y += 8

    // ── 8. Staff Training ──
    checkPageBreak(doc, y, 30)
    y = getCurrentY(doc, y)
    y = drawSectionHeading(doc, y, '8. Staff Training')
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    const ownerLine = ownerProfile?.food_safety_training_completed
      ? `Person in charge (owner): trained${ownerProfile.food_safety_training_date ? ` on ${ownerProfile.food_safety_training_date}` : ''}${ownerProfile.food_safety_training_provider ? ` (${ownerProfile.food_safety_training_provider})` : ''}`
      : 'Person in charge (owner): not yet trained'
    doc.text(ownerLine, 14, y)
    y += 6
    if (tellers.length === 0) {
      doc.text('No staff on file.', 14, y)
      y += 5
    } else {
      autoTable(doc, {
        startY: y,
        head: [['Staff member', 'Trained on']],
        body: tellers.map((t) => [t.name, t.food_safety_trained_at ? formatSAST(t.food_safety_trained_at, 'dd MMM yyyy') : 'Not yet trained']),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    }

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('inspection-pack', now))
  } catch (err) {
    console.error('Inspection pack PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
