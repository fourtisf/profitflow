// Brand mark: the ExitRadar reticle. Outer ring inherits text color (currentColor); the
// pulsing center stays brand-green. Shared by the nav, footer, and OG/share cards.
export function Reticle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.6" />
      <path
        d="M12 1.5V4.6M12 19.4V22.5M1.5 12H4.6M19.4 12H22.5"
        stroke="currentColor"
        strokeOpacity="0.9"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3" fill="#5fd39a" />
    </svg>
  );
}
