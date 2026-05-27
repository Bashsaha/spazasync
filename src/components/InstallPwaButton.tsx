'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/LanguageProvider'

// Chrome's beforeinstallprompt event isn't in lib.dom yet. Local type covers
// the two members we touch.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __bipEvent?: BeforeInstallPromptEvent | null
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

/** "Add to Home Screen" prompt.
 *
 *  Visibility:
 *  - Hidden when running in standalone (display-mode: standalone or iOS
 *    navigator.standalone) — i.e. the app is actually installed.
 *  - Hidden on desktop (anything that's not iOS or Android). Desktop users
 *    who want to install can use Chrome's address-bar install icon; the
 *    on-page banner only ever has actionable copy for mobile.
 *  - On iOS/Android: if Chrome fired `beforeinstallprompt`, the button
 *    triggers the native install dialog. If it didn't, we show
 *    platform-specific manual instructions (Android menu / iOS share).
 *  - "Not now" hides the banner for the current page-load only; it returns
 *    on the next navigation/refresh.
 *
 *  The `beforeinstallprompt` event is captured by an inline script in the
 *  root layout and stashed on `window.__bipEvent` — Chrome only fires it
 *  once and often before React hydrates, so reading it from window covers
 *  the late-mount case.
 */
export function InstallPwaButton() {
  const { t } = useTranslation('common')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [hiddenForSession, setHiddenForSession] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (isStandalone()) {
      setInstalled(true)
      return
    }

    setPlatform(isIos() ? 'ios' : isAndroid() ? 'android' : 'other')

    if (typeof window !== 'undefined' && window.__bipEvent) {
      setDeferred(window.__bipEvent)
    }

    function onReady() {
      if (window.__bipEvent) setDeferred(window.__bipEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    function onPrompt(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('bip-ready', onReady)
    window.addEventListener('bip-installed', onInstalled)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('bip-ready', onReady)
      window.removeEventListener('bip-installed', onInstalled)
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
    if (typeof window !== 'undefined') window.__bipEvent = null
    if (choice.outcome === 'accepted') {
      // appinstalled handler will flip `installed` to true.
    }
  }

  // Server render must match initial client render — render nothing until
  // we've confirmed the runtime state on the client. (Keeps hydration clean
  // and avoids a flash of the banner on already-installed standalone clients.)
  if (!mounted) return null
  if (installed || hiddenForSession) return null
  // Desktop: nothing actionable to show. Chrome's address-bar install icon
  // covers the rare desktop user who wants to install.
  if (platform === 'other') return null

  const hint = platform === 'ios' ? t('install_ios_hint') : t('install_android_hint')

  return (
    <div className="bg-brand-light border border-brand-light rounded-2xl p-4 mb-4 mx-4 mt-4">
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
          {hint && <p className="text-xs text-brand-hover mt-2">{hint}</p>}
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
