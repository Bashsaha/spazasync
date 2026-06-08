'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useTranslation } from '@/components/LanguageProvider'
import { createClient } from '@/lib/supabase/client'
import { readTipsEnabled, setTipsEnabled, resetIntro } from '@/lib/guide/storage'

/**
 * Settings re-entry toggle for Stocky (Phase 46). Self-contained: resolves its
 * own userId + reads/writes the per-user localStorage flag, so the settings page
 * only has to drop it in. This is the calm way back after "Don't show tips".
 */
export function GuideTipsToggle() {
  const { t } = useTranslation('guide')
  const [userId, setUserId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await createClient().auth.getUser()
      if (cancelled || !data.user) return
      setUserId(data.user.id)
      setEnabled(readTipsEnabled(data.user.id))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function toggle() {
    if (!userId) return
    const next = !enabled
    setEnabled(next)
    setTipsEnabled(userId, next)
    // Re-enabling is an explicit "show me the helper again" → let the one-time
    // welcome (and the first-visit caption) run once more.
    if (next) resetIntro(userId)
  }

  return (
    <Card padding="md" className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-brand" strokeWidth={1.75} />
            <p className="font-semibold text-gray-900">{t('settings_section')}</p>
          </div>
          <p className="text-sm text-gray-500">{t('settings_desc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t('settings_label')}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            enabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </Card>
  )
}
