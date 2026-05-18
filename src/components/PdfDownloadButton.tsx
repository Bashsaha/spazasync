'use client'

/**
 * BUG-039 — Clean PDF download trigger.
 *
 * Why this exists: rendering PDF download endpoints as `<a href="/api/reports/…">`
 * makes the browser treat the click as a navigation, so Chrome shows the top
 * progress bar (the "loading a new page" indicator) until the server's
 * Content-Disposition header kicks in. On slow networks the bar can sit there
 * for several seconds, which looks broken / sketchy even though the download
 * eventually fires.
 *
 * This component does the download via fetch + Blob + a programmatic anchor
 * click. No navigation, no top progress bar. The button itself reports the
 * in-flight state via `disabled` + `aria-busy` so consumers can dim/animate it.
 */

import { useState, type ReactNode } from 'react'

interface Props {
  /** API endpoint that returns the PDF (Content-Disposition: attachment). */
  href: string
  /** Filename to use if the server didn't set Content-Disposition. */
  fallbackFilename?: string
  /** Tailwind classes for the button — caller owns all visual styling. */
  className?: string
  /** Pre-existing disabled state (e.g. "no rows to export yet"). */
  disabled?: boolean
  /** ARIA label override (use when children is icon-only). */
  ariaLabel?: string
  /** Called with a human-readable message when the download fails. */
  onError?: (message: string) => void
  /** Button content. Stays rendered during download (consumers should use
   *  `disabled:opacity-…` / `aria-busy:cursor-wait` to convey progress). */
  children: ReactNode
}

export function PdfDownloadButton({
  href,
  fallbackFilename = 'movestock-document.pdf',
  className,
  disabled = false,
  ariaLabel,
  onError,
  children,
}: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleClick() {
    if (disabled || downloading) return
    setDownloading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) {
        let msg = `Download failed (${res.status})`
        try {
          const j = (await res.json()) as { error?: unknown }
          if (typeof j?.error === 'string') msg = j.error
        } catch {
          /* response wasn't JSON — keep the default message */
        }
        onError?.(msg)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const filename = match ? decodeURIComponent(match[1]) : fallbackFilename
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || downloading}
      aria-label={ariaLabel}
      aria-busy={downloading || undefined}
      data-downloading={downloading ? 'true' : undefined}
      className={className}
    >
      {children}
    </button>
  )
}
