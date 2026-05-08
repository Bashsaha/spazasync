'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

// Chrome's beforeinstallprompt event isn't in lib.dom yet. Local type covers
// the two members we touch.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'spaza_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS Safari uses navigator.standalone instead of the media query.
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    if (!Number.isFinite(at)) return false
    return Date.now() - at < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

/** Dismissible "Add to Home Screen" prompt for the dashboard.
 *
 *  - Android/desktop Chrome/Edge: captures `beforeinstallprompt` and exposes a
 *    real install button that triggers the native prompt.
 *  - iOS Safari: no programmatic prompt exists, so we render manual
 *    instructions instead.
 *  - Hidden once installed (display-mode: standalone) or dismissed within
 *    the last 7 days.
 */
export function InstallPwaButton() {
  const { t } = useTranslation('common')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    if (isDismissedRecently()) {
      setDismissed(true)
      return
    }
    if (isIos()) {
      setShowIos(true)
      return
    }
    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    if (choice.outcome === 'dismissed') dismiss()
  }

  if (installed || dismissed) return null
  // Nothing to show: not installed, no native prompt fired, not iOS.
  if (!deferred && !showIos) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-blue-900">{t('install_title')}</p>
      <p className="text-xs text-blue-800 mt-1">{t('install_desc')}</p>

      {deferred ? (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={install}
            className="flex-1 bg-blue-600 text-white text-sm font-semibold py-2 rounded-xl active:bg-blue-700 min-h-[40px]"
          >
            {t('install_button')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 text-sm text-blue-700 active:text-blue-900 min-h-[40px]"
          >
            {t('install_dismiss')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-blue-800 mt-2">{t('install_ios_hint')}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 text-xs text-blue-700 font-semibold active:text-blue-900"
          >
            {t('install_dismiss')}
          </button>
        </>
      )}
    </div>
  )
}
