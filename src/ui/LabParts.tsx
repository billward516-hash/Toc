import type { Outcome } from '../loading/curve.ts'
import { STEPS } from '../sandbox/setup.ts'

// The charts of the loading lab: cycle time against load, the piles along the line, and a cycle time
// split into work and waiting.

export interface CurveSeries {
  name: string
  // A CSS color; the shape and the label tell the lines apart too.
  color: string
  points: Outcome[]
  // Drawn bold, when the series is the one the player has been loading.
  bold?: boolean
}

interface CurveChartProps {
  series: CurveSeries[]
  // The player's own runs, as dots.
  dots?: Outcome[]
  // A cycle time that must not be passed.
  limit?: number
  label: string
}

const W = 560
const H = 300
const PAD = { left: 52, right: 16, top: 16, bottom: 44 }
const LOAD_MIN = 0.3
const LOAD_MAX = 1.2
const CYCLE_MAX = 120

const clamp = (value: number, high: number) => Math.min(value, high)

// Cycle time against how hard the line is loaded: flat, then a knee, then a wall. The bottleneck's
// capacity is the dashed line at 100%.
export function CurveChart({ series, dots = [], limit, label }: CurveChartProps) {
  const x = (load: number) => PAD.left + ((load - LOAD_MIN) / (LOAD_MAX - LOAD_MIN)) * (W - PAD.left - PAD.right)
  const y = (cycle: number) => PAD.top + (1 - clamp(cycle, CYCLE_MAX) / CYCLE_MAX) * (H - PAD.top - PAD.bottom)
  const loads = [0.4, 0.6, 0.8, 1, 1.2]
  const cycles = [0, 30, 60, 90, 120]
  const path = (points: Outcome[]) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.load).toFixed(1)} ${y(p.cycle).toFixed(1)}`).join('')
  return (
    <figure className="lab-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {cycles.map((c) => (
          <g key={c}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(c)} y2={y(c)} />
            <text className="tick" x={PAD.left - 8} y={y(c) + 4} textAnchor="end">
              {c}
            </text>
          </g>
        ))}
        {loads.map((l) => (
          <text key={l} className="tick" x={x(l)} y={H - PAD.bottom + 18} textAnchor="middle">
            {Math.round(l * 100)}%
          </text>
        ))}
        <line className="full" x1={x(1)} x2={x(1)} y1={PAD.top} y2={H - PAD.bottom} />
        <text className="note" x={x(1) + 5} y={PAD.top + 12}>
          bottleneck full
        </text>
        {limit !== undefined && (
          <>
            <line className="limit" x1={PAD.left} x2={W - PAD.right} y1={y(limit)} y2={y(limit)} />
            <text className="note limit-text" x={PAD.left + 6} y={y(limit) - 6}>
              limit {limit} min
            </text>
          </>
        )}
        {series.map((s, k) => {
          return (
            <g key={s.name} className={`curve${s.bold ? ' bold' : ''}`} style={{ color: s.color }}>
              <path d={path(s.points)} />
              {s.points.map((p) => (
                <Marker key={p.rate} kind={k} cx={x(p.load)} cy={y(p.cycle)} r={s.bold ? 4 : 3} />
              ))}
            </g>
          )
        })}
        {dots.map((d, i) => (
          <g key={i} className="dot-run">
            <circle cx={x(d.load)} cy={y(d.cycle)} r={7} />
            <text x={x(d.load)} y={y(d.cycle) + 4} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        ))}
        <text className="axis-label" x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle">
          Load: orders per hour, as a share of what the bottleneck can make
        </text>
        <text className="axis-label" transform={`translate(13 ${(PAD.top + H - PAD.bottom) / 2}) rotate(-90)`} textAnchor="middle">
          Cycle time (min)
        </text>
      </svg>
      <ul className="legend-row">
        {series.map((s, k) => (
          <li key={s.name} style={{ color: s.color }}>
            <svg viewBox="0 0 20 14" aria-hidden="true">
              <line x1={0} x2={20} y1={7} y2={7} stroke="currentColor" strokeWidth={3} />
              <Marker kind={k} cx={10} cy={7} r={4} />
            </svg>
            <span>{s.name}</span>
          </li>
        ))}
        {dots.length > 0 && (
          <li className="dots-key">
            <i className="dot-key" /> <span>Your runs</span>
          </li>
        )}
      </ul>
    </figure>
  )
}

// A different shape per series, so color is never the only way to tell the lines apart.
function Marker({ kind, cx, cy, r }: { kind: number; cx: number; cy: number; r: number }) {
  if (kind % 3 === 1) return <rect className="mark" x={cx - r} y={cy - r} width={2 * r} height={2 * r} />
  if (kind % 3 === 2) return <path className="mark" d={`M${cx} ${cy - r - 1}L${cx + r + 1} ${cy + r}H${cx - r - 1}z`} />
  return <circle className="mark" cx={cx} cy={cy} r={r} />
}

// The pile in front of each station through the day. All strips share one scale, so a tall one is a
// real pile, and the eye can see whether it stays at one station or moves between them.
export function QueueStrips({ series, bottlenecks, horizon }: { series: number[][]; bottlenecks: number[]; horizon: number }) {
  const top = Math.max(8, ...series.flat())
  const width = 400
  const height = 38
  const points = series[0]?.length ?? 0
  const x = (k: number) => (k / Math.max(1, points - 1)) * width
  const y = (v: number) => height - 3 - (v / top) * (height - 8)
  const area = (values: number[]) => `M0 ${height - 3}${values.map((v, k) => `L${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join('')}L${width} ${height - 3}z`
  const peak = series.map((values) => Math.max(...values))
  return (
    <figure className="queue-strips">
      <ol aria-label="Robots waiting in front of each station through the day">
        {series.map((values, i) => (
          <li key={STEPS[i].id} className={bottlenecks.includes(i) ? 'neck' : undefined}>
            <span className="strip-name">
              {STEPS[i].name}
              {bottlenecks.includes(i) && <small>bottleneck</small>}
            </span>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${STEPS[i].name}: up to ${peak[i]} waiting`}>
              <line className="base" x1={0} x2={width} y1={height - 3} y2={height - 3} />
              <path d={area(values)} />
            </svg>
            <span className="strip-peak">up to {peak[i]}</span>
          </li>
        ))}
      </ol>
      <figcaption>
        The pile in front of each station over the {Math.round(horizon / 60)}-hour day, all on one scale (up to {top} robots).
      </figcaption>
    </figure>
  )
}

// A robot's cycle time as the minutes it was worked on and the minutes it waited.
export function CycleBar({ cycle, waiting }: { cycle: number; waiting: number }) {
  const work = Math.max(0, cycle - waiting)
  const share = cycle > 0 ? (100 * work) / cycle : 100
  return (
    <figure className="cycle-bar" aria-label={`Cycle time ${Math.round(cycle)} minutes: ${Math.round(work)} working, ${Math.round(waiting)} waiting`}>
      <div className="bar" aria-hidden="true">
        <span className="work" style={{ width: `${share}%` }} />
        <span className="wait" style={{ width: `${100 - share}%` }} />
      </div>
      <figcaption>
        <span>
          <i className="swatch work" /> Being worked on <strong>{Math.round(work)} min</strong>
        </span>
        <span>
          <i className="swatch wait" /> Waiting in piles <strong>{Math.round(waiting)} min</strong>
        </span>
      </figcaption>
    </figure>
  )
}
