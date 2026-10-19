import { useEffect, useMemo, useState } from 'react'
import type { Factory } from '../factory/model.ts'
import { meanSize } from '../factory/model.ts'
import { schedule, type Analysis } from '../factory/sim.ts'
import { endOf, frame, type Placed } from '../factory/watch.ts'
import { Icon } from './icons.tsx'

const ORDERS = 150
const SHOWN_TOOLS = 12
const SHOWN_WAITING = 14
const TICK = 50

// Orders arriving each second of watching.
const SPEEDS: [number, string][] = [
  [1, 'Slow'],
  [3, 'Quick'],
  [8, 'Fast'],
]

const hours = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)))
// Good units in some orders.
const unitsOf = (placed: Placed[]) => placed.reduce((sum, p) => sum + p.units, 0).toLocaleString('en-US')
const clockText = (t: number) => `Day ${Math.floor(t / 24) + 1}, ${String(Math.floor(t % 24)).padStart(2, '0')}:00`

// How long an order has been in the factory against the cycle time wanted.
const mood = (age: number, target: number) => (age > target ? 'hot' : age > target * 0.6 ? 'warm' : 'cool')

function Orders({ placed, target, limit }: { placed: Placed[]; target: number; limit: number }) {
  const sorted = [...placed].sort((x, y) => y.age - x.age)
  return (
    <div className="order-stack" aria-hidden="true">
      {sorted.slice(0, limit).map((p) => (
        <span key={p.order} className={`order-chip ${mood(p.age, target)}`}>
          {p.order}
        </span>
      ))}
      {sorted.length > limit && <span className="order-more">+{sorted.length - limit}</span>}
    </div>
  )
}

interface WatchProps {
  factory: Factory
  analysis: Analysis
}

// Watch the factory as described run: orders arrive unevenly, wait in front of each workgroup, are worked
// on, and ship. It plays the same kind of run the numbers above are worked out from, from an empty
// factory, so piles can be seen forming in front of the bottleneck. An order's color is how long it has
// been in the factory against the cycle time wanted.
export function FactoryWatch({ factory, analysis }: WatchProps) {
  const [luck, setLuck] = useState(1)
  const [speed, setSpeed] = useState(SPEEDS[1][0])
  const [playing, setPlaying] = useState(false)
  const [clock, setClock] = useState(0)
  // Whether to watch with the yield problem from the rope card, so the rope's work can be seen.
  const [trouble, setTrouble] = useState(false)
  const watched = useMemo(() => (trouble ? { ...factory, yieldPct: Math.max(1, factory.yieldPct - factory.rope.issue) } : factory), [factory, trouble])
  const run = useMemo(() => schedule(watched, watched.demand, luck, ORDERS, watched.rope.on), [watched, luck])
  const end = useMemo(() => endOf(run), [run])
  // New numbers or new luck start a new run, paused.
  const [seen, setSeen] = useState(run)
  if (seen !== run) {
    setSeen(run)
    setClock(0)
    setPlaying(false)
  }
  const meanGap = meanSize(factory) / (factory.demand / 24)
  const step = speed * meanGap * (TICK / 1000)
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setClock((c) => {
        if (c + step >= end) {
          setPlaying(false)
          return end
        }
        return c + step
      })
    }, TICK)
    return () => clearInterval(timer)
  }, [playing, step, end])

  const now = useMemo(() => frame(run, clock), [run, clock])
  const inFactory = now.arrived - now.shipped - now.held.length
  const inFactoryUnits = now.requested - now.shippedUnits - now.held.reduce((sum, p) => sum + p.units, 0)
  const waitingUnits = now.waiting.flat().reduce((sum, p) => sum + p.units, 0)
  const waitingNow = now.waiting.reduce((sum, w) => sum + w.length, 0)
  const finished = clock >= end
  const totalRequested = useMemo(() => run.sizes.reduce((sum, n) => sum + n, 0), [run])
  const perDay = watched.demand / meanSize(watched)

  return (
    <section className="card watch" aria-label="Watch it run">
      <h2 className="card-title">Watch it run</h2>
      <p className="hint">
        {Math.round(watched.demand).toLocaleString('en-US')} good units a day is an order about every {hours(meanGap)} hours, {perDay.toFixed(1)} a day, since an order averages {Math.round(meanSize(watched)).toLocaleString('en-US')} good units. This run follows {ORDERS} orders: {totalRequested.toLocaleString('en-US')} good units asked for in all. Orders arrive as your numbers say, wait in front of each workgroup, are worked on, and ship. Each order is a numbered block, and its color is how long it has been in the factory against the {hours(factory.target)} hours you want: green is well inside, amber is getting close, red is over.
      </p>
      <div className="watch-controls">
        <button className="btn small" onClick={() => (finished ? (setClock(0), setPlaying(true)) : setPlaying(!playing))}>
          <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : finished ? 'Watch again' : 'Watch'}
        </button>
        <button className="btn small" disabled={clock === 0} onClick={() => (setClock(0), setPlaying(false))}>
          <Icon name="restart" /> Start over
        </button>
        <div className="chips" role="group" aria-label="Speed">
          {SPEEDS.map(([value, text]) => (
            <button key={value} className={`chip${speed === value ? ' on' : ''}`} aria-pressed={speed === value} onClick={() => setSpeed(value)}>
              {text}
            </button>
          ))}
        </div>
        {factory.rope.issue > 0 && (
          <label className="check">
            <input type="checkbox" checked={trouble} onChange={(event) => setTrouble(event.target.checked)} /> With the yield problem ({Math.max(1, factory.yieldPct - factory.rope.issue)}%)
          </label>
        )}
        <button className="btn small" onClick={() => setLuck(luck + 1)}>
          <Icon name="swap" /> Different luck
        </button>
      </div>
      <input className="watch-scrub" type="range" min={0} max={Math.round(end)} step={1} value={Math.round(clock)} aria-label="Time in the run" onChange={(event) => (setPlaying(false), setClock(Number(event.target.value)))} />
      <div className="watch-stats">
        <span>
          <small>Time</small>
          <strong>{clockText(clock)}</strong>
        </span>
        <span>
          <small>Orders arrived</small>
          <strong>
            {now.arrived} of {ORDERS}
          </strong>
        </span>
        <span>
          <small>Good units asked for</small>
          <strong>
            {now.requested.toLocaleString('en-US')} of {totalRequested.toLocaleString('en-US')}
          </strong>
        </span>
        <span>
          <small>In the factory</small>
          <strong>
            {inFactory} orders, {inFactoryUnits.toLocaleString('en-US')} units
          </strong>
        </span>
        <span>
          <small>Waiting in piles</small>
          <strong>
            {waitingNow} orders, {waitingUnits.toLocaleString('en-US')} units
          </strong>
        </span>
        <span>
          <small>Produced and shipped</small>
          <strong>
            {now.shipped} orders, {now.shippedUnits.toLocaleString('en-US')} units
          </strong>
        </span>
        <span className={now.cycle !== null && now.cycle > factory.target ? 'over' : ''}>
          <small>Cycle time so far</small>
          <strong>{now.cycle === null ? 'none yet' : `${hours(now.cycle)} h`}</strong>
        </span>
      </div>
      <div className="watch-line">
        {factory.steps.map((s, i) => {
          const working = now.working[i]
          const lit = s.divided ? working.length : working.length > 0 ? Math.min(s.tools, SHOWN_TOOLS) : 0
          const bottleneck = analysis.steps[i]?.bottleneck
          return (
            <div key={i} className={`watch-step${bottleneck ? ' neck' : ''}`}>
              <h3>
                {s.name}
                {bottleneck && <span className="neck-tag">Bottleneck</span>}
              </h3>
              <div className="watch-tools" role="img" aria-label={`${s.tools} tools, ${working.length > 0 ? 'working' : 'idle'}`}>
                {Array.from({ length: Math.min(s.tools, SHOWN_TOOLS) }, (_, k) => (
                  <span key={k} className={`watch-tool${k < lit ? ' on' : ''}`} />
                ))}
                {s.tools > SHOWN_TOOLS && <span className="order-more">+{s.tools - SHOWN_TOOLS}</span>}
              </div>
              {i === run.ropeAt && (
                <>
                  <small>
                    Held back by the rope: {now.held.length} orders, {unitsOf(now.held)} units
                  </small>
                  <div className="order-stack" aria-hidden="true">
                    {now.held.slice(0, SHOWN_WAITING).map((p) => (
                      <span key={p.order} className="order-chip held">
                        {p.order}
                      </span>
                    ))}
                    {now.held.length > SHOWN_WAITING && <span className="order-more">+{now.held.length - SHOWN_WAITING}</span>}
                  </div>
                </>
              )}
              <small>
                Working on: {working.length} {working.length === 1 ? 'order' : 'orders'}, {unitsOf(working)} units
              </small>
              <Orders placed={working} target={factory.target} limit={SHOWN_TOOLS} />
              <small>
                Waiting: {now.waiting[i].length} {now.waiting[i].length === 1 ? 'order' : 'orders'}, {unitsOf(now.waiting[i])} units
              </small>
              <Orders placed={now.waiting[i]} target={factory.target} limit={SHOWN_WAITING} />
            </div>
          )
        })}
        <div className="watch-step done">
          <h3>Shipped</h3>
          <strong className="watch-count">{now.shipped}</strong>
          <small>{now.shippedUnits.toLocaleString('en-US')} good units</small>
          <small>{now.cycle === null ? 'nothing yet' : `${hours(now.cycle)} h on average`}</small>
        </div>
      </div>
      {finished && (
        <p className="hint">
          All {ORDERS} orders shipped: {hours(now.cycle ?? 0)} hours on average, against the {hours(factory.target)} you want. {now.cycle !== null && now.cycle <= factory.target ? 'Inside it.' : 'Over it.'}
        </p>
      )}
    </section>
  )
}
