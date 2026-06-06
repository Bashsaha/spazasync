'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { Button } from '@/components/ui/Button'
import { RobotBuddy } from './RobotBuddy'
import { SpotlightOverlay } from './SpotlightOverlay'
import { useTourTarget } from './useTourTarget'
import type { FeatureTip, GuideSignals } from '@/lib/guide/types'
import { HOME_ROUTES, IDLE_SETTLE_MS, AUTO_DISMISS_MS } from '@/lib/guide/types'
import { canAutoShow, selectTip, type SelectInput } from '@/lib/guide/select-tip'
import {
  readGuideState,
  recordShown,
  markTipSeen,
  setTipsEnabled,
  isSessionNudged,
  markSessionNudged,
} from '@/lib/guide/storage'

/**
 * Stocky orchestrator (Phase 46) — the ONLY thing AppChrome mounts. Owners/
 * admins only; dormant (renders nothing) until the calm cadence gate fires.
 *
 * Flow: on a home screen, after a few seconds of stillness, IF tips are enabled
 * + the 48h cooldown elapsed + not already nudged this session + there's an
 * on-screen tip → Stocky slides in and offers one tip ("Show me / Not now").
 * "Show me" spotlights the target element; "Got it" remembers it; "Not now"
 * leaves (cooldown applies); "Don't show tips" turns Stocky off (re-enable in
 * Settings). Hard-suppressed everywhere except the home hubs.
 */
function sastHour(): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'Africa/Johannesburg',
      }).format(new Date()),
    )
  } catch {
    return new Date().getHours()
  }
}

type Phase = 'idle' | 'nudge' | 'spotlight'

export function RobotGuide({ userId }: { userId: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation('guide')

  const [signals, setSignals] = useState<GuideSignals | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [tip, setTip] = useState<FeatureTip | null>(null)
  const [waving, setWaving] = useState(false)
  const armedRef = useRef(false) // fired once already (this mount/session)

  const onHome = (HOME_ROUTES as readonly string[]).includes(pathname)

  const buildInput = useCallback(
    (): SelectInput => {
      const st = readGuideState(userId ?? '')
      return {
        pathname,
        seen: st.seen,
        dismissedAll: st.dismissedAll,
        lastShownAt: st.lastShownAt,
        sessionNudged: isSessionNudged(),
        now: Date.now(),
        signals,
      }
    },
    [pathname, signals, userId],
  )

  // Pull trigger signals once (best-effort, read-only, SW-cached). Failure just
  // means contextual triggers stay quiet — curriculum tips still work.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch('/api/summary/daily')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setSignals({
          salesTodayCount: d.sales?.salesCount ?? 0,
          lowStockCount: Array.isArray(d.lowStock) ? d.lowStock.length : 0,
          expiringCount: Array.isArray(d.expiring) ? d.expiring.length : 0,
          productsMissingCost: d.productsMissingCost ?? 0,
          hourOfDay: sastHour(),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId])

  // Idle-settle arming: only on home screens, only once, only when the gate
  // passes. Any interaction resets the settle timer so we never interrupt.
  useEffect(() => {
    if (armedRef.current || !userId || !onHome || phase !== 'idle') return

    let timer = 0
    const fire = () => {
      if (armedRef.current) return
      const input = buildInput()
      if (!canAutoShow(input)) return
      const chosen = selectTip(input, true)
      if (!chosen) return
      armedRef.current = true
      recordShown(userId, Date.now())
      markSessionNudged()
      setTip(chosen)
      setWaving(true)
      setPhase('nudge')
    }
    const arm = () => {
      clearTimeout(timer)
      timer = window.setTimeout(fire, IDLE_SETTLE_MS)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchstart', 'keydown', 'scroll']
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    arm()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, arm))
    }
  }, [userId, onHome, phase, buildInput])

  // Auto-dismiss an ignored nudge so it never lingers.
  useEffect(() => {
    if (phase !== 'nudge') return
    const id = window.setTimeout(() => setPhase('idle'), AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [phase])

  // Resolve the target while spotlighting; abort cleanly if it never appears.
  const { rect, notFound } = useTourTarget(phase === 'spotlight' && tip ? tip.anchor : null)
  useEffect(() => {
    if (phase === 'spotlight' && notFound) {
      setPhase('idle')
      setTip(null)
    }
  }, [phase, notFound])

  const close = useCallback(() => {
    setPhase('idle')
    setTip(null)
    setWaving(false)
  }, [])

  const showMe = useCallback(() => {
    if (!tip) return
    setWaving(false)
    // Auto nudges only ever pick on-screen tips, but stay safe: navigate first
    // if the anchor lives on another route, then spotlight on arrival.
    if (tip.route && tip.route !== pathname) router.push(tip.route)
    setPhase('spotlight')
  }, [tip, pathname, router])

  const gotIt = useCallback(() => {
    if (userId && tip) markTipSeen(userId, tip.id)
    close()
  }, [userId, tip, close])

  const disable = useCallback(() => {
    if (userId) setTipsEnabled(userId, false)
    close()
  }, [userId, close])

  if (!userId || phase === 'idle' || !tip) return null

  if (phase === 'spotlight') {
    if (!rect) return null // resolving / off-screen — wait or abort via notFound
    return (
      <SpotlightOverlay
        rect={rect}
        title={t(tip.titleKey)}
        body={t(tip.bodyKey)}
        onGotIt={gotIt}
        onClose={close}
        onDisable={disable}
      />
    )
  }

  // phase === 'nudge' — robot + bubble, bottom-right, clear of the FAB & nav.
  return (
    <div
      className="fixed right-4 z-40 flex flex-col items-end stocky-pop"
      style={{ bottom: 'calc(140px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mb-2 w-[min(82vw,19rem)] bg-white rounded-2xl shadow-xl border border-line p-3.5">
        <p className="font-bold text-gray-900 text-sm">{t(tip.titleKey)}</p>
        <p className="text-sm text-gray-700 mt-0.5">{t(tip.bodyKey)}</p>
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" onClick={showMe} className="flex-1">{t('btn_show_me')}</Button>
          <Button size="sm" variant="outline" onClick={close}>{t('btn_not_now')}</Button>
        </div>
        <button
          type="button"
          onClick={disable}
          className="mt-1.5 w-full text-center text-xs text-gray-400 active:text-gray-600 py-0.5"
        >
          {t('btn_disable')}
        </button>
      </div>
      <button
        type="button"
        onClick={showMe}
        aria-label={t('robot_aria')}
        className="w-14 h-14 rounded-full bg-white shadow-lg border border-line flex items-center justify-center active:scale-95 transition-transform"
      >
        <RobotBuddy size={44} waving={waving} className="stocky-bob" />
      </button>
    </div>
  )
}
