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

type ExtendedCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  zoom?: { min: number; max: number; step: number } | number[]
  pointsOfInterest?: unknown
}

// Native BarcodeDetector — types not in lib.dom yet.
type DetectedBarcode = { rawValue: string; format: string }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement | ImageBitmap) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorStatic = BarcodeDetectorCtor & {
  getSupportedFormats: () => Promise<string[]>
}

// SA retail symbology mix — same set used for both native + ZXing fallback.
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']

export function useScanner({ onScan, onError }: UseScannerOptions): UseScannerReturn {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nativeRafRef = useRef<number | null>(null)
  const stoppedRef = useRef(false)
  const hasScanned = useRef(false)
  const [isScanning, setIsScanning] = useState(false)
  const [zoomCapability, setZoomCapability] = useState<UseScannerReturn['zoomCapability']>(null)

  const stopScanning = useCallback(() => {
    stoppedRef.current = true
    if (nativeRafRef.current !== null) {
      clearTimeout(nativeRafRef.current)
      nativeRafRef.current = null
    }
    controlsRef.current?.stop()
    controlsRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
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
        // @ts-expect-error — zoom advanced constraint
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
        // @ts-expect-error — pointsOfInterest advanced constraint
        advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' }],
      })
      .catch(() => {})
  }, [])

  // Apply post-stream-start track tuning (zoom + focusMode). Shared between
  // native and ZXing paths.
  async function tuneTrack(track: MediaStreamTrack) {
    const caps = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities

    if (caps.focusMode?.includes('continuous')) {
      await track
        .applyConstraints({
          // @ts-expect-error — focusMode advanced constraint
          advanced: [{ focusMode: 'continuous' }],
        })
        .catch(() => {})
    }

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

  const startScanning = useCallback(
    async (videoEl: HTMLVideoElement) => {
      hasScanned.current = false
      stoppedRef.current = false

      // Probe native BarcodeDetector. Available on Chrome Android 83+, backed by
      // Google's ML Kit — 5-10x faster and more accurate than ZXing JS.
      // Falls through to ZXing on iOS Safari and older browsers.
      const NativeDetector = (typeof window !== 'undefined' &&
        (window as unknown as { BarcodeDetector?: BarcodeDetectorStatic }).BarcodeDetector) || null

      let useNative = false
      let supportedFormats: string[] = []
      if (NativeDetector) {
        try {
          supportedFormats = await NativeDetector.getSupportedFormats()
          // Need at least EAN-13 (the SA retail workhorse) for native to be useful.
          useNative = supportedFormats.includes('ean_13')
        } catch {
          useNative = false
        }
      }

      try {
        if (useNative && NativeDetector) {
          // ── NATIVE PATH ──────────────────────────────────────────────────
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30, max: 30 },
              // @ts-expect-error — focusMode constraint
              focusMode: 'continuous',
            },
            audio: false,
          })
          streamRef.current = stream
          videoEl.srcObject = stream
          await videoEl.play().catch(() => {})

          const track = stream.getVideoTracks()[0] ?? null
          trackRef.current = track
          if (track) await tuneTrack(track)

          const formats = NATIVE_FORMATS.filter((f) => supportedFormats.includes(f))
          const detector = new NativeDetector({ formats })

          // 10fps decode loop. Production scanners (html5-qrcode, ML Kit defaults)
          // run at ~10fps because phone cameras don't deliver new in-focus frames
          // any faster — 30fps decode wastes CPU on blurry duplicates.
          const tick = async () => {
            if (stoppedRef.current || hasScanned.current) return
            try {
              if (videoEl.readyState >= 2) {
                const codes = await detector.detect(videoEl)
                if (codes.length > 0 && !hasScanned.current) {
                  hasScanned.current = true
                  onScan(codes[0].rawValue)
                  return
                }
              }
            } catch (err) {
              // Per-frame detection errors are non-fatal — keep ticking.
              onError?.(err as Error)
            }
            nativeRafRef.current = window.setTimeout(tick, 100) as unknown as number
          }
          tick()
        } else {
          // ── ZXing FALLBACK (iOS Safari, older Chrome) ────────────────────
          if (!readerRef.current) {
            const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] =
              await Promise.all([import('@zxing/browser'), import('@zxing/library')])
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

          const controls = await readerRef.current.decodeFromConstraints(
            {
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30, max: 30 },
                // @ts-expect-error — focusMode constraint
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
                stopScanning()
                onScan(result.getText())
              }
            },
          )

          const stream = videoEl.srcObject as MediaStream | null
          streamRef.current = stream
          const track = stream?.getVideoTracks?.()[0] ?? null
          trackRef.current = track
          if (track) await tuneTrack(track)

          controlsRef.current = controls
        }

        setIsScanning(true)
      } catch (err) {
        setIsScanning(false)
        onError?.(err as Error)
      }
    },
    [onScan, onError, stopScanning],
  )

  return { startScanning, stopScanning, setZoom, zoomCapability, focusAt, isScanning }
}
