'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/components/LanguageProvider'
import { BackButton } from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { ConfirmModal } from '@/components/ConfirmModal'
import { Skeleton } from '@/components/Skeleton'
import type { PestControlLog } from '@/types'
import { useCachedData } from '@/hooks/useCachedData'
import { emitDataChanged } from '@/lib/events'

export default function PestControlListPage() {
  const { t, locale } = useTranslation('waste-pest')
  const { addToast } = useToast()

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Cache-first: paint the last-known pest-control log instantly, revalidate in
  // the background, re-fetch on resume / mutation. (Phase 44b)
  const { data, loading, error } = useCachedData<{ logs: PestControlLog[] }>(
    'pest-control',
    () =>
      fetch('/api/pest-control').then((r) => {
        if (!r.ok) throw new Error('load failed')
        return r.json() as Promise<{ logs: PestControlLog[] }>
      }),
  )
  const logs = data?.logs ?? []

  async function handleDelete() {
    if (!confirmId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/pest-control/${confirmId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      // emitDataChanged() triggers the cache-first refresh, which drops the
      // deleted row from the list + updates the snapshot.
      emitDataChanged()
      addToast(t('msg_visit_deleted'), 'success')
    } catch {
      addToast(t('error_generic'), 'error')
    } finally {
      setDeleting(false)
      setConfirmId(null)
    }
  }

  const localeTag = locale === 'en' ? 'en-ZA' : locale
  function fmtDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(localeTag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <main className="px-4 pt-10 pb-24 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <BackButton fallbackHref="/waste-pest" />
        <h1 className="text-2xl font-bold text-gray-900">{t('pest_title')}</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">{t('pest_subtitle')}</p>

      <Link
        href="/waste-pest/pest/new"
        className="block w-full bg-brand text-white text-center font-bold py-4 rounded-full active:bg-brand-hover mb-6"
      >
        + {t('pest_add_btn')}
      </Link>

      {error && <p className="text-red-500 text-sm mb-4">{t('msg_load_failed')}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">{t('pest_empty')}</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 "
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{log.provider_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fmtDate(log.visit_date)} · {log.treatment_type}
                  </p>
                  {log.notes && (
                    <p className="text-xs text-gray-400 mt-2 whitespace-pre-line">{log.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmId(log.id)}
                  className="text-xs text-red-600 font-medium px-2 py-1 rounded-full active:bg-red-50 shrink-0"
                >
                  {t('pest_delete_btn')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmId && (
        <ConfirmModal
          message={`${t('pest_delete_confirm_title')}\n\n${t('pest_delete_confirm_msg')}`}
          confirmLabel={deleting ? t('btn_saving') : t('pest_delete_confirm_yes')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmId(null)}
          isDestructive
        />
      )}
    </main>
  )
}
