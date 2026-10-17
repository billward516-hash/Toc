import { useMemo, useState } from 'react'
import { DAYS_SHOWN, describePlan, holdHours, judgeLots, LIMITS, LOT_ROUND, lotAdvice, lotSnapshotAt, timeSplit, whatHappenedLots, type LotSnapshot } from '../loading/lotRound.ts'
import { capacityPerHour, HORIZON, LOT_SIZES, runLots, SPEEDS, type LotPlan, type LotResult } from '../loading/lots.ts'
import { Icon } from './icons.tsx'
import { CycleBar, DepthChart, type DepthPoint } from './LabParts.tsx'
import { PlaybackPanel, ScreenHeader, type Stat } from './parts.tsx'
import { showFloor } from './scroll.ts'
import { usePlayback } from './usePlayback.ts'

// Simulated minutes per real second at 1x: the fortnight plays in 80 seconds.
const MINUTES_PER_SECOND = 252
const SWEEP_SEEDS = 4
const COLORS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']
const lotColor = (lot: number) => COLORS[lot % COLORS.length]
const TOOLS = SPEEDS.length

interface Run {
  number: number
  plan: LotPlan
  result: LotResult
}

const samePlan = (a: LotPlan, b: LotPlan) => a.size === b.size && a.toolsPerLot === b.toolsPerLot && a.depth === b.depth && a.order === b.order

export interface LotLog {
  tries: number
  passed: boolean
  plan: LotPlan
}

// The lot round: eight tools, two weeks, and a queue that is always full. Choose the lots, the tools
// each gets, and how many lots to keep in the system.
export function LotRound({ number, total, onFinish, onExit }: { number: number; total: number; onFinish: (log: LotLog) => void; onExit: () => void }) {
  const [plan, setPlan] = useState<LotPlan>(LOT_ROUND.start)
  const [runs, setRuns] = useState<Run[]>([])
  const [speed, setSpeed] = useState(4)
  const result = useMemo(() => runLots(plan, LOT_ROUND.day), [plan])
  const playback = usePlayback(HORIZON, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => lotSnapshotAt(result, playback.t, TOOLS), [result, playback.t])
  const latest = runs.at(-1)
  const ran = latest !== undefined && samePlan(latest.plan, plan)
  const done = ran && playback.finished ? latest : null
  const passed = runs.some((r) => judgeLots(r.result).passed)
  const sets = result.groups.length
  const verdict = done ? judgeLots(done.result) : null
  const sweep = useMemo<DepthPoint[] | null>(() => {
    if (!done) return null
    return Array.from({ length: LIMITS.depth.max }, (_, k) => {
      const runsAt = Array.from({ length: SWEEP_SEEDS }, (_, s) => runLots({ ...done.plan, depth: k + 1 }, s + 1))
      const mean = (pick: (r: LotResult) => number) => runsAt.reduce((sum, r) => sum + pick(r), 0) / SWEEP_SEEDS
      return { depth: k + 1, cycleHours: mean((r) => r.cycleHours), busy: mean((r) => r.busy) }
    })
  }, [done])

  const record = () => {
    setRuns((previous) => (previous.at(-1) && samePlan(previous.at(-1)!.plan, plan) ? previous : [...previous, { number: previous.length + 1, plan, result }]))
  }
  const controls = {
    ...playback,
    play: () => {
      record()
      playback.play()
    },
    restart: () => {
      record()
      playback.restart()
    },
    skipToEnd: () => {
      record()
      playback.skipToEnd()
    },
    seekTo: (minutes: number) => {
      record()
      playback.seekTo(minutes)
    },
  }
  const change = (patch: Partial<LotPlan>) => {
    setPlan({ ...plan, ...patch })
    playback.rewind()
  }
  const run = () => {
    controls.restart()
    showFloor()
  }

  const stats: Stat[] = [
    { label: 'Lots done', value: snapshot.finished },
    { label: 'Good wafers', value: Math.round(snapshot.good).toLocaleString('en-US') },
    { label: 'Lot cycle time', value: snapshot.cycleHours === null ? '–' : `${Math.round(snapshot.cycleHours)} h` },
    { label: 'Tools busy', value: `${Math.round(100 * snapshot.busy)}%` },
  ]
  const { mission } = LOT_ROUND
  const capacity = capacityPerHour()

  return (
    <div className="screen level-screen lab">
      <ScreenHeader chip={`Loading lab · round ${number} of ${total}`} title={LOT_ROUND.title} stats={stats} onExit={onExit} />

      <section className="card lab-brief" aria-label="Round brief">
        <p>
          A group of <strong>eight tools</strong> processes wafers in lots. Two tools make {SPEEDS[0]} wafers an hour and six make {SPEEDS[2]}, so the group can make {capacity} an hour, about {Math.round((capacity * DAYS_SHOWN * 24) / 1000)},000 in two weeks. A load of up to 50 wafers takes a tool the same time whatever its size. Wafers are always queued, so arrivals don't matter.
        </p>
        <p>
          <strong>A lot is committed to its tools and run out before they take another,</strong> so lots never mix. You choose the size of the lots, how many tools each gets, and how many lots to keep in the system. Yield averages about 77%, lot by lot between 69% and 85%.
        </p>
        <p className="mission">
          <Icon name="bolt" />
          <span>
            <strong>Mission:</strong> deliver at least <strong>{mission.good.toLocaleString('en-US')} good wafers</strong> in two weeks, with a lot's average time from joining the queue to finishing no more than <strong>{mission.cycleHours} hours</strong>.
          </span>
        </p>
      </section>

      <div className="floor">
        <LotFloor result={result} snapshot={snapshot} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole group.</p>

      <div className="dock">
        <PlaybackPanel
          playback={controls}
          speed={speed}
          onSpeed={setSpeed}
          horizon={HORIZON}
          clockLabel="Clock (h:mm)"
          endLabel="End of two weeks"
          plainLegend
          parts={
            <span>
              <i className="swatch" /> Lot waiting
            </span>
          }
          legend={
            <>
              <span>
                <i className="swatch dot" /> Tool running a load
              </span>
              <span>
                <i className="swatch dot off" /> Tool idle
              </span>
            </>
          }
        >
          {done && verdict && (
            <section className="runs lab-result" aria-label={`Run ${done.number}`} aria-live="polite">
              <h3>Run {done.number}</h3>
              <ul className={`verdict${verdict.passed ? ' won' : ''}`}>
                <li className={verdict.goodOk ? 'ok' : 'miss'}>
                  <Icon name={verdict.goodOk ? 'check' : 'cross'} />
                  <span>
                    Good wafers <strong>{Math.round(done.result.good).toLocaleString('en-US')}</strong>, at least {mission.good.toLocaleString('en-US')}
                  </span>
                </li>
                <li className={verdict.cycleOk ? 'ok' : 'miss'}>
                  <Icon name={verdict.cycleOk ? 'check' : 'cross'} />
                  <span>
                    Lot cycle time <strong>{Math.round(done.result.cycleHours)} h</strong>, no more than {mission.cycleHours}
                  </span>
                </li>
              </ul>
              <CycleBar cycle={done.result.cycleHours} waiting={Math.max(0, done.result.cycleHours - holdHours(done.result))} labels={['Holding its tools', 'Waiting for a set']} unit="h" />
              <p>{whatHappenedLots(done.result)}</p>
              <p className="advice">{lotAdvice(done.result)}</p>
              <TimeSplitBar result={done.result} />
              {done.plan.size === 'mixed' && <BySize result={done.result} />}
            </section>
          )}
          {sweep && done && (
            <section className="runs" aria-label="Cycle time against lots in the system">
              <h3>The same lots at other queue depths</h3>
              <DepthChart points={sweep} sets={done.result.groups.length} current={done.plan.depth} limit={mission.cycleHours} />
              <p className="hint">Average of {SWEEP_SEEDS} fortnights. Past one lot per set, extra lots in the system make no more wafers; they only add waiting.</p>
            </section>
          )}
          {runs.length > 0 && (
            <section className="runs" aria-label="Your runs">
              <h3>Your runs</h3>
              <table className="data-table runs-table">
                <thead>
                  <tr>
                    <th scope="col">Run</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Good</th>
                    <th scope="col">Cycle</th>
                    <th scope="col">Mission</th>
                  </tr>
                </thead>
                <tbody>
                  {[...runs].reverse().map((r) => {
                    const v = judgeLots(r.result)
                    return (
                      <tr key={r.number} className={v.passed ? 'current' : undefined}>
                        <th scope="row">{r.number}</th>
                        <td className="changes">{describePlan(r.plan)}</td>
                        <td>{Math.round(r.result.good / 1000)}k</td>
                        <td>{Math.round(r.result.cycleHours)} h</td>
                        <td>{v.passed ? 'Done' : !v.goodOk ? 'Too few' : 'Too slow'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}
        </PlaybackPanel>

        <section className="card lab-controls" aria-label="Plan the lots">
          <fieldset className="lever">
            <legend>
              <Icon name="stack" /> Lot size: {plan.size === 'mixed' ? 'mixed 600 and 2400' : `${plan.size} wafers`}
            </legend>
            <div className="dial" role="group" aria-label="Lot size">
              <input
                type="range"
                min={LOT_SIZES.min}
                max={LOT_SIZES.max}
                step={LOT_SIZES.step}
                value={plan.size === 'mixed' ? 1500 : plan.size}
                disabled={plan.size === 'mixed'}
                aria-valuetext={`${plan.size} wafers`}
                onChange={(event) => change({ size: Number(event.target.value) })}
              />
            </div>
            <div className="chips">
              <button className={`chip${plan.size === 'mixed' ? ' on' : ''}`} aria-pressed={plan.size === 'mixed'} onClick={() => change({ size: plan.size === 'mixed' ? 1500 : 'mixed' })}>
                Mixed 600 and 2400
              </button>
            </div>
          </fieldset>
          <fieldset className="lever">
            <legend>
              <Icon name="build" /> Tools for each lot
            </legend>
            <div className="chips" role="group" aria-label="Tools for each lot">
              {Array.from({ length: LIMITS.toolsPerLot.max }, (_, k) => k + 1).map((m) => (
                <button key={m} className={`chip${plan.toolsPerLot === m ? ' on' : ''}`} aria-pressed={plan.toolsPerLot === m} onClick={() => change({ toolsPerLot: m })}>
                  {m}
                </button>
              ))}
            </div>
            <p className="hint">
              {sets} {sets === 1 ? 'lot' : 'lots'} at a time on {sets * plan.toolsPerLot} tools
              {result.unused.length > 0 ? `; ${result.unused.length} ${result.unused.length === 1 ? 'tool is' : 'tools are'} left in no set` : ''}.
            </p>
          </fieldset>
          <fieldset className="lever">
            <legend>
              <Icon name="even" /> Lots in the system
            </legend>
            <div className="dial" role="group" aria-label="Lots in the system">
              <button className="chip step" aria-label="Fewer lots" disabled={plan.depth <= LIMITS.depth.min} onClick={() => change({ depth: plan.depth - 1 })}>
                <Icon name="minus" />
              </button>
              <input type="range" min={LIMITS.depth.min} max={LIMITS.depth.max} step={1} value={plan.depth} aria-valuetext={`${plan.depth} lots`} onChange={(event) => change({ depth: Number(event.target.value) })} />
              <button className="chip step" aria-label="More lots" disabled={plan.depth >= LIMITS.depth.max} onClick={() => change({ depth: plan.depth + 1 })}>
                <Icon name="plus" />
              </button>
            </div>
            <p className="dial-read" aria-live="polite">
              <strong>{plan.depth}</strong> {plan.depth === 1 ? 'lot' : 'lots'} for {sets} {sets === 1 ? 'set' : 'sets'}: {plan.depth < sets ? `${sets - plan.depth} ${sets - plan.depth === 1 ? 'set has' : 'sets have'} nothing to run` : plan.depth === sets ? 'one for each set, none waiting' : `${plan.depth - sets} always waiting`}.
            </p>
          </fieldset>
          {plan.size === 'mixed' && (
            <fieldset className="lever">
              <legend>
                <Icon name="sort" /> Which lot goes next
              </legend>
              <div className="chips">
                {(
                  [
                    ['first', 'First come, first served'],
                    ['shortest', 'Shortest lot first'],
                  ] as const
                ).map(([order, text]) => (
                  <button key={order} className={`chip${plan.order === order ? ' on' : ''}`} aria-pressed={plan.order === order} onClick={() => change({ order })}>
                    {text}
                  </button>
                ))}
              </div>
              <p className="hint">Shortest first gives way to any lot that has waited three days.</p>
            </fieldset>
          )}
          <div className="run-bar">
            <button className="btn primary big" onClick={run}>
              Run two weeks <Icon name="play" />
            </button>
            {(passed || runs.length >= 4) && (
              <button className={`btn big${passed ? ' next' : ''}`} onClick={() => onFinish({ tries: runs.length, passed, plan: (runs.find((r) => judgeLots(r.result).passed) ?? runs.at(-1)!).plan })}>
                {passed ? 'See what it shows' : 'Skip this round'} <Icon name="next" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// Where the tools' time went, in four parts.
function TimeSplitBar({ result }: { result: LotResult }) {
  const split = timeSplit(result)
  const parts = [
    { key: 'running', label: 'Running loads', value: split.running },
    { key: 'tail', label: 'Idle at the end of a lot', value: split.tail },
    { key: 'starved', label: 'In a set with no lot', value: split.starved },
    { key: 'unused', label: 'In no set', value: split.unused },
  ]
  return (
    <figure className="time-split" aria-label={`Where the tools' time went: ${parts.map((p) => `${Math.round(p.value * 100)}% ${p.label.toLowerCase()}`).join(', ')}`}>
      <div className="bar" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.key} className={p.key} style={{ width: `${p.value * 100}%` }} />
        ))}
      </div>
      <figcaption>
        {parts.map((p) => (
          <span key={p.key}>
            <i className={`swatch ${p.key}`} /> {p.label} <strong>{Math.round(p.value * 100)}%</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function BySize({ result }: { result: LotResult }) {
  const sizes = Object.keys(result.cycleBySize)
    .map(Number)
    .sort((a, b) => a - b)
  return (
    <p className="by-size">
      {sizes.map((size) => `${size}-wafer lots: ${Math.round(result.cycleBySize[size])} h`).join(' · ')}
      {result.oldestWait > 0 ? ` · longest wait still going: ${Math.round(result.oldestWait)} h` : ''}
      <br />
      <small>Which lot goes first changes who waits, not the average: that is set by the lots in the system.</small>
    </p>
  )
}

const SLOT = 64
const SET_GAP = 16
const QUEUE_W = 250
const SET_TOP = 56

// Where each set of tools starts along the floor, where the tools in no set start, and where they end.
function layoutOf(sizes: number[]): { sets: number[]; unused: number; end: number } {
  const sets: number[] = []
  let at = QUEUE_W + 20
  for (const size of sizes) {
    sets.push(at)
    at += size * SLOT + SET_GAP
  }
  return { sets, unused: at, end: at }
}

// The floor: the queue of lots on the left, the tools in their sets, and the finished lots on the right.
function LotFloor({ result, snapshot }: { result: LotResult; snapshot: LotSnapshot }) {
  const order = [...result.groups.flat(), ...result.unused]
  const slotX = new Map<number, number>()
  const setBoxes: { left: number; width: number }[] = []
  const layout = layoutOf(result.groups.map((g) => g.length))
  result.groups.forEach((tools, g) => {
    setBoxes.push({ left: layout.sets[g], width: tools.length * SLOT })
    tools.forEach((tool, k) => slotX.set(tool, layout.sets[g] + k * SLOT))
  })
  const unusedLeft = layout.unused
  result.unused.forEach((tool, k) => slotX.set(tool, unusedLeft + k * SLOT))
  const x = layout.end
  const width = x + result.unused.length * SLOT + 20 + 190
  const height = 270
  const shown = snapshot.waiting.slice(0, 12)
  const maxSize = Math.max(...result.lots.map((l) => l.size), 600)
  return (
    <svg className="factory lot-floor" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Tool group">
      <text className="area-label" x={QUEUE_W / 2} y={22}>
        Lots waiting ({snapshot.waiting.length})
      </text>
      {shown.map((id, k) => {
        const lot = result.lots[id]
        return (
          <g key={id} className="queued-lot">
            <rect x={14} y={38 + k * 24} width={(lot.size / maxSize) * (QUEUE_W - 90) + 20} height={19} rx={6} style={{ fill: lotColor(id) }} />
            <text className="lot-size" x={14 + (lot.size / maxSize) * (QUEUE_W - 90) + 28} y={52 + k * 24}>
              {lot.size}
            </text>
          </g>
        )
      })}
      {snapshot.waiting.length > shown.length && (
        <text x={QUEUE_W / 2} y={38 + shown.length * 24 + 12}>
          and {snapshot.waiting.length - shown.length} more
        </text>
      )}
      {setBoxes.map((box, g) => {
        const lotId = snapshot.sets[g]
        return (
          <g key={g} className={`tool-set${lotId === null ? ' empty' : ''}`}>
            <rect className="set-box" x={box.left - 4} y={SET_TOP - 30} width={box.width + 8} height={232} rx={14} />
            <text className="set-label" x={box.left + box.width / 2} y={SET_TOP - 10}>
              {lotId === null ? 'No lot' : `Lot ${lotId + 1} · ${result.lots[lotId].size}`}
            </text>
          </g>
        )
      })}
      {result.unused.length > 0 && (
        <text className="set-label dim" x={unusedLeft + (result.unused.length * SLOT) / 2} y={SET_TOP - 10}>
          In no set
        </text>
      )}
      {order.map((tool) => {
        const left = slotX.get(tool) ?? 0
        const run = snapshot.tools[tool]
        const group = result.groups.findIndex((g) => g.includes(tool))
        const committed = group >= 0 && snapshot.sets[group] !== null
        const progress = run ? Math.min(1, (snapshot.t - run.start) / (run.end - run.start)) : 0
        const state = run ? 'on' : group < 0 ? 'unused' : committed ? 'waiting' : 'free'
        return (
          <g key={tool} className={`tool ${state}`}>
            <rect className="tool-box" x={left + 4} y={SET_TOP} width={SLOT - 8} height={170} rx={12} style={run ? { fill: lotColor(run.lot) } : undefined} />
            <text className="tool-speed" x={left + SLOT / 2} y={SET_TOP + 24}>
              {SPEEDS[tool]}/h
            </text>
            <text className="tool-wafers" x={left + SLOT / 2} y={SET_TOP + 90}>
              {run ? run.wafers : state === 'waiting' ? 'idle' : ''}
            </text>
            <rect className="progress-track" x={left + 12} y={SET_TOP + 140} width={SLOT - 24} height={8} rx={4} />
            <rect className="progress-fill" x={left + 12} y={SET_TOP + 140} width={(SLOT - 24) * progress} height={8} rx={4} />
          </g>
        )
      })}
      <g className="shipped">
        <rect className="bin" x={width - 190} y={SET_TOP - 30} width={170} height={232} rx={24} />
        <text className="bin-label" x={width - 105} y={SET_TOP + 14}>
          Finished
        </text>
        <text className="bin-count compact" x={width - 105} y={SET_TOP + 70}>
          {snapshot.finished} lots
        </text>
        <text className="bin-label" x={width - 105} y={SET_TOP + 112}>
          {snapshot.wafers.toLocaleString('en-US')} wafers
        </text>
        <text className="bin-label" x={width - 105} y={SET_TOP + 140}>
          {Math.round(snapshot.good).toLocaleString('en-US')} good
        </text>
      </g>
    </svg>
  )
}
