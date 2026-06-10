'use client'

import { useEffect, useState } from 'react'

export interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Resolve a `data-tour="<anchor>"` element to a live viewport rect (Phase 46).
 *
 * - Polls briefly for the element to appear (it may mount after a navigation or
 *   a conditional render). If it never shows within the timeout, returns
 *   `notFound` so the caller can abort gracefully — Stocky never shows an empty
 *   spotlight or throws.
 * - On first resolve, if the element sits outside a comfortable viewport band
 *   (e.g. below the fold), it is scrolled into view (Phase 49) so the spotlight
 *   isn't pointing at something off-screen. The rect tracker below re-glues the
 *   highlight to the element as the page scrolls. Respects reduced-motion.
 * - While active, tracks the rect on scroll/resize (rAF-throttled) so the
 *   highlight stays glued to the element if the layout shifts.
 *
 * `anchor` of null disables the hook (idle state).
 */
export function useTourTarget(anchor: string | null): {
  rect: TargetRect | null
  notFound: boolean
} {
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!anchor) {
      setRect(null)
      setNotFound(false)
      return
    }

    let cancelled = false
    let rafId = 0
    let pollId = 0
    const selector = `[data-tour="${CSS.escape(anchor)}"]`
    const deadline = Date.now() + 2500

    const measure = (el: Element) => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // Scroll an off-screen target into view once, when first resolved. The band
    // leaves room for the sticky top bar and the speech bubble below, so a
    // target that's already comfortably visible isn't nudged.
    const scrollIntoViewIfNeeded = (el: Element) => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 0
      const topBand = 96 // sticky TopAppBar + breathing room
      const bottomBand = vh - 120 // leave space for the bubble/buttons
      if (r.top < topBand || r.bottom > bottomBand) {
        const reduce =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
      }
    }

    const track = () => {
      if (cancelled) return
      const el = document.querySelector(selector)
      if (el) measure(el)
      rafId = requestAnimationFrame(track)
    }

    const poll = () => {
      if (cancelled) return
      const el = document.querySelector(selector)
      if (el) {
        setNotFound(false)
        scrollIntoViewIfNeeded(el)
        measure(el)
        track() // start following the element (and keep up with the scroll)
        return
      }
      if (Date.now() > deadline) {
        setNotFound(true)
        return
      }
      pollId = window.setTimeout(poll, 80)
    }

    poll()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      clearTimeout(pollId)
    }
  }, [anchor])

  return { rect, notFound }
}
