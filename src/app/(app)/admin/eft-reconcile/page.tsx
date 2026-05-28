'use client'

import { useRef, useState } from 'react'
import { Upload, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Callout } from '@/components/ui/Callout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/FormField'
import {
  parseCsv,
  parseOfx,
  detectColumns,
  csvFingerprint,
  parseRows,
} from '@/lib/eft/adapters'
import type { ColumnMap, ReconcileReport, ReconcilePending, ShopOption } from '@/lib/eft/types'

type Format = 'ofx' | 'csv'
type Phase = 'select' | 'preview' | 'result'

function rand(n: number): string {
  return `R${n.toFixed(2)}`
}
function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—'
}
function mapStorageKey(fp: string): string {
  return `mvs_eft_colmap_${fp}`
}

export default function EftReconcilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [fileName, setFileName] = useState('')
  const [fileText, setFileText] = useState('')
  const [format, setFormat] = useState<Format>('csv')

  // CSV preview / mapping
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMap | null>(null)
  const [fingerprint, setFingerprint] = useState('')
  const [previewCount, setPreviewCount] = useState(0)
  const [previewRows, setPreviewRows] = useState<{ date: string; amount: number; reference: string }[]>([])

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [report, setReport] = useState<ReconcileReport | null>(null)

  function reset() {
    setPhase('select')
    setFileName('')
    setFileText('')
    setHeaders([])
    setMapping(null)
    setFingerprint('')
    setPreviewCount(0)
    setPreviewRows([])
    setError('')
    setReport(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function rebuildPreview(text: string, map: ColumnMap | null) {
    const res = parseCsv(text, { mapping: map ?? undefined, now: new Date() })
    setMapping(res.mapping)
    setHeaders(res.headers)
    setPreviewCount(res.deposits.length)
    setPreviewRows(
      res.deposits.slice(0, 5).map((d) => ({ date: d.date, amount: d.amount, reference: d.reference })),
    )
    if (res.errors.length) setError(res.errors[0])
    else setError('')
  }

  async function handleFile(file: File) {
    setError('')
    const text = await file.text()
    setFileName(file.name)
    setFileText(text)

    const lower = file.name.toLowerCase()
    const isOfx =
      lower.endsWith('.ofx') || lower.endsWith('.qfx') || /<OFX>|<STMTTRN>/i.test(text)

    if (isOfx) {
      setFormat('ofx')
      const res = parseOfx(text)
      setPreviewCount(res.deposits.length)
      setPreviewRows(
        res.deposits.slice(0, 5).map((d) => ({ date: d.date, amount: d.amount, reference: d.reference })),
      )
      if (res.deposits.length === 0) setError(res.errors[0] ?? 'No deposits found in the file.')
      setPhase('preview')
      return
    }

    // CSV: detect columns, reuse a saved mapping if the shape matches.
    setFormat('csv')
    const fp = csvFingerprint(text)
    setFingerprint(fp)
    let saved: ColumnMap | null = null
    try {
      const raw = localStorage.getItem(mapStorageKey(fp))
      if (raw) saved = JSON.parse(raw) as ColumnMap
    } catch {
      saved = null
    }
    if (saved) {
      rebuildPreview(text, saved)
    } else {
      const det = detectColumns(parseRows(text), new Date())
      rebuildPreview(text, det.map)
    }
    setPhase('preview')
  }

  function updateMapping(field: keyof ColumnMap, value: number) {
    if (!mapping) return
    const next = { ...mapping, [field]: value }
    rebuildPreview(fileText, next)
  }

  async function handleReconcile() {
    setSubmitting(true)
    setError('')
    try {
      if (format === 'csv' && mapping && fingerprint) {
        try {
          localStorage.setItem(mapStorageKey(fingerprint), JSON.stringify(mapping))
        } catch {
          /* private mode — non-fatal */
        }
      }
      const res = await fetch('/api/admin/eft-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileText,
          format,
          ...(format === 'csv' && mapping ? { mapping } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data?.error === 'string' ? data.error : 'Failed to reconcile. Check the file and try again.')
        return
      }
      const data = (await res.json()) as ReconcileReport
      setReport(data)
      setPhase('result')
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="EFT reconciliation"
        subtitle="Upload a bank export — deposits are matched to shops by amount + shop-code reference and their subscriptions extended."
      />

      {phase === 'select' && (
        <div className="space-y-4">
          <Callout tone="info" icon={HelpCircle} title="How to use this">
            Export your transactions from FNB Business online banking — prefer{' '}
            <strong>OFX</strong> (most reliable), otherwise CSV. Owners pay using their{' '}
            <strong>shop code as the reference</strong>. Re-uploading overlapping date ranges is
            safe — already-applied deposits are skipped.
          </Callout>

          <Card>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.qfx,.csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <div className="flex flex-col items-center text-center py-8">
              <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mb-3">
                <Upload className="w-6 h-6 text-brand" aria-hidden />
              </div>
              <p className="text-base font-semibold text-gray-900">Upload a bank statement</p>
              <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
                OFX or CSV exported from your banking app.
              </p>
              <Button icon={Upload} onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
            </div>
          </Card>
        </div>
      )}

      {phase === 'preview' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{fileName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {format.toUpperCase()} · {previewCount} deposit{previewCount === 1 ? '' : 's'} detected
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                Change file
              </Button>
            </div>
          </Card>

          {format === 'csv' && mapping && (
            <Card>
              <SectionHeader title="Confirm the columns" />
              <p className="text-sm text-gray-500 mb-3">
                We detected these columns. Fix them if any are wrong — your choice is remembered for
                next time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['date', 'amount', 'reference'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                      {field}
                    </label>
                    <Select
                      value={mapping[field]}
                      onChange={(e) => updateMapping(field, Number(e.target.value))}
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {previewRows.length > 0 ? (
            <Card padding="none">
              <div className="px-4 py-3 border-b border-line">
                <p className="text-sm font-semibold text-gray-900">Preview (first {previewRows.length})</p>
              </div>
              <div className="divide-y divide-line">
                {previewRows.map((r, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-500 w-24 shrink-0">{r.date}</span>
                    <span className="text-gray-900 truncate flex-1">{r.reference || '—'}</span>
                    <span className="font-semibold text-gray-900 shrink-0">{rand(r.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Callout tone="warning" icon={AlertTriangle} title="No deposits detected">
              {error || 'No incoming credits were found. Check the file or the column mapping.'}
            </Callout>
          )}

          {error && previewRows.length > 0 && (
            <Callout tone="warning" title="Heads up">{error}</Callout>
          )}

          <div className="flex gap-3">
            <Button onClick={handleReconcile} loading={submitting} disabled={previewCount === 0}>
              Reconcile {previewCount} deposit{previewCount === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {phase === 'result' && report && (
        <ReconcileResult report={report} onDone={reset} />
      )}
    </div>
  )
}

// ── Result view ──────────────────────────────────────────────────────────────

function ReconcileResult({ report, onDone }: { report: ReconcileReport; onDone: () => void }) {
  const [needsReview, setNeedsReview] = useState(report.needsReview)
  const [unmatched, setUnmatched] = useState(report.unmatched)
  const [appliedExtra, setAppliedExtra] = useState(0)

  const s = report.summary
  const appliedTotal = s.applied + appliedExtra

  function onResolved(dedupeKey: string) {
    setNeedsReview((rows) => rows.filter((r) => r.dedupeKey !== dedupeKey))
    setUnmatched((rows) => rows.filter((r) => r.dedupeKey !== dedupeKey))
    setAppliedExtra((n) => n + 1)
  }

  return (
    <div className="space-y-5">
      <Callout
        tone={appliedTotal > 0 ? 'success' : 'info'}
        icon={CheckCircle2}
        title={`${appliedTotal} applied · ${needsReview.length} need review · ${unmatched.length} unmatched · ${s.duplicates} skipped`}
      >
        {s.totalDeposits} deposit{s.totalDeposits === 1 ? '' : 's'} read from the file.
      </Callout>

      {report.parseErrors.length > 0 && (
        <Callout tone="warning" title="Some rows were skipped while reading the file">
          <ul className="list-disc pl-4 space-y-0.5">
            {report.parseErrors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Callout>
      )}

      {/* Applied */}
      <section>
        <SectionHeader title={`Applied (${report.applied.length})`} />
        {report.applied.length === 0 ? (
          <EmptyState title="Nothing auto-applied" body="No confident matches in this file." />
        ) : (
          <Card padding="none">
            <div className="divide-y divide-line">
              {report.applied.map((a, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {a.shopName} <Badge tone="gray">{a.code}</Badge>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.date} · {rand(a.amount)} · {a.months} month{a.months === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{dateOnly(a.previousEndsAt)} →</p>
                    <p className="text-sm font-semibold text-brand-dark">{dateOnly(a.newEndsAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Needs review */}
      {needsReview.length > 0 && (
        <section>
          <SectionHeader title={`Needs review (${needsReview.length})`} />
          <div className="space-y-2">
            {needsReview.map((p) => (
              <PendingRow key={p.dedupeKey} pending={p} shops={report.shops} onResolved={onResolved} />
            ))}
          </div>
        </section>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <section>
          <SectionHeader title={`Unmatched (${unmatched.length})`} />
          <div className="space-y-2">
            {unmatched.map((p) => (
              <PendingRow key={p.dedupeKey} pending={p} shops={report.shops} onResolved={onResolved} />
            ))}
          </div>
        </section>
      )}

      {report.duplicates.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-500">
            {report.duplicates.length} duplicate{report.duplicates.length === 1 ? '' : 's'} skipped (already applied)
          </summary>
          <div className="mt-2 space-y-1 text-gray-500">
            {report.duplicates.map((d, i) => (
              <p key={i}>
                {d.date} · {rand(d.amount)} · {d.reference || '—'}
              </p>
            ))}
          </div>
        </details>
      )}

      <Button variant="outline" onClick={onDone}>
        Upload another file
      </Button>
    </div>
  )
}

// ── Manual-apply row (needs-review / unmatched) ──────────────────────────────

function PendingRow({
  pending,
  shops,
  onResolved,
}: {
  pending: ReconcilePending
  shops: ShopOption[]
  onResolved: (dedupeKey: string) => void
}) {
  const [shopId, setShopId] = useState(pending.candidateShopId ?? '')
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function apply() {
    if (!shopId) {
      setError('Pick a shop first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/eft-reconcile/apply-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedupe_key: pending.dedupeKey,
          deposit_date: pending.date,
          amount: pending.amount,
          raw_reference: pending.reference,
          shop_id: shopId,
          months,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data?.error === 'string' ? data.error : 'Failed to apply.')
        return
      }
      onResolved(pending.dedupeKey)
    } catch {
      setError('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-900 truncate">{pending.reference || '(no reference)'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {pending.date} · {rand(pending.amount)}
          </p>
        </div>
        <Badge tone="amber">{pending.reason}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Shop</label>
          <Select value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">Select a shop…</option>
            {shops.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.name} ({sh.code})
              </option>
            ))}
          </Select>
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-600 mb-1">Months</label>
          <Input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <Button onClick={apply} loading={busy}>
          Apply
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </Card>
  )
}
