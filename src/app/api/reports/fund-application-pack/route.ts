/**
 * Phase 37d — Spaza Shop Support Fund application pack PDF.
 *
 * Per Design Rule 3 (conditional visibility), this endpoint is gated to:
 *   - SA citizens (`owner_profiles.nationality_type = 'sa_citizen'`)
 *   - Owners who opted in (`shops.fund_interest = true`)
 *
 * Foreign nationals or shops with `fund_interest = false` get a 403 — the
 * journey UI keeps the link hidden for them too, so the API gate is purely
 * defense-in-depth in case someone hand-crafts the URL.
 *
 * The endpoint is built in 37d so it's testable today, but the journey UI
 * doesn't link to it yet (Phase 37e Fund Readiness Checker will).
 */

import { NextResponse } from 'next/server'
import { getShopAuth } from '@/lib/auth/shop-auth'
import { getOwnerProfileReportData } from '@/lib/db/owner-profile-report'
import { qualifiesAsSaCitizenForFund } from '@/lib/compliance/fund'
import { formatSAST } from '@/lib/utils/date'
import {
  BRAND_BLUE,
  assertNoSensitiveValues,
  drawFooter,
  drawFormRows,
  drawHeader,
  drawSectionHeading,
  pdfFilename,
  pdfResponse,
  type FormRow,
} from '@/lib/pdf/shared'
import type { jsPDF } from 'jspdf'
import type { BusinessDocument, DocumentType } from '@/types'

type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } }

const DOC_LABEL: Partial<Record<DocumentType, string>> = {
  municipal_registration: 'Municipal trading permit',
  cipc: 'CIPC registration',
  sars_tax: 'SARS tax registration',
  uif: 'UIF registration',
  smmesa: 'SMMESA registration',
  coa: 'Certificate of Acceptability (CoA)',
}

function statusLabel(d: BusinessDocument | null | undefined): string {
  if (!d) return 'Not yet'
  switch (d.status) {
    case 'valid':
    case 'on_file':
      return d.reference_number ? `On file — ${d.reference_number}` : 'On file'
    case 'in_progress':
      return 'In progress'
    case 'pending':
      return 'Pending'
    case 'expired':
      return 'Expired'
    case 'not_required':
      return 'Not required'
    case 'not_registered':
      return 'Not yet'
    default:
      return d.status
  }
}

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

    // Eligibility gates (Design Rule 3). Use qualifiesAsSaCitizenForFund so a
    // foreign-born owner naturalised as an SA citizen before 1994 (who legally
    // qualifies for the fund) is NOT wrongly blocked — a bare `=== 'sa_citizen'`
    // here used to 403 them even though the fund engine treats them as eligible.
    if (!data.ownerProfile || !qualifiesAsSaCitizenForFund(data.ownerProfile)) {
      return NextResponse.json(
        { error: 'The Spaza Shop Support Fund is only open to South African citizens.' },
        { status: 403 },
      )
    }
    if (!data.shop.fund_interest) {
      return NextResponse.json(
        {
          error:
            "Enable 'Interested in the government fund' in Settings before generating this pack.",
        },
        { status: 403 },
      )
    }

    const docByType = new Map<DocumentType, BusinessDocument>(
      data.documents.map((d) => [d.document_type, d]),
    )

    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const now = new Date()

    let y = drawHeader(doc, {
      title: 'Spaza Shop Support Fund',
      subtitle: 'Application Supporting Documents',
      meta: [data.shop.name, `Generated ${formatSAST(now, 'dd MMMM yyyy')}`],
    })

    // ── Owner ──
    y = drawSectionHeading(doc, y, 'Owner information')
    const ownerRows: FormRow[] = [
      { label: 'Full name', value: data.ownerName, hint: data.ownerName ? null : 'Add in Settings' },
      { label: 'SA ID number', value: null, blank: true, hint: '(fill in on the spazashopfund.co.za / SEDFA application)' },
      { label: 'Phone', value: data.shop.whatsapp_number, hint: data.shop.whatsapp_number ? null : 'Add in Settings' },
      { label: 'Email', value: data.ownerEmail },
      { label: 'Address', value: data.shop.location, hint: data.shop.location ? null : 'Add in Settings' },
    ]
    assertNoSensitiveValues(ownerRows)
    y = drawFormRows(doc, y, ownerRows)

    // ── Business ──
    y = drawSectionHeading(doc, y + 4, 'Business information')
    const businessRows: FormRow[] = [
      { label: 'Shop name', value: data.shop.name },
      { label: 'Shop address', value: data.shop.location },
      { label: 'Municipality', value: data.areaLabel },
      { label: 'Type', value: 'Spaza shop' },
      { label: 'Goods sold', value: data.goodsDescription },
    ]
    y = drawFormRows(doc, y, businessRows)

    // ── Registration status ──
    y = drawSectionHeading(doc, y + 4, 'Registration status')
    const regTypes: DocumentType[] = [
      'municipal_registration',
      'cipc',
      'sars_tax',
      'uif',
      'smmesa',
      'coa',
    ]
    autoTable(doc, {
      startY: y,
      head: [['Registration', 'Status']],
      body: regTypes.map((t) => [DOC_LABEL[t] ?? t, statusLabel(docByType.get(t))]),
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    })
    y = (doc as AutoTableDoc).lastAutoTable?.finalY ?? y
    y += 8

    // ── Trading history ──
    y = drawSectionHeading(doc, y, 'Trading history')
    const monthlyAvg = data.activeDays > 0 ? data.ninetyDayRevenue / 3 : 0
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const tradingLines = [
      `Reporting period: last 90 days`,
      `Total revenue: R${data.ninetyDayRevenue.toFixed(2)}`,
      `Estimated monthly average: R${monthlyAvg.toFixed(2)}`,
      `Active trading days: ${data.activeDays}`,
    ]
    for (const line of tradingLines) {
      doc.text(line, 14, y)
      y += 5
    }
    y += 4

    // ── Submission instructions ──
    y = drawSectionHeading(doc, y, 'Where to submit')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    // Phase 41b — corrected channels per SEDFA / SAnews guideline.
    // The old systemsnew.sefa.org.za URL was the generic SEFA SMME portal —
    // the spaza-fund-specific portal is spazashopfund.co.za, run by NEF.
    const submitLines = [
      'Submit this pack along with your original ID and certified copies at:',
      '   • Online (official portal): spazashopfund.co.za',
      '   • Email: Spazafund@nefcorp.co.za',
      '   • Phone: 011 305 8080  (NEF call centre)',
      '',
      'WARNING: SAnews has warned about fake application assistants.',
      'Only use the official channels above (spazashopfund.co.za, NEF,',
      'SEDFA). Never pay anyone offering to submit on your behalf.',
    ]
    for (const line of submitLines) {
      doc.text(line, 14, y)
      y += 5
    }

    drawFooter(doc, now)
    return pdfResponse(doc.output('arraybuffer'), pdfFilename('fund-application-pack', now))
  } catch (err) {
    console.error('Fund application pack PDF failed:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
