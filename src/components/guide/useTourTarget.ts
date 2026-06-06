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
        measure(el)
        track() // start following the element
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
