const CENTER = 200

const ticks = Array.from({ length: 60 }, (_, index) => {
  const angle = (index / 60) * Math.PI * 2
  const major = index % 5 === 0
  const outer = 192
  const inner = major ? 170 : 181
  return {
    key: index,
    major,
    x1: (CENTER + Math.sin(angle) * inner).toFixed(2),
    y1: (CENTER - Math.cos(angle) * inner).toFixed(2),
    x2: (CENTER + Math.sin(angle) * outer).toFixed(2),
    y2: (CENTER - Math.cos(angle) * outer).toFixed(2),
  }
})

/** Decorative dial: sixty ticks and a second hand that steps once a second. */
export function ClockDial({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden="true" className={className}>
      <circle cx={CENTER} cy={CENTER} r="196" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx={CENTER} cy={CENTER} r="120" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" opacity="0.4" />
      {ticks.map((tick) => (
        <line
          key={tick.key}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="currentColor"
          strokeWidth={tick.major ? 2 : 1}
          opacity={tick.major ? 0.85 : 0.45}
        />
      ))}
      <g className="lp-second-hand" style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
        <line x1={CENTER} y1="222" x2={CENTER} y2="26" stroke="var(--accent)" strokeWidth="2" />
        <circle cx={CENTER} cy="26" r="4" fill="var(--accent)" />
      </g>
      <circle cx={CENTER} cy={CENTER} r="6" fill="var(--accent)" />
      <circle cx={CENTER} cy={CENTER} r="2" fill="var(--background)" />
    </svg>
  )
}
