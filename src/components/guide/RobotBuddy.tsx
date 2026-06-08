/**
 * Stocky — the feature-guide mascot (Phase 46).
 *
 * Pure inline SVG, themed off the brand tokens, animated with the CSS keyframes
 * in globals.css (which already honour prefers-reduced-motion). No Lottie, no
 * dependency, no network — it ships in the bundle and works offline, which a PWA
 * needs. Presentational only: all behaviour lives in StockyHelper.
 */
export function RobotBuddy({
  size = 48,
  waving = false,
  className,
}: {
  size?: number
  /** Play the one-time hello wave on first appearance. */
  waving?: boolean
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-hidden
    >
      {/* antenna */}
      <line x1="24" y1="6" x2="24" y2="12" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2.4" fill="#F5A623" />
      {/* head/body */}
      <rect x="8" y="12" width="32" height="26" rx="9" fill="#1ABC9C" />
      {/* face screen */}
      <rect x="12.5" y="17" width="23" height="15" rx="6" fill="#E1F5EE" />
      {/* eyes */}
      <circle cx="19.5" cy="24" r="2.6" fill="#0F6E56" />
      <circle cx="28.5" cy="24" r="2.6" fill="#0F6E56" />
      {/* eye sparkles */}
      <circle cx="20.4" cy="23.1" r="0.8" fill="#fff" />
      <circle cx="29.4" cy="23.1" r="0.8" fill="#fff" />
      {/* smile */}
      <path d="M20 28.5q4 3 8 0" stroke="#0F6E56" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* ears / side bolts */}
      <rect x="5.5" y="22" width="3" height="6" rx="1.5" fill="#0F6E56" />
      <rect x="39.5" y="22" width="3" height="6" rx="1.5" fill="#0F6E56" />
      {/* waving hand (animates when waving) */}
      <g className={waving ? 'stocky-wave' : undefined}>
        <circle cx="40" cy="34" r="3.4" fill="#15A886" />
      </g>
    </svg>
  )
}
