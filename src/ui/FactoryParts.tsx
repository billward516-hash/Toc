import { useState } from 'react'
import type { CurvePoint, Reach } from '../factory/sim.ts'
import { Icon } from './icons.tsx'

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  // Digits to keep after the point when stepping.
  decimals?: number
  hint?: string
  onChange: (value: number) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// A number to type or step with the buttons, taken as soon as it makes sense so everything else follows
// as it is typed. A half-typed or empty box leaves the last good number in place until it is left.
export function NumberField({ label, value, min, max, step = 1, unit, decimals = 0, hint, onChange }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  // When the number changes from outside (a button, a restart), the box follows.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (Number(text) !== value) setText(String(value))
  }
  const set = (next: number) => onChange(clamp(Number(next.toFixed(decimals)), min, max))
  return (
    <label className="number-field">
      <span className="setting-label">{label}</span>
      <span className="number-row">
        <button type="button" className="chip step" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
          <Icon name="minus" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={text}
          aria-label={label}
          onChange={(event) => {
            setText(event.target.value)
            const parsed = Number(event.target.value)
            if (event.target.value !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
          }}
          onBlur={() => setText(String(value))}
        />
        <button type="button" className="chip step" aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(value + step)}>
          <Icon name="plus" />
        </button>
        {unit && <span className="unit">{unit}</span>}
      </span>
      {hint && <small>{hint}</small>}
    </label>
  )
}

const W = 600
const H = 320
const PAD = { left: 58, right: 18, top: 16, bottom: 52 }

interface CurveProps {
  points: CurvePoint[]
  // What the factory can make a day, the demand asked for and the cycle time it gives, and the cycle time wanted.
  capacity: number
  demand: number
  cycle: number
  target: number
  reach: Reach
}

// Cycle time against demand for the person's own factory: flat, then the knee, then a wall. The cycle
// time wanted is the dashed red line, the demand asked for is the dot, and the most it can take for the
// time wanted is marked in green.
export function FactoryCurve({ points, capacity, demand, cycle, target, reach }: CurveProps) {
  const xMax = Math.max(capacity * 1.18, demand * 1.05)
  const yMax = Math.max(target * 2.2, points.find((p) => p.load >= 0.93)?.cycle ?? 0, cycle * 1.15, 1)
  const x = (value: number) => PAD.left + (value / xMax) * (W - PAD.left - PAD.right)
  const y = (hours: number) => PAD.top + (1 - Math.min(hours, yMax) / yMax) * (H - PAD.top - PAD.bottom)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.demand).toFixed(1)} ${y(p.cycle).toFixed(1)}`).join('')
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((yMax * f) / (yMax > 20 ? 5 : 1)) * (yMax > 20 ? 5 : 1))
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * Math.floor(xMax / 100) * 100)
  const mark = (value: number | null) => value !== null && value <= xMax
  return (
    <figure className="lab-chart factory-curve">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cycle time against demand for your factory, with the cycle time you want and the demand you ask for marked.">
        {[...new Set(yTicks)].map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="tick" x={x(t)} y={H - PAD.bottom + 18} textAnchor="middle">
            {Math.round(t).toLocaleString('en-US')}
          </text>
        ))}
        <line className="full" x1={x(capacity)} x2={x(capacity)} y1={PAD.top} y2={H - PAD.bottom} />
        <text className="note" x={x(capacity) - 6} y={PAD.top + 12} textAnchor="end">
          capacity
        </text>
        <line className="limit" x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />
        <text className="note limit-text" x={PAD.left + 6} y={y(target) - 6}>
          wanted: {target} h
        </text>
        {mark(reach.demand) && reach.demand !== null && (
          <g>
            <line x1={x(reach.demand)} x2={x(reach.demand)} y1={y(target)} y2={H - PAD.bottom} stroke="var(--green-deep)" strokeWidth={3} strokeDasharray="4 4" />
            <text className="note" x={x(reach.demand)} y={H - PAD.bottom - 8} textAnchor="end" style={{ fill: 'var(--green-deep)' }}>
              most you can take
            </text>
          </g>
        )}
        <g className="curve bold" style={{ color: 'var(--blue)' }}>
          <path d={path} />
        </g>
        <circle cx={x(demand)} cy={y(cycle)} r={9} fill="#fff" stroke="var(--ink)" strokeWidth={5} />
        <text className="note" x={x(demand) + 12} y={y(cycle) - 10} style={{ fill: 'var(--ink)', fontWeight: 900 }}>
          you: {Math.round(cycle * 10) / 10} h
        </text>
        <text className="axis-label" x={(PAD.left + W - PAD.right) / 2} y={H - 8} textAnchor="middle">
          Good units a day asked for
        </text>
        <text className="axis-label" transform={`translate(14 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle">
          Cycle time (hours)
        </text>
      </svg>
    </figure>
  )
}
