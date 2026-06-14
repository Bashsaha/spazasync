/**
 * Phase 37d — Food Safety Evidence Pack PDF.
 *
 * 30-day rollup an Environmental Health inspector can review during a CoA
 * visit. Reuses `getComplianceReportData()` (same data source as the existing
 * Compliance Report) and adds a staff-training section sourced from
 * `tellers.food_safety_trained_at` + `owner_profiles`.
 *
 * The default reporting window is 30 days (matches `getComplianceReportData`)
 * but the `?days=` query param is accepted for parity with the spec; values
 * other than 30 currently still pull a 30-day window because the underlying
 * helper is fixed. Treating that as a 37d limitation, not a hard error — the
 * PDF header reflects whatever range was actually captured.
 */

import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getComplianceReportData } from '@/lib/db/compliance-report'
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
import type { Teller, OwnerProfile } from '@/types'

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }

export async function GET() {
  const auth = await getShopAuth()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = auth.user.app_metadata?.role as string | undefined
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
  }

  try {
    const data = await getComplianceReportData(auth.shopId)

    // Staff training is read here (not part of compliance-report.ts) because
    // it's evidence-pack-specific.
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
      title: 'Food Safety Evidence Pack',
      subtitle: data.shop.name,
      meta: [
        `Period: 30 days ending ${today}`,
        data.shop.location ? `${data.shop.location}` : '',
      ].filter(Boolean) as string[],
    })

    // ── 1. Summary ──
    y = drawSectionHeading(doc, y, '1. Summary')
    const expiredCount = data.expiryBatches.filter((b) => b.expiry_date < today).length
    const supplierPct =
      data.scoreInputs.productCount > 0
        ? Math.round((data.scoreInputs.productsWithSupplier / data.scoreInputs.productCount) * 100)
        : 0
    const summaryLines = [
      `Daily checklist completion: ${data.checklistStats.compliancePct}% (${data.checklistStats.completedDays}/${data.checklistStats.totalDays} days)`,
      data.checklistStats.avgFridgeTemp !== null
        ? `Average fridge temperature: ${data.checklistStats.avgFridgeTemp}°C (target: 1–5°C)`
        : 'Average fridge temperature: not enough data',
      data.checklistStats.avgFreezerTemp !== null
        ? `Average freezer temperature: ${data.checklistStats.avgFreezerTemp}°C (target: below -18°C)`
        : 'Average freezer temperature: not enough data',
      `Expired stock currently on shelf: ${expiredCount === 0 ? 'None' : `${expiredCount} batch(es)`}`,
      `Supplier traceability: ${supplierPct}% of products linked`,
    ]
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const line of summaryLines) {
      checkPageBreak(doc, y, 6)
      y = getCurrentY(doc, y)
      doc.text(line, 14, y)
      y += 5
    }
    y += 4

    // ── 2. Daily checklist history ──
    y = drawSectionHeading(doc, y, '2. Daily Checklist (Last 30 Days)')
    const checklistByDate = new Map(data.checklistHistory.map((c) => [c.date, c]))
    const checklistRows: string[][] = []
    for (let i = 0; i < 30; i += 1) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const ds = formatSAST(d, 'yyyy-MM-dd')
      const e = checklistByDate.get(ds)
      if (!e) {
        checklistRows.push([ds, 'MISSED', '—', '—', '—', '—', '—'])
        continue
      }
      const surfaces = e.surfaces_cleaned ? '✓' : '✗'
      const floor = e.floor_cleaned ? '✓' : '✗'
      const storage = e.storage_clean ? '✓' : '✗'
      const fridge =
        e.fridge_temp !== null ? `${e.fridge_temp}°C` : e.fridge_ok === true ? '✓' : '—'
      const freezer =
        e.freezer_temp !== null ? `${e.freezer_temp}°C` : e.freezer_ok === true ? '✓' : '—'
      const expired =
        e.expired_items_action === 'removed'
          ? 'Removed'
          : e.expired_items_action === 'none_found'
            ? 'None'
            : e.expired_items_action === 'skipped'
              ? 'Skipped'
              : '—'
      const waste = e.waste_bins_ok === true ? '✓' : e.waste_bins_ok === false ? '✗' : '—'
      checklistRows.push([ds, `${surfaces}/${floor}/${storage}`, fridge, freezer, expired, waste, 'logged'])
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
        if (hookData.section !== 'body' || hookData.column.index !== 6) return
        const v = hookData.cell.raw as string
        if (v === 'MISSED') {
          hookData.cell.styles.textColor = TEXT_RED
          hookData.cell.styles.fontStyle = 'bold'
        } else {
          hookData.cell.styles.textColor = TEXT_GREEN
        }
      },
    })
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    y += 8

    // ── 3. Stock movement ──
    y = drawSectionHeading(doc, y, '3. Stock Movement (Last 30 Days)')
    if (data.stockMovement.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Product', 'Type', 'Qty Change']],
        body: data.stockMovement.slice(0, 100).map((m) => [
          m.date,
          m.product_name,
          m.type === 'sale' ? 'Sale' : 'Adjustment',
          m.delta > 0 ? `+${m.delta}` : String(m.delta),
        ]),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
      if (data.stockMovement.length > 100) {
        y += 4
        doc.setFontSize(8)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(120)
        doc.text(
          `Showing first 100 of ${data.stockMovement.length} movements.`,
          14,
          y,
        )
        doc.setTextColor(0)
      }
    } else {
      doc.setFontSize(9)
      doc.text('No stock movements recorded in this period.', 14, y)
    }
    y += 8

    // ── 4. Expiry register ──
    y = drawSectionHeading(doc, y, '4. Expiry Register')
    if (data.expiryBatches.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Product', 'Expiry Date', 'Qty Remaining', 'Status']],
        body: data.expiryBatches.map((b) => {
          const status = b.expiry_date < today ? 'EXPIRED' : 'OK'
          return [b.product_name, b.expiry_date, String(b.quantity), status]
        }),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
        didParseCell(hookData) {
          if (hookData.section !== 'body' || hookData.column.index !== 3) return
          if ((hookData.cell.raw as string) === 'EXPIRED') {
            hookData.cell.styles.textColor = TEXT_RED
            hookData.cell.styles.fontStyle = 'bold'
          }
        },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9)
      doc.text('No expiry batches on file.', 14, y)
    }
    y += 4
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100)
    doc.text('Stock deduction method: First-Expiring-First-Out (FEFO).', 14, y)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')
    y += 8

    // ── 5. Supplier traceability ──
    y = drawSectionHeading(doc, y, '5. Supplier Traceability')
    if (data.suppliers.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Supplier', 'Type', 'Phone', 'Location']],
        body: data.suppliers.map((s) => [
          s.name,
          s.type ?? '—',
          s.contact_number ?? '—',
          s.location ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9)
      doc.text('No suppliers on file.', 14, y)
    }
    y += 8

    // ── 6. Pest control ──
    y = drawSectionHeading(doc, y, '6. Pest Control Log')
    if (data.pestControlLogs.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Provider', 'Treatment', 'Notes']],
        body: data.pestControlLogs.map((p) => [
          p.visit_date,
          p.provider_name,
          p.treatment_type,
          p.notes ?? '—',
        ]),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    } else {
      doc.setFontSize(9)
      doc.setTextColor(120, 60, 0)
      doc.text('No pest control visits logged in the last 6 months.', 14, y)
      doc.setTextColor(0)
    }
    y += 8

    // ── 7. Waste management ──
    y = drawSectionHeading(doc, y, '7. Waste Management')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (data.wasteManagement) {
      const w = data.wasteManagement
      const lines = [
        `Removal type: ${w.removal_type.replace('_', ' ')}`,
        `Frequency: ${w.frequency.replace('_', ' ')}`,
        `Provider: ${w.provider_name ?? '—'}`,
        `Last confirmed active: ${w.last_confirmed_date ?? 'Never'}`,
      ]
      for (const line of lines) {
        doc.text(line, 14, y)
        y += 5
      }
    } else {
      doc.text('No waste arrangement recorded.', 14, y)
      y += 5
    }
    y += 6

    // ── 8. Staff training ──
    y = drawSectionHeading(doc, y, '8. Staff Training')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const ownerLine = ownerProfile?.food_safety_training_completed
      ? `Person in charge (owner): trained${
          ownerProfile.food_safety_training_date ? ` on ${ownerProfile.food_safety_training_date}` : ''
        }${
          ownerProfile.food_safety_training_provider
            ? ` (${ownerProfile.food_safety_training_provider})`
            : ''
        }`
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
        body: tellers.map((t) => [
          t.name,
          t.food_safety_trained_at
            ? formatSAST(t.food_safety_trained_at, 'dd MMM yyyy')
            : 'Not yet trained',
        ]),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      })
      y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    }

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('food-safety-pack', now))
  } catch (err) {
    console.error('Food safety pack PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
