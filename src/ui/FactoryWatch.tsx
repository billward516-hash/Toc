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
  const run = useMemo(() => schedule(factory, factory.demand, luck, ORDERS), [factory, luck])
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
  const inFactory = now.arrived - now.shipped
  const waitingNow = now.waiting.reduce((sum, w) => sum + w.length, 0)
  const finished = clock >= end

  return (
    <section className="card watch" aria-label="Watch it run">
      <h2 className="card-title">Watch it run</h2>
      <p className="hint">
        Orders arrive as your numbers say, wait in front of each workgroup, are worked on, and ship. Each order is a numbered block, and its color is how long it has been in the factory against the {hours(factory.target)} hours you want: green is well inside, amber is getting close, red is over.
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
          <small>In the factory</small>
          <strong>{inFactory}</strong>
        </span>
        <span>
          <small>Waiting in piles</small>
          <strong>{waitingNow}</strong>
        </span>
        <span>
          <small>Shipped</small>
          <strong>{now.shipped}</strong>
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
              <small>Working on</small>
              <Orders placed={working} target={factory.target} limit={SHOWN_TOOLS} />
              <small>Waiting: {now.waiting[i].length}</small>
              <Orders placed={now.waiting[i]} target={factory.target} limit={SHOWN_WAITING} />
            </div>
          )
        })}
        <div className="watch-step done">
          <h3>Shipped</h3>
          <strong className="watch-count">{now.shipped}</strong>
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
