import { useMemo, useState } from 'react'
import {
  DAYS_SHOWN,
  describePlan,
  holdHours,
  hotAdvice,
  HOT_ROUND,
  hotOrdersPerDay,
  judgeHot,
  judgeLots,
  LIMITS,
  LOT_ROUND,
  lotAdvice,
  lotSnapshotAt,
  orderSlots,
  timeSplit,
  whatHappenedHot,
  whatHappenedLots,
  type LotSnapshot,
} from '../loading/lotRound.ts'
import { capacityPerHour, DUE, HORIZON, ORDER_SIZES, runLots, SPEEDS, type LotPlan, type LotResult } from '../loading/lots.ts'
import { Icon } from './icons.tsx'
import { CycleBar, DepthChart, type DepthPoint } from './LabParts.tsx'
import { PlaybackPanel, ScreenHeader, type Stat } from './parts.tsx'
import { showFloor } from './scroll.ts'
import { usePlayback } from './usePlayback.ts'

// Simulated minutes per real second at 1x: the fortnight plays in 80 seconds.
const MINUTES_PER_SECOND = 252
const SWEEP_SEEDS = 4
const COLORS = ['#4c8dff', '#8a5cf6', '#ff6fb5', '#2ec5e6', '#ff8a3d', '#6a7bff']
const orderColor = (order: number) => COLORS[order % COLORS.length]
const TOOLS = SPEEDS.length

interface Run {
  number: number
  plan: LotPlan
  result: LotResult
}

const samePlan = (a: LotPlan, b: LotPlan) =>
  a.size === b.size && a.toolsPerLot === b.toolsPerLot && a.depth === b.depth && a.order === b.order && (a.hot ?? 0) === (b.hot ?? 0) && (a.reserve ?? false) === (b.reserve ?? false)

export interface LotLog {
  tries: number
  passed: boolean
  plan: LotPlan
}

export type LotMode = 'lots' | 'hot'

// The lot round: eight tools, two weeks, and a queue that is always full. Choose the lots, the tools
// each gets, and how many lots to keep in the system. In the hot-lot round some lots are promised much
// sooner, and the plan also says how they are treated.
export function LotRound({ mode, number, total, onFinish, onExit }: { mode: LotMode; number: number; total: number; onFinish: (log: LotLog) => void; onExit: () => void }) {
  const hotMode = mode === 'hot'
  const round = hotMode ? HOT_ROUND : LOT_ROUND
  const passes = (r: LotResult) => (hotMode ? judgeHot(r).passed : judgeLots(r).passed)
  const [plan, setPlan] = useState<LotPlan>(round.start)
  const [runs, setRuns] = useState<Run[]>([])
  const [speed, setSpeed] = useState(4)
  const result = useMemo(() => runLots(plan, round.day), [plan, round.day])
  const playback = usePlayback(HORIZON, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => lotSnapshotAt(result, playback.t, TOOLS), [result, playback.t])
  const latest = runs.at(-1)
  const ran = latest !== undefined && samePlan(latest.plan, plan)
  const done = ran && playback.finished ? latest : null
  const passed = runs.some((r) => passes(r.result))
  const sets = result.groups.length
  const verdict = done && !hotMode ? judgeLots(done.result) : null
  const hotVerdict = done && hotMode ? judgeHot(done.result) : null
  const sweep = useMemo<DepthPoint[] | null>(() => {
    if (!done || hotMode) return null
    return Array.from({ length: LIMITS.depth.max }, (_, k) => {
      const runsAt = Array.from({ length: SWEEP_SEEDS }, (_, s) => runLots({ ...done.plan, depth: k + 1 }, s + 1))
      const mean = (pick: (r: LotResult) => number) => runsAt.reduce((sum, r) => sum + pick(r), 0) / SWEEP_SEEDS
      return { depth: k + 1, cycleHours: mean((r) => r.cycleHours), busy: mean((r) => r.busy) }
    })
  }, [done, hotMode])

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
    { label: 'Orders shipped', value: snapshot.finished },
    { label: 'Good wafers', value: Math.round(snapshot.good).toLocaleString('en-US') },
    { label: 'Order cycle time', value: snapshot.cycleHours === null ? '–' : `${Math.round(snapshot.cycleHours)} h` },
    { label: 'Tools busy', value: `${Math.round(100 * snapshot.busy)}%` },
  ]
  const capacity = capacityPerHour()

  return (
    <div className="screen level-screen lab">
      <ScreenHeader chip={`Loading lab · round ${number} of ${total}`} title={round.title} stats={stats} onExit={onExit} />

      <section className="card lab-brief" aria-label="Round brief">
        <p>
          A group of <strong>eight tools</strong> processes wafers. Two tools make {SPEEDS[0]} wafers an hour and six make {SPEEDS[2]}, so the group can make {capacity} an hour, about {Math.round((capacity * DAYS_SHOWN * 24) / 1000)},000 in two weeks. A load of up to 50 wafers takes a tool the same time whatever its size. Wafers are always queued, so arrivals don't matter.
        </p>
        <p>
          <strong>A lot is a customer's order: {ORDER_SIZES.slice(0, -1).join(', ')} or {ORDER_SIZES.at(-1)} wafers, not yours to change, and it ships only when all of it is done.</strong> An order can be cut into sublots, but a sublot finished early can't ship; it waits for the rest. Each sublot is run out on its tools before they take another, so sublots never mix. You choose how many tools each gets, whether to cut orders into sublots, and how many orders to keep in the system. Yield averages about 77%, order by order between 69% and 85%.
        </p>
        {hotMode && (
          <p>
            <strong>Some orders are promised sooner.</strong> A hot order must ship within {DUE.hot} hours of arriving, any other within {DUE.normal}. Hot orders arrive at random, on top of the orders in the system, and take up a share of the group's capacity you can change. You decide how they are treated: whether they go first, and whether a set is kept free for them. A sublot already running is never interrupted.
          </p>
        )}
        <p className="mission">
          <Icon name="bolt" />
          <span>
            {hotMode ? (
              <>
                <strong>Mission:</strong> at least <strong>{Math.round(HOT_ROUND.mission.onTime * 100)}%</strong> of the hot orders and of the other orders shipped on time, and at least <strong>{HOT_ROUND.mission.good.toLocaleString('en-US')} good wafers</strong> in two weeks.
              </>
            ) : (
              <>
                <strong>Mission:</strong> ship at least <strong>{LOT_ROUND.mission.good.toLocaleString('en-US')} good wafers</strong> in two weeks, with an order's average time from joining the queue to shipping no more than <strong>{LOT_ROUND.mission.cycleHours} hours</strong>.
              </>
            )}
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
              <i className="swatch" /> Sublot waiting
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
          {done && (verdict || hotVerdict) && (
            <section className="runs lab-result" aria-label={`Run ${done.number}`} aria-live="polite">
              <h3>Run {done.number}</h3>
              {hotVerdict ? <HotVerdictList result={done.result} verdict={hotVerdict} /> : verdict && <LotVerdictList result={done.result} verdict={verdict} />}
              <CycleBar cycle={done.result.cycleHours} waiting={Math.max(0, done.result.cycleHours - holdHours(done.result))} labels={['From first start to shipping', 'Waiting to start']} unit="h" />
              <p>{hotMode ? whatHappenedHot(done.result) : whatHappenedLots(done.result)}</p>
              <p className="advice">{hotMode ? hotAdvice(done.result) : lotAdvice(done.result)}</p>
              {hotMode && <PromiseTable result={done.result} />}
              <TimeSplitBar result={done.result} />
              {!hotMode && <BySize result={done.result} />}
            </section>
          )}
          {sweep && done && (
            <section className="runs" aria-label="Cycle time against lots in the system">
              <h3>The same plan at other numbers of orders in the system</h3>
              <DepthChart points={sweep} sets={orderSlots(done.plan, done.result.groups.length)} current={done.plan.depth} limit={LOT_ROUND.mission.cycleHours} />
              <p className="hint">Average of {SWEEP_SEEDS} fortnights. Past what the tools can run at once, extra orders in the system make no more wafers; they only add waiting.</p>
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
                    {hotMode ? (
                      <>
                        <th scope="col">Hot on time</th>
                        <th scope="col">Others on time</th>
                      </>
                    ) : (
                      <th scope="col">Cycle</th>
                    )}
                    <th scope="col">Mission</th>
                  </tr>
                </thead>
                <tbody>
                  {[...runs].reverse().map((r) => {
                    const v = judgeLots(r.result)
                    const h = judgeHot(r.result)
                    const won = hotMode ? h.passed : v.passed
                    const why = hotMode ? (!h.hotOk ? 'Hot late' : !h.normalOk ? 'Others late' : 'Too few') : !v.goodOk ? 'Too few' : 'Too slow'
                    const pct = (x: number) => `${Math.round(x * 100)}%`
                    return (
                      <tr key={r.number} className={won ? 'current' : undefined}>
                        <th scope="row">{r.number}</th>
                        <td className="changes">{describePlan(r.plan)}</td>
                        <td>{Math.round(r.result.good / 1000)}k</td>
                        {hotMode ? (
                          <>
                            <td>{pct(r.result.promises.hot.onTime)}</td>
                            <td>{pct(r.result.promises.normal.onTime)}</td>
                          </>
                        ) : (
                          <td>{Math.round(r.result.cycleHours)} h</td>
                        )}
                        <td>{won ? 'Done' : why}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}
        </PlaybackPanel>

        <section className="card lab-controls" aria-label="Plan the orders">
          <fieldset className="lever">
            <legend>
              <Icon name="stack" /> Cut each order into sublots
            </legend>
            <div className="chips" role="group" aria-label="Sublots for each order">
              {Array.from({ length: LIMITS.split.max }, (_, k) => k + 1).map((k) => (
                <button key={k} className={`chip${(plan.split ?? 1) === k ? ' on' : ''}`} aria-pressed={(plan.split ?? 1) === k} onClick={() => change({ split: k })}>
                  {k === 1 ? 'Whole' : k}
                </button>
              ))}
            </div>
            <p className="hint">An order ships only when its last sublot is done. A sublot that finishes early waits for the rest.</p>
          </fieldset>
          <fieldset className="lever">
            <legend>
              <Icon name="build" /> Tools for each sublot
            </legend>
            <div className="chips" role="group" aria-label="Tools for each sublot">
              {Array.from({ length: LIMITS.toolsPerLot.max }, (_, k) => k + 1).map((m) => (
                <button key={m} className={`chip${plan.toolsPerLot === m ? ' on' : ''}`} aria-pressed={plan.toolsPerLot === m} onClick={() => change({ toolsPerLot: m })}>
                  {m}
                </button>
              ))}
            </div>
            <p className="hint">
              {sets} {sets === 1 ? 'sublot' : 'sublots'} at a time on {sets * plan.toolsPerLot} tools
              {result.unused.length > 0 ? `; ${result.unused.length} ${result.unused.length === 1 ? 'tool is' : 'tools are'} left in no set` : ''}.
            </p>
          </fieldset>
          <fieldset className="lever">
            <legend>
              <Icon name="even" /> Orders in the system
            </legend>
            <div className="dial" role="group" aria-label="Orders in the system">
              <button className="chip step" aria-label="Fewer orders" disabled={plan.depth <= LIMITS.depth.min} onClick={() => change({ depth: plan.depth - 1 })}>
                <Icon name="minus" />
              </button>
              <input type="range" min={LIMITS.depth.min} max={LIMITS.depth.max} step={1} value={plan.depth} aria-valuetext={`${plan.depth} orders`} onChange={(event) => change({ depth: Number(event.target.value) })} />
              <button className="chip step" aria-label="More orders" disabled={plan.depth >= LIMITS.depth.max} onClick={() => change({ depth: plan.depth + 1 })}>
                <Icon name="plus" />
              </button>
            </div>
            <p className="dial-read" aria-live="polite">
              <strong>{plan.depth}</strong> {plan.depth === 1 ? 'order' : 'orders'}; the tools can run {orderSlots(plan, sets)} at once:{' '}
              {plan.depth < orderSlots(plan, sets) ? `${orderSlots(plan, sets) - plan.depth} could run with nothing to start` : plan.depth === orderSlots(plan, sets) ? 'none waiting' : `${plan.depth - orderSlots(plan, sets)} always waiting`}.
            </p>
          </fieldset>
          {hotMode && (
            <>
              <fieldset className="lever">
                <legend>
                  <Icon name="alert" /> Hot orders: {Math.round((plan.hot ?? 0) * 100)}% of the group's capacity
                </legend>
                <div className="dial" role="group" aria-label="Hot orders">
                  <input
                    type="range"
                    min={LIMITS.hot.min}
                    max={LIMITS.hot.max}
                    step={LIMITS.hot.step}
                    value={plan.hot ?? 0}
                    aria-valuetext={`${Math.round((plan.hot ?? 0) * 100)}% of capacity`}
                    onChange={(event) => change({ hot: Math.round(Number(event.target.value) * 100) / 100 })}
                  />
                </div>
                <p className="hint">About {hotOrdersPerDay(plan).toFixed(1)} hot orders a day, arriving at random.</p>
              </fieldset>
              <fieldset className="lever">
                <legend>
                  <Icon name="sort" /> Which order goes next
                </legend>
                <div className="chips">
                  {(
                    [
                      ['first', 'First come, first served'],
                      ['hot', 'Hot orders first'],
                    ] as const
                  ).map(([order, text]) => (
                    <button key={order} className={`chip${plan.order === order ? ' on' : ''}`} aria-pressed={plan.order === order} onClick={() => change({ order })}>
                      {text}
                    </button>
                  ))}
                </div>
                <div className="chips">
                  <button className={`chip${plan.reserve ? ' on' : ''}`} aria-pressed={plan.reserve === true} disabled={sets < 2} onClick={() => change({ reserve: !plan.reserve })}>
                    Keep one set free for hot orders
                  </button>
                </div>
                <p className="hint">{sets < 2 ? 'With one set there is none to spare.' : 'A reserved set takes sublots of hot orders only, and stands idle when there are none. A sublot already running is never interrupted.'}</p>
              </fieldset>
            </>
          )}
          {!hotMode && (
            <fieldset className="lever">
              <legend>
                <Icon name="sort" /> Which order goes next
              </legend>
              <div className="chips">
                {(
                  [
                    ['first', 'First come, first served'],
                    ['shortest', 'Smallest sublot first'],
                  ] as const
                ).map(([order, text]) => (
                  <button key={order} className={`chip${plan.order === order ? ' on' : ''}`} aria-pressed={plan.order === order} onClick={() => change({ order })}>
                    {text}
                  </button>
                ))}
              </div>
              <p className="hint">Smallest first gives way to any order that has waited three days.</p>
            </fieldset>
          )}
          <div className="run-bar">
            <button className="btn primary big" onClick={run}>
              Run two weeks <Icon name="play" />
            </button>
            {(passed || runs.length >= 4) && (
              <button className={`btn big${passed ? ' next' : ''}`} onClick={() => onFinish({ tries: runs.length, passed, plan: (runs.find((r) => passes(r.result)) ?? runs.at(-1)!).plan })}>
                {passed ? (hotMode ? 'See what it shows' : 'Next round') : 'Skip this round'} <Icon name="next" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function LotVerdictList({ result, verdict }: { result: LotResult; verdict: ReturnType<typeof judgeLots> }) {
  const { mission } = LOT_ROUND
  return (
    <ul className={`verdict${verdict.passed ? ' won' : ''}`}>
      <li className={verdict.goodOk ? 'ok' : 'miss'}>
        <Icon name={verdict.goodOk ? 'check' : 'cross'} />
        <span>
          Good wafers <strong>{Math.round(result.good).toLocaleString('en-US')}</strong>, at least {mission.good.toLocaleString('en-US')}
        </span>
      </li>
      <li className={verdict.cycleOk ? 'ok' : 'miss'}>
        <Icon name={verdict.cycleOk ? 'check' : 'cross'} />
        <span>
          Order cycle time <strong>{Math.round(result.cycleHours)} h</strong>, no more than {mission.cycleHours}
        </span>
      </li>
    </ul>
  )
}

function HotVerdictList({ result, verdict }: { result: LotResult; verdict: ReturnType<typeof judgeHot> }) {
  const { mission } = HOT_ROUND
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const rows = [
    { ok: verdict.hotOk, text: `Hot orders on time: ${pct(result.promises.hot.onTime)} of ${result.promises.hot.finished}, at least ${pct(mission.onTime)}` },
    { ok: verdict.normalOk, text: `Other orders on time: ${pct(result.promises.normal.onTime)} of ${result.promises.normal.finished}, at least ${pct(mission.onTime)}` },
    { ok: verdict.goodOk, text: `Good wafers: ${Math.round(result.good).toLocaleString('en-US')}, at least ${mission.good.toLocaleString('en-US')}` },
  ]
  return (
    <ul className={`verdict${verdict.passed ? ' won' : ''}`}>
      {rows.map((row) => (
        <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
          <Icon name={row.ok ? 'check' : 'cross'} />
          <span>{row.text}</span>
        </li>
      ))}
    </ul>
  )
}

// How the hot lots and the others did against their promises.
function PromiseTable({ result }: { result: LotResult }) {
  const rows = [
    { name: 'Hot orders', due: DUE.hot, kept: result.promises.hot },
    { name: 'Other orders', due: DUE.normal, kept: result.promises.normal },
  ]
  return (
    <table className="data-table promise-table">
      <thead>
        <tr>
          <th scope="col">Orders</th>
          <th scope="col">Finished</th>
          <th scope="col">Promised</th>
          <th scope="col">Took</th>
          <th scope="col">On time</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <th scope="row">{row.name}</th>
            <td>{row.kept.finished}</td>
            <td>{row.due} h</td>
            <td>{Math.round(row.kept.cycleHours)} h</td>
            <td>{Math.round(row.kept.onTime * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Where the tools' time went, in four parts.
function TimeSplitBar({ result }: { result: LotResult }) {
  const split = timeSplit(result)
  const parts = [
    { key: 'running', label: 'Running loads', value: split.running },
    { key: 'tail', label: 'Idle at the end of a sublot', value: split.tail },
    { key: 'starved', label: 'In a set with nothing to run', value: split.starved },
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
      {sizes.map((size) => `${size}-wafer orders: ${Math.round(result.cycleBySize[size])} h`).join(' · ')}
      {result.oldestWait > 0 ? ` · longest wait to start, still going: ${Math.round(result.oldestWait)} h` : ''}
      <br />
      <small>Which goes first changes who waits, not the average: that is set by the orders in the system.</small>
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
  const label = (lotId: number) => {
    const lot = result.lots[lotId]
    const order = result.orders[lot.order]
    if (order.hot) return 'HOT'
    return order.sublots.length > 1 ? `${order.size}: ${order.sublots.indexOf(lotId) + 1}/${order.sublots.length}` : `${order.size}`
  }
  return (
    <svg className="factory lot-floor" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Tool group">
      <text className="area-label" x={QUEUE_W / 2} y={22}>
        Sublots waiting ({snapshot.waiting.length})
      </text>
      {shown.map((id, k) => {
        const lot = result.lots[id]
        const hot = result.orders[lot.order].hot
        return (
          <g key={id} className={`queued-lot${hot ? ' hot' : ''}`}>
            <rect x={14} y={38 + k * 24} width={(lot.size / maxSize) * (QUEUE_W - 130) + 20} height={19} rx={6} style={{ fill: orderColor(lot.order) }} />
            <text className="lot-size" x={14 + (lot.size / maxSize) * (QUEUE_W - 130) + 28} y={52 + k * 24}>
              {lot.size}
              {hot ? ' HOT' : ''}
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
          <g key={g} className={`tool-set${lotId === null ? ' empty' : ''}${lotId !== null && result.orders[result.lots[lotId].order].hot ? ' hot' : ''}`}>
            <rect className="set-box" x={box.left - 4} y={SET_TOP - 30} width={box.width + 8} height={232} rx={14} />
            <text className="set-label" x={box.left + box.width / 2} y={SET_TOP - 10}>
              {lotId === null ? (result.plan.reserve && g === 0 ? 'Free for hot orders' : 'Nothing to run') : label(lotId)}
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
            <rect className="tool-box" x={left + 4} y={SET_TOP} width={SLOT - 8} height={170} rx={12} style={run ? { fill: orderColor(result.lots[run.lot].order) } : undefined} />
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
          Shipped
        </text>
        <text className="bin-count compact" x={width - 105} y={SET_TOP + 70}>
          {snapshot.finished}
        </text>
        <text className="bin-label" x={width - 105} y={SET_TOP + 112}>
          {snapshot.wafers.toLocaleString('en-US')} wafers
        </text>
        <text className="bin-label" x={width - 105} y={SET_TOP + 140}>
          {Math.round(snapshot.good).toLocaleString('en-US')} good
        </text>
        <text className={`bin-label held${snapshot.held > 0 ? ' some' : ''}`} x={width - 105} y={SET_TOP + 172}>
          Done, can't ship:
        </text>
        <text className={`bin-label held${snapshot.held > 0 ? ' some' : ''}`} x={width - 105} y={SET_TOP + 192}>
          {snapshot.held.toLocaleString('en-US')} wafers
        </text>
      </g>
    </svg>
  )
}
