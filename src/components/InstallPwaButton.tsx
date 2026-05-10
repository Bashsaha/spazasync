'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

// Chrome's beforeinstallprompt event isn't in lib.dom yet. Local type covers
// the two members we touch.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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

/** "Add to Home Screen" prompt for the dashboard.
 *
 *  Always visible until the app is actually installed:
 *  - Android/desktop Chrome/Edge: shows the install button as soon as
 *    `beforeinstallprompt` fires; "Not now" closes it for the current
 *    page-load only — it returns on the next navigation/refresh.
 *  - iOS Safari: shows manual instructions (no programmatic prompt exists).
 *  - Hides permanently only when display-mode flips to standalone or the
 *    `appinstalled` event fires.
 */
export function InstallPwaButton() {
  const { t } = useTranslation('common')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [hiddenForSession, setHiddenForSession] = useState(false)
  const [showIos, setShowIos] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    if (isIos()) {
      setShowIos(true)
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

  function hideForNow() {
    setHiddenForSession(true)
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    // If the user dismissed Chrome's native prompt, leave the banner visible
    // so they can try again — the banner only goes away once `appinstalled`
    // fires or the app loads in standalone mode.
    if (choice.outcome === 'accepted') {
      // appinstalled handler will flip `installed` to true.
    }
  }

  if (installed || hiddenForSession) return null
  // Nothing to show: not installed, no native prompt fired, not iOS.
  if (!deferred && !showIos) return null

  return (
    <div className="bg-brand-light border border-brand-light rounded-2xl p-4 mb-4">
      <p className="text-sm font-semibold text-brand-hover">{t('install_title')}</p>
      <p className="text-xs text-brand-hover mt-1">{t('install_desc')}</p>

      {deferred ? (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={install}
            className="flex-1 bg-brand text-white text-sm font-semibold py-2 rounded-full active:bg-brand-hover min-h-[40px]"
          >
            {t('install_button')}
          </button>
          <button
            type="button"
            onClick={hideForNow}
            className="px-4 text-sm text-brand-hover active:text-brand-hover min-h-[40px]"
          >
            {t('install_dismiss')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-brand-hover mt-2">{t('install_ios_hint')}</p>
          <button
            type="button"
            onClick={hideForNow}
            className="mt-2 text-xs text-brand-hover font-semibold active:text-brand-hover"
          >
            {t('install_dismiss')}
          </button>
        </>
      )}
    </div>
  )
}
