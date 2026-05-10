'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import { Skeleton } from '@/components/Skeleton'
import type { BusinessDocument, DocumentType } from '@/types'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'
import { computeDocumentStatus } from '@/lib/compliance/document-status'
import { useRefetchOnVisible } from '@/hooks/useRefetchOnVisible'

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type PillTone = 'green' | 'amber' | 'red' | 'grey'

function pillTone(doc: BusinessDocument | null, today: string): PillTone {
  if (!doc) return 'grey'
  if (doc.status === 'expired') return 'red'
  if (doc.status === 'not_registered' || doc.status === 'pending') return 'amber'
  if (doc.expiry_date) {
    const days = Math.round(
      (Date.parse(doc.expiry_date) - Date.parse(today)) / (1000 * 60 * 60 * 24),
    )
    if (days < 0) return 'red'
    const window = doc.document_type === 'owner_id' ? 60 : 30
    if (days <= window) return 'amber'
  }
  return 'green'
}

const PILL_STYLES: Record<PillTone, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  grey: 'bg-gray-100 text-gray-500',
}

const HERO_STYLES: Record<PillTone, { wrap: string; text: string }> = {
  green: { wrap: 'bg-green-50 border-green-200', text: 'text-green-800' },
  amber: { wrap: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  red: { wrap: 'bg-red-50 border-red-200', text: 'text-red-800' },
  grey: { wrap: 'bg-brand-light border-brand-light', text: 'text-brand-hover' },
}

export default function DocumentsPage() {
  const { t, tPlural } = useTranslation('documents')
  const [docs, setDocs] = useState<BusinessDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [errorKey, setErrorKey] = useState('')

  const loadDocs = useCallback(() => {
    fetch('/api/business-documents', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        setDocs(await res.json())
        setErrorKey('')
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  useRefetchOnVisible(loadDocs)

  const today = todayYmd()
  const docByType = useMemo(() => {
    const map: Partial<Record<DocumentType, BusinessDocument>> = {}
    for (const d of docs) map[d.document_type] = d
    return map
  }, [docs])

  const summary = useMemo(() => computeDocumentStatus(docs, today), [docs, today])

  const heroTone: PillTone = summary.overall

  const heroMessage = (() => {
    if (heroTone === 'grey') return t('hero_grey')
    if (heroTone === 'green') return t('hero_green')
    if (heroTone === 'amber') {
      const count = summary.expiringSoon.length + summary.missing.length +
        docs.filter((d) => d.status === 'pending' || d.status === 'not_registered').length
      return tPlural('hero_amber', count, { count })
    }
    return tPlural('hero_red', summary.expired.length, { count: summary.expired.length })
  })()

  const heroDesc = heroTone === 'grey'
    ? t('hero_grey_desc')
    : heroTone === 'green'
      ? t('hero_green_desc')
      : null

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/profile" className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-4">{t('subtitle')}</p>

      {errorKey && <p className="text-red-500 text-sm mb-4">{t(errorKey)}</p>}

      {loading ? (
        <>
          <Skeleton className="h-20 rounded-2xl mb-6" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={`rounded-2xl border px-4 py-3 mb-6 ${HERO_STYLES[heroTone].wrap}`}>
            <p className={`text-sm font-semibold ${HERO_STYLES[heroTone].text}`}>{heroMessage}</p>
            {heroDesc && <p className={`text-xs mt-1 ${HERO_STYLES[heroTone].text} opacity-80`}>{heroDesc}</p>}
          </div>

          <ul className="space-y-2">
            {DOCUMENT_TYPES.map((type) => {
              const doc = docByType[type] ?? null
              const tone = pillTone(doc, today)
              const pillKey = tone === 'grey' ? 'pill_grey' : `pill_${tone}`
              return (
                <li key={type}>
                  <Link
                    href={`/documents/${type}`}
                    className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100 active:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{t(`doc_${type}`)}</p>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${PILL_STYLES[tone]}`}>
                          {t(pillKey)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {doc?.reference_number ? doc.reference_number : t(`desc_${type}`)}
                      </p>
                      {doc?.expiry_date && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {t('label_expiry_date')}: {doc.expiry_date}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-300 text-lg ml-2">&rsaquo;</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}
