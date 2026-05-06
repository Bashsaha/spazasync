'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Spinner, FullScreenSpinner } from '@/components/Spinner'
import type { BusinessDocument, DocumentStatus, DocumentType } from '@/types'
import { DOCUMENT_TYPES } from '@/lib/validation/schemas'
import { emitDataChanged } from '@/lib/events'

const STATUS_OPTIONS: Record<DocumentType, DocumentStatus[]> = {
  municipal_registration: ['valid', 'pending', 'not_registered'],
  coa: ['valid', 'expired', 'pending', 'not_required'],
  cipc: ['valid', 'not_registered', 'not_required'],
  business_license: ['valid', 'expired', 'pending', 'not_required'],
  owner_id: ['on_file', 'pending'], // foreign-national path uses 'valid'
  // Phase 37b — captured by Compliance Onboarding flow
  sars_tax: ['valid', 'pending', 'not_registered'],
  uif: ['valid', 'pending', 'not_registered', 'not_required'],
  food_safety_training: ['on_file', 'pending', 'not_registered'],
  smmesa: ['valid', 'pending', 'not_registered'],
}

const HAS_EXPIRY: Record<DocumentType, boolean> = {
  municipal_registration: false,
  coa: true,
  cipc: false,
  business_license: true,
  owner_id: false,
  sars_tax: false,
  uif: false,
  food_safety_training: true,
  smmesa: false,
}

const PERMIT_TYPES = [
  'business_visa',
  'asylum',
  'refugee',
  'permanent_residency',
  'work',
  'other',
] as const

type PermitType = (typeof PERMIT_TYPES)[number]

function isValidType(raw: string): raw is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(raw)
}

export default function EditDocumentPage() {
  const router = useRouter()
  const params = useParams<{ type: string }>()
  const { t } = useTranslation('documents')

  const type = params?.type as string
  const validType = useMemo(() => isValidType(type), [type])

  const [doc, setDoc] = useState<BusinessDocument | null>(null)
  const [status, setStatus] = useState<DocumentStatus>('valid')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [dateIssued, setDateIssued] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')

  // Owner-ID extras
  const [ownerMode, setOwnerMode] = useState<'sa' | 'foreign'>('sa')
  const [permitType, setPermitType] = useState<PermitType>('business_visa')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorKey, setErrorKey] = useState('')
  const [errorRaw, setErrorRaw] = useState('')
  const [message, setMessage] = useState('')
  const [showClear, setShowClear] = useState(false)

  useEffect(() => {
    if (!validType) {
      setLoading(false)
      return
    }
    fetch(`/api/business-documents/${type}`)
      .then(async (res) => {
        if (res.status === 404) {
          // Not logged yet — set sensible defaults per type
          if (type === 'owner_id') {
            setStatus('on_file')
          } else if (type === 'municipal_registration' || type === 'cipc') {
            setStatus('pending')
          } else {
            setStatus('valid')
          }
          return
        }
        if (!res.ok) throw new Error()
        const data: BusinessDocument = await res.json()
        setDoc(data)
        setStatus(data.status)
        setReferenceNumber(data.reference_number ?? '')
        setDateIssued(data.date_issued ?? '')
        setExpiryDate(data.expiry_date ?? '')
        setNotes(data.notes ?? '')

        if (type === 'owner_id') {
          if (data.status === 'on_file') {
            setOwnerMode('sa')
          } else {
            setOwnerMode('foreign')
            if (data.notes && (PERMIT_TYPES as readonly string[]).includes(data.notes)) {
              setPermitType(data.notes as PermitType)
            }
          }
        }
      })
      .catch(() => setErrorKey('error_load'))
      .finally(() => setLoading(false))
  }, [type, validType])

  if (!validType) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-red-500 text-sm">{t('error_load')}</p>
      </main>
    )
  }

  const docType = type as DocumentType

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrorKey('')
    setErrorRaw('')
    setMessage('')
    setSaving(true)

    // Shape body by doc type
    let bodyStatus: DocumentStatus = status
    let bodyNotes: string | null = notes.trim() || null
    let bodyExpiry: string | null = expiryDate || null
    const bodyDateIssued: string | null = dateIssued || null
    const bodyRef: string | null = referenceNumber.trim() || null

    if (docType === 'owner_id') {
      if (ownerMode === 'sa') {
        bodyStatus = 'on_file'
        bodyNotes = null
        bodyExpiry = null
      } else {
        bodyStatus = 'valid'
        bodyNotes = permitType
      }
    }

    try {
      const res = await fetch(`/api/business-documents/${docType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: bodyStatus,
          reference_number: bodyRef,
          date_issued: bodyDateIssued,
          expiry_date: bodyExpiry,
          notes: bodyNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data?.error) setErrorRaw(data.error)
        else setErrorKey('error_save')
        return
      }
      setDoc(data as BusinessDocument)
      setMessage('msg_saved')
      emitDataChanged()
    } catch {
      setErrorKey('error_generic')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    try {
      const res = await fetch(`/api/business-documents/${docType}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        emitDataChanged()
        router.push('/documents')
      } else {
        setErrorKey('error_clear')
      }
    } catch {
      setErrorKey('error_generic')
    }
  }

  const errorMessage = errorRaw || (errorKey ? t(errorKey) : '')

  if (loading) {
    return (
      <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
        <p className="text-gray-400 text-sm">{t('loading')}</p>
      </main>
    )
  }

  const showExpiry = HAS_EXPIRY[docType] || (docType === 'owner_id' && ownerMode === 'foreign')
  const showReference = docType !== 'owner_id'
  const showDateIssued = docType !== 'owner_id'
  const showMunicipality = docType === 'municipal_registration'
  const isOwnerId = docType === 'owner_id'

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg mx-auto">
      {saving && <FullScreenSpinner label={t('btn_saving')} />}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 active:text-gray-600 text-sm">
          {t('back')}
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t(`doc_${docType}`)}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t(`desc_${docType}`)}</p>

      <form onSubmit={handleSave} className="space-y-4">
        {isOwnerId && (
          <div className="bg-gray-50 rounded-2xl p-1 flex gap-1">
            <button
              type="button"
              onClick={() => setOwnerMode('sa')}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl ${
                ownerMode === 'sa' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              {t('owner_mode_sa')}
            </button>
            <button
              type="button"
              onClick={() => setOwnerMode('foreign')}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl ${
                ownerMode === 'foreign' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              {t('owner_mode_foreign')}
            </button>
          </div>
        )}

        {isOwnerId && ownerMode === 'sa' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={status === 'on_file'}
                onChange={(e) => setStatus(e.target.checked ? 'on_file' : 'pending')}
                className="mt-1 w-5 h-5 accent-emerald-600"
              />
              <div>
                <p className="font-semibold text-emerald-900">{t('owner_id_on_file')}</p>
                <p className="text-xs text-emerald-700 mt-1">{t('owner_id_on_file_hint')}</p>
              </div>
            </label>
          </div>
        ) : isOwnerId && ownerMode === 'foreign' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_permit_type')}
            </label>
            <select
              value={permitType}
              onChange={(e) => setPermitType(e.target.value as PermitType)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {PERMIT_TYPES.map((p) => (
                <option key={p} value={p}>
                  {t(`permit_${p}`)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DocumentStatus)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STATUS_OPTIONS[docType].map((s) => (
                <option key={s} value={s}>
                  {t(`status_${s}`)}
                </option>
              ))}
            </select>
          </div>
        )}

        {showReference && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_reference_number')}
            </label>
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={t('placeholder_reference_number')}
              maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {showDateIssued && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_date_issued')}
            </label>
            <input
              type="date"
              value={dateIssued}
              onChange={(e) => setDateIssued(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {showExpiry && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isOwnerId ? t('label_permit_expiry') : t('label_expiry_date')}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {showMunicipality && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('label_municipality')}
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('placeholder_municipality')}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!showMunicipality && !isOwnerId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('label_notes')}</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('placeholder_notes')}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
        {message && <p className="text-green-600 text-sm">{t(message)}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl active:bg-blue-700 disabled:opacity-50 min-h-[48px]"
        >
          {saving ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner size="sm" />
              {t('btn_saving')}
            </span>
          ) : (
            t('btn_save')
          )}
        </button>
      </form>

      {doc && (
        <div className="mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowClear(true)}
            className="w-full text-red-500 font-semibold py-3 text-sm active:text-red-700"
          >
            {t('btn_clear')}
          </button>
        </div>
      )}

      {showClear && (
        <ConfirmModal
          message={t('confirm_clear', { doc: t(`doc_${docType}`) })}
          confirmLabel={t('btn_clear')}
          isDestructive
          onConfirm={handleClear}
          onCancel={() => setShowClear(false)}
        />
      )}
    </main>
  )
}
