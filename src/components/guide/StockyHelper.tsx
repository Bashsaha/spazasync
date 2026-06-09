'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { RobotBuddy } from './RobotBuddy'
import { SpotlightOverlay } from './SpotlightOverlay'
import { StockyTipSheet } from './StockyTipSheet'
import { useTourTarget } from './useTourTarget'
import type { FeatureTip, GuideSignals } from '@/lib/guide/types'
import { GUIDE_ROUTES, INTRO_ROUTE, IDLE_SETTLE_MS, HELPER_HINT_MAX } from '@/lib/guide/types'
import { listPageTips, hasActiveTip, type SelectInput } from '@/lib/guide/select-tip'
import {
  readGuideState,
  markTipSeen,
  markIntroSeen,
  bumpHelperHint,
  markSheetOpened,
} from '@/lib/guide/storage'

/**
 * Stocky orchestrator (Phase 47) — rendered inside the TopAppBar (owners/admins
 * only). The owner can TAP the resting robot button any time to get help about
 * the page they're on; an amber dot flags when something needs attention. A
 * one-time welcome spotlights the button itself so it gets discovered.
 *
 * Phases:
 *   - idle      — just the resting button (+ dot / first-visit caption)
 *   - intro     — one-time welcome: spotlight the button itself
 *   - sheet      — "What can I show you here?" list of this page's tips
 *   - spotlight — highlight the real element for a chosen tip
 *
 * Hidden entirely off guide routes, on /sale, and when tips are turned off.
 */
type Phase = 'idle' | 'intro' | 'sheet' | 'spotlight'

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

export function StockyHelper({ userId }: { userId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation('guide')

  const [signals, setSignals] = useState<GuideSignals | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [tip, setTip] = useState<FeatureTip | null>(null)
  const [stateV, setStateV] = useState(0) // bump to re-read persisted state
  const [showHint, setShowHint] = useState(false)
  const introArmed = useRef(false)
  const hintArmed = useRef(false)
  const firstOpenRef = useRef(false)

  // Re-read persisted state only when we've changed it (cheap + stable refs).
  const state = useMemo(() => readGuideState(userId), [userId, stateV])

  const onGuideRoute = (GUIDE_ROUTES as readonly string[]).includes(pathname)
  const visible = !state.dismissedAll && onGuideRoute

  const input: SelectInput = useMemo(
    () => ({ pathname, seen: state.seen, signals }),
    [pathname, state.seen, signals],
  )
  const pageTips = useMemo(() => listPageTips(input), [input])
  const showDot = useMemo(() => hasActiveTip(input), [input])

  // Pull trigger signals once (best-effort, read-only, SW-cached). Failure just
  // means the dot/contextual tips stay quiet — route tips still work.
  useEffect(() => {
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
  }, [])

  // One-time welcome: on the dashboard, after a few seconds of stillness, fire
  // the spotlight pointing at the Stocky button. Any interaction resets the
  // settle timer so we never interrupt someone who just arrived.
  useEffect(() => {
    if (introArmed.current) return
    if (!visible) return
    if (state.introShownAt !== 0) return
    if (pathname !== INTRO_ROUTE) return
    if (phase !== 'idle') return

    let timer = 0
    const fire = () => {
      if (introArmed.current) return
      introArmed.current = true
      setPhase('intro')
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
  }, [visible, state.introShownAt, pathname, phase])

  // After the welcome, gently caption the button "Tap me for help" on the first
  // few home-screen visits, then never again.
  useEffect(() => {
    if (hintArmed.current) return
    if (!visible || phase !== 'idle') return
    if (state.introShownAt === 0) return
    if (state.helperHintCount >= HELPER_HINT_MAX) return
    hintArmed.current = true
    bumpHelperHint(userId)
    setShowHint(true)
    const id = window.setTimeout(() => setShowHint(false), 4500)
    return () => clearTimeout(id)
  }, [visible, phase, state.introShownAt, state.helperHintCount, userId])

  // Resolve the spotlight target (the button itself in intro, else the tip's
  // anchor). Abort cleanly if it never appears.
  const targetAnchor =
    phase === 'intro' ? 'stocky-helper' : phase === 'spotlight' && tip ? tip.anchor : null
  const { rect, notFound } = useTourTarget(targetAnchor)
  useEffect(() => {
    if ((phase === 'intro' || phase === 'spotlight') && notFound) {
      setPhase('idle')
      setTip(null)
    }
  }, [phase, notFound])

  const closeAll = useCallback(() => {
    setPhase('idle')
    setTip(null)
  }, [])

  const pickTip = useCallback(
    (chosen: FeatureTip) => {
      setTip(chosen)
      // Route tips match the current page, but stay safe for ambient anchors.
      if (chosen.route && chosen.route !== pathname) router.push(chosen.route)
      setPhase('spotlight')
    },
    [pathname, router],
  )

  const openHelp = useCallback(() => {
    setShowHint(false)
    firstOpenRef.current = !state.helperSheetOpened
    markSheetOpened(userId)
    // If they discovered + tapped the button before the welcome fired, that
    // counts as discovery — don't pop the welcome afterwards.
    if (state.introShownAt === 0) markIntroSeen(userId, Date.now())
    if (pageTips.length === 1) {
      pickTip(pageTips[0].tip)
    } else {
      setPhase('sheet')
    }
    setStateV((v) => v + 1)
  }, [state.helperSheetOpened, state.introShownAt, userId, pageTips, pickTip])

  const introAck = useCallback(() => {
    markIntroSeen(userId, Date.now())
    setPhase('idle')
    setStateV((v) => v + 1)
  }, [userId])

  const gotIt = useCallback(() => {
    if (tip) markTipSeen(userId, tip.id)
    setTip(null)
    setPhase('idle')
    setStateV((v) => v + 1)
  }, [tip, userId])

  return (
    <>
      {visible && (
        <div className="relative">
          <button
            type="button"
            data-tour="stocky-helper"
            onClick={openHelp}
            aria-label={showDot ? t('helper_aria_tip') : t('robot_aria')}
            className="relative flex items-center justify-center w-9 h-9 rounded-full active:scale-95 transition-transform"
          >
            <RobotBuddy size={30} />
            {showDot && (
              <span
                aria-hidden
                className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#F5A623] ring-2 ring-white"
              />
            )}
          </button>
          {showHint && (
            <div className="absolute right-0 top-full mt-1 z-50 whitespace-nowrap rounded-full bg-gray-900 text-white text-xs px-3 py-1.5 shadow-lg stocky-pop">
              {t('helper_hint')}
            </div>
          )}
        </div>
      )}

      {visible && phase === 'sheet' && (
        <StockyTipSheet
          tips={pageTips}
          firstOpen={firstOpenRef.current}
          onPick={pickTip}
          onClose={closeAll}
        />
      )}

      {visible && phase === 'intro' && rect && (
        <SpotlightOverlay
          rect={rect}
          title={t('intro_title')}
          body={t('intro_body')}
          gotItOnly
          onGotIt={introAck}
          onClose={introAck}
        />
      )}

      {visible && phase === 'spotlight' && tip && rect && (
        <SpotlightOverlay
          rect={rect}
          title={t(tip.titleKey)}
          body={t(tip.bodyKey)}
          onGotIt={gotIt}
          onClose={closeAll}
        />
      )}
    </>
  )
}
