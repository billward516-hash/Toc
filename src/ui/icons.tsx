import type { ReactNode } from 'react'

const sawPoints = Array.from({ length: 24 }, (_, k) => {
  const r = k % 2 ? 11 : 17
  const a = (Math.PI * k) / 12
  return `${(20 + r * Math.cos(a)).toFixed(2)},${(20 + r * Math.sin(a)).toFixed(2)}`
}).join(' ')

const gear = (
  <>
    {Array.from({ length: 8 }, (_, k) => (
      <rect key={k} x={16.5} y={3} width={7} height={9} rx={1.5} transform={`rotate(${k * 45} 20 20)`} />
    ))}
    <circle cx={20} cy={20} r={11} />
    <circle className="ink" cx={20} cy={20} r={3.5} />
  </>
)

const glyphs: Record<string, ReactNode> = {
  cut: (
    <>
      <polygon points={sawPoints} />
      <circle className="ink" cx={20} cy={20} r={3.5} />
    </>
  ),
  mold: (
    <>
      <path d="M20 4v13M13.5 11.5 20 18l6.5-6.5" fill="none" />
      <rect x={8} y={23} width={24} height={12} rx={2.5} />
    </>
  ),
  paint: <path d="M20 4C14 13 9.5 19 9.5 25a10.5 10.5 0 0 0 21 0c0-6-4.5-12-10.5-21z" />,
  assemble: gear,
  box: (
    <>
      <path d="M6 15h28v20H6z" />
      <path d="M6 15l5-8h18l5 8" />
      <path d="M17 15v8h6v-8" />
    </>
  ),
}

export function StationGlyph({ kind, x, y, size }: { kind: string; x: number; y: number; size: number }) {
  return (
    <g className="glyph" transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 40})`}>
      {glyphs[kind] ?? gear}
    </g>
  )
}

const icons = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />,
  restart: (
    <>
      <path d="M5 12a7 7 0 1 0 2.2-5.1" />
      <path d="M5 4v5h5" />
    </>
  ),
  skip: <path d="M5 5v14l9-7zM16 5h3v14h-3z" fill="currentColor" stroke="none" />,
  back: <path d="M15 5l-7 7 7 7" />,
  lock: (
    <>
      <rect x={5} y={11} width={14} height={10} rx={2} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  bolt: <path d="M13 3L6 13.5h5L10 21l7-10.5h-5z" />,
  even: <path d="M5 7h14M5 12h14M5 17h14" />,
  clock: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
}

export type IconName = keyof typeof icons

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  )
}
