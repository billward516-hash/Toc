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
  // The print shop.
  design: (
    <>
      <path d="M8 32v-7L25 8l7 7-17 17z" />
      <path d="M21 12l7 7" />
    </>
  ),
  print: (
    <>
      <path d="M12 16V6h16v10" />
      <path d="M5 16h30v13H5z" />
      <path d="M12 24h16v10H12z" />
    </>
  ),
  trim: (
    <>
      <circle cx={12} cy={29} r={5} />
      <circle cx={28} cy={29} r={5} />
      <path d="M15 25L30 6M25 25L10 6" />
    </>
  ),
  // The candle workshop.
  melt: (
    <>
      <path d="M8 9h24v12a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" />
      <path d="M4 12h4M32 12h4" />
      <path d="M20 37c-4-2-4-6 0-9 4 3 4 7 0 9z" />
    </>
  ),
  pour: (
    <>
      <path d="M11 8h15l-1.5 24a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z" />
      <path d="M26 10l6-4v6" />
      <path d="M11 13c-5 0-5 9 0 9" />
    </>
  ),
  label: (
    <>
      <path d="M6 20L19 7h14v14L20 34z" />
      <circle cx={27} cy={13} r={2.5} />
    </>
  ),
  // The bakery.
  mix: (
    <>
      <path d="M31 3L23 15" />
      <path d="M5 16h30a15 15 0 0 1-30 0z" />
      <path d="M14 35h12" />
    </>
  ),
  bake: (
    <>
      <rect x={5} y={5} width={30} height={30} rx={3} />
      <path d="M5 13h30" />
      <rect x={10} y={18} width={20} height={12} rx={2} />
      <circle className="ink" cx={11} cy={9} r={1.5} />
      <circle className="ink" cx={17} cy={9} r={1.5} />
    </>
  ),
  decorate: (
    <>
      <path d="M7 21h26v13H7z" />
      <path d="M7 25c3 3 5 3 6.5 0s3.5-3 6.5 0 5 3 6.5 0 3.5-3 6.5 0" />
      <path d="M20 21v-8" />
      <path d="M20 10c-2.5-2-2.5-4.5 0-6.5 2.5 2 2.5 4.5 0 6.5z" />
    </>
  ),
}
glyphs.pack = glyphs.box
glyphs.frost = glyphs.decorate
glyphs.cool = glyphs.decorate

export function StationGlyph({ kind, x, y, size }: { kind: string; x: number; y: number; size: number }) {
  return (
    <g className="glyph" transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / 40})`}>
      {glyphs[kind] ?? gear}
    </g>
  )
}

// An open-jawed wrench in a 24-unit box: the jaw's ring faces up and right, the handle runs down and left.
export const WRENCH = 'M16.8 3.6A4.5 4.5 0 1 0 20.4 7.2M12.8 11.2L5 19'

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
  cross: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
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
  wrench: <path d={WRENCH} />,
  rule: (
    <>
      <rect x={5} y={3.5} width={14} height={17} rx={2} />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  stack: <path d="M5 16h14v4H5zM5 10h14v4H5zM5 4h14v4H5z" />,
  cart: (
    <>
      <path d="M3 5h3l2.5 10h10l2-7H7" />
      <circle cx={10} cy={19} r={1.6} />
      <circle cx={17} cy={19} r={1.6} />
    </>
  ),
  swap: <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />,
  money: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 6.5v11M14.5 9.3c-.5-.7-1.4-1.1-2.5-1.1-1.4 0-2.5.8-2.5 1.9s1.1 1.6 2.5 1.9 2.5.8 2.5 1.9-1.1 1.9-2.5 1.9c-1.1 0-2-.4-2.5-1.1" />
    </>
  ),
  rope: <path d="M3 15c2.5-5 5 3 7.5-2s5 3 7.5-2M18 11l3-3" />,
  sort: <path d="M4 6h16M4 12h11M4 18h6" />,
  truck: (
    <>
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7" />
      <circle cx={6.5} cy={17.5} r={1.8} />
      <circle cx={17} cy={17.5} r={1.8} />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9 16H3z" />
      <path d="M12 10v4M12 17v.2" />
    </>
  ),
  bin: (
    <>
      <path d="M5 7h14l-1.2 13H6.2z" />
      <path d="M3.5 7h17M9 7V4h6v3M10 11v6M14 11v6" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.5L12 4h8v8l-8.5 8.5z" />
      <circle cx={16} cy={8} r={1.4} />
    </>
  ),
  info: (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  // Corners pointing out, to fill the screen; pointing in, to leave full screen.
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  shrink: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  // A factory with a sawtooth roof and a chimney.
  build: <path d="M3 20h18M4 20V11l4-3v3l4-3v3l4-3V4h3v16" />,
  // Two people, for a class.
  group: (
    <>
      <circle cx={9} cy={8} r={3.2} />
      <path d="M3.5 19.5c0-3.3 2.5-5.7 5.5-5.7s5.5 2.4 5.5 5.7" />
      <circle cx={16.8} cy={9} r={2.5} />
      <path d="M16.6 13.9c2.4.1 4.1 2.2 4.1 5" />
    </>
  ),
  // A TV on its stand.
  screen: (
    <>
      <rect x={3} y={4.5} width={18} height={12} rx={2} />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  // An open book, for the course guide.
  book: (
    <>
      <path d="M12 6.5C10.6 5 8.4 4.5 4.5 4.5v13c3.9 0 6.1.5 7.5 2 1.4-1.5 3.6-2 7.5-2v-13c-3.9 0-6.1.5-7.5 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // A clipboard with lines on it, for the trainer's guide.
  clipboard: (
    <>
      <rect x={5.5} y={5} width={13} height={16} rx={2.2} />
      <path d="M9 5V4.2C9 3.5 9.5 3 10.2 3h3.6c.7 0 1.2.5 1.2 1.2V5M9 11h6M9 15h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx={12} cy={12} r={2.8} />
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
