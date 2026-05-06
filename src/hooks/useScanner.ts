'use client'

import { useRef, useCallback, useState } from 'react'
import type { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'

interface UseScannerOptions {
  onScan: (barcode: string) => void
  onError?: (err: Error) => void
}

interface UseScannerReturn {
  startScanning: (videoEl: HTMLVideoElement) => Promise<void>
  stopScanning: () => void
  setZoom: (level: number) => Promise<void>
  zoomCapability: { min: number; max: number; step: number } | null
  focusAt: (x: number, y: number) => Promise<void>
  isScanning: boolean
}

// Track-level capabilities Chrome Android exposes but TS lib.dom doesn't type yet.
type ExtendedCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  zoom?: { min: number; max: number; step: number } | number[]
  pointsOfInterest?: unknown
}

export function useScanner({ onScan, onError }: UseScannerOptions): UseScannerReturn {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const hasScanned = useRef(false)
  const [isScanning, setIsScanning] = useState(false)
  const [zoomCapability, setZoomCapability] = useState<UseScannerReturn['zoomCapability']>(null)

  const stopScanning = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    trackRef.current = null
    setIsScanning(false)
    setZoomCapability(null)
  }, [])

  const setZoom = useCallback(async (level: number) => {
    const track = trackRef.current
    if (!track) return
    const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities
    if (!caps.zoom) return
    const min = typeof caps.zoom === 'object' && 'min' in caps.zoom ? caps.zoom.min : 1
    const max = typeof caps.zoom === 'object' && 'max' in caps.zoom ? caps.zoom.max : 1
    const clamped = Math.min(Math.max(level, min), max)
    await track
      .applyConstraints({
        // @ts-expect-error — zoom is a valid advanced constraint on Chrome Android
        advanced: [{ zoom: clamped }],
      })
      .catch(() => {})
  }, [])

  const focusAt = useCallback(async (x: number, y: number) => {
    const track = trackRef.current
    if (!track) return
    const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities
    if (!caps.pointsOfInterest) return
    await track
      .applyConstraints({
        // @ts-expect-error — pointsOfInterest is a valid advanced constraint on Chrome Android
        advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' }],
      })
      .catch(() => {})
  }, [])

  const startScanning = useCallback(
    async (videoEl: HTMLVideoElement) => {
      hasScanned.current = false

      if (!readerRef.current) {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        // SA retail is overwhelmingly EAN-13 (groceries), with EAN-8 (smaller items),
        // UPC-A/E (US imports), and Code-128 (in-house labels). Restricting formats +
        // TRY_HARDER flips ZXing into a slower-but-much-more-tolerant decoder mode.
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        readerRef.current = new BrowserMultiFormatReader(hints)
      }

      try {
        const controls = await readerRef.current.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              // @ts-expect-error — focusMode is a valid MediaTrackConstraint on Chrome Android
              focusMode: 'continuous',
            },
            audio: false,
          },
          videoEl,
          (result, error) => {
            if (error && error.name !== 'NotFoundException') {
              onError?.(error as Error)
            }
            if (result && !hasScanned.current) {
              hasScanned.current = true
              controlsRef.current?.stop()
              controlsRef.current = null
              trackRef.current = null
              setIsScanning(false)
              setZoomCapability(null)
              onScan(result.getText())
            }
          },
        )

        const stream = videoEl.srcObject as MediaStream | null
        const track = stream?.getVideoTracks?.()[0] ?? null
        trackRef.current = track

        if (track) {
          const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities

          if (caps.focusMode?.includes('continuous')) {
            await track
              .applyConstraints({
                // @ts-expect-error — advanced focusMode constraint
                advanced: [{ focusMode: 'continuous' }],
              })
              .catch(() => {})
          }

          // Many Android Chrome devices (incl. Galaxy S25) expose hardware zoom
          // here. Auto-bump to ~2x so users can hold the phone at proper focus
          // distance (10-15cm) instead of moving inside the lens minimum.
          if (caps.zoom && typeof caps.zoom === 'object' && 'min' in caps.zoom) {
            const { min, max, step } = caps.zoom
            setZoomCapability({ min, max, step })
            const target = Math.min(2, max)
            if (target > min) {
              await track
                .applyConstraints({
                  // @ts-expect-error — zoom advanced constraint
                  advanced: [{ zoom: target }],
                })
                .catch(() => {})
            }
          }
        }

        controlsRef.current = controls
        setIsScanning(true)
      } catch (err) {
        setIsScanning(false)
        onError?.(err as Error)
      }
    },
    [onScan, onError],
  )

  return { startScanning, stopScanning, setZoom, zoomCapability, focusAt, isScanning }
}
