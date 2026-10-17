import { EventQueue } from '../engine/eventQueue.ts'
import { stream } from '../engine/random.ts'

// A group of tools that process wafers in lots, for the loading lab's lot round. A lot is committed to
// some of the group's tools and run out before they take another, so lots never mix. Tools run loads of
// up to 50 wafers in the same time whatever the load; a lot's loads go to whichever of its tools is free.
// The queue is kept full: whenever a lot finishes, another joins it, so only the number of lots in the
// system is chosen.

// Wafers in a full tool load, and the fewest a run may carry.
export const LOAD = 50
export const MIN_LOAD = 15

// Wafers an hour each tool makes at full loads: a couple of slower tools, the rest faster.
export const SPEEDS = [25, 25, 40, 40, 40, 40, 40, 40]

// How a run's time varies from tool to tool and run to run, around the average.
export const RUN_SPREAD = 0.1

// Lot sizes the lab offers, and the two sizes of a mixed queue.
export const LOT_SIZES = { min: 600, max: 2400, step: 50 }
export const MIXED = [600, 2400]

// Average yield of a lot is drawn from this range, a lot at a time.
export const YIELD = { min: 0.69, max: 0.85 }

// Two weeks, in minutes.
export const DAYS = 14
export const HORIZON = DAYS * 24 * 60

// Shortest-first would leave a big lot waiting for ever; one waiting this long (three days) goes first.
export const AGING = 72 * 60

// Hot lots carry a shorter promise: hours from joining the queue to finishing, for a hot lot and for
// any other.
export const DUE = { hot: 14, normal: 40 }

export interface LotPlan {
  // Wafers in every lot, or 'mixed' for a queue of 600s and 2400s.
  size: number | 'mixed'
  // Tools a lot is committed to. The group splits into as many such sets as it can fill; tools left over
  // sit idle.
  toolsPerLot: number
  // Lots in the system, waiting or running.
  depth: number
  // 'hot' runs hot lots ahead of the others, each kind in the order it came.
  order: 'first' | 'shortest' | 'hot'
  // Hot lots promised sooner arrive at random times, on top of the lots kept in the system, making up
  // this share of the group's capacity (0 to 1), when the plan has any.
  hot?: number
  // One set takes hot lots only, standing idle when there are none.
  reserve?: boolean
}

export interface Lot {
  id: number
  size: number
  yield: number
  // Arrived as a hot lot, promised sooner than the rest.
  hot: boolean
  release: number
  start: number | null
  end: number | null
  group: number | null
}

export type LotEvent =
  | { t: number; type: 'release'; lot: number }
  | { t: number; type: 'start'; lot: number; group: number }
  | { t: number; type: 'run'; tool: number; lot: number; wafers: number; end: number }
  | { t: number; type: 'done'; lot: number }

export interface Kept {
  finished: number
  onTime: number
  cycleHours: number
}

export interface LotResult {
  plan: LotPlan
  seed: number
  horizon: number
  events: LotEvent[]
  lots: Lot[]
  // The tools of each set a lot can be committed to, and the tools no set uses.
  groups: number[][]
  unused: number[]
  // Wafers in finished lots, and the good ones among them.
  wafers: number
  good: number
  finished: number
  // Average hours from joining the queue to finishing, over the finished lots.
  cycleHours: number
  // The same, by lot size, when the queue is mixed.
  cycleBySize: Record<number, number>
  // Hours the lot that has waited longest has been waiting, at the end.
  oldestWait: number
  // How hot lots and the others fared against their promises: lots finished, the share on time, and
  // average cycle hours.
  promises: { hot: Kept; normal: Kept }
  // The share of the tools' time spent on runs.
  busy: number
  // Wafers the whole group could make in the horizon at full loads.
  capacity: number
}

// Tools in sets: dealt out fastest first so every set gets a mix of fast and slow, with the slowest left
// over when the sets don't use every tool.
export function toolSets(speeds: readonly number[], toolsPerLot: number): { groups: number[][]; unused: number[] } {
  const order = speeds.map((_, i) => i).sort((a, b) => speeds[b] - speeds[a] || a - b)
  const sets = Math.max(0, Math.floor(speeds.length / toolsPerLot))
  const groups: number[][] = Array.from({ length: sets }, () => [])
  order.slice(0, sets * toolsPerLot).forEach((tool, k) => groups[k % sets].push(tool))
  return { groups, unused: order.slice(sets * toolsPerLot) }
}

export function nextLoad(remaining: number): number {
  if (remaining <= LOAD) return remaining
  return remaining - LOAD < MIN_LOAD ? remaining - MIN_LOAD : LOAD
}

export function capacityPerHour(speeds: readonly number[] = SPEEDS): number {
  return speeds.reduce((sum, s) => sum + s, 0)
}

type Pending = { kind: 'run'; tool: number; lot: number } | { kind: 'hot' }

export function runLots(plan: LotPlan, seed: number, speeds: readonly number[] = SPEEDS): LotResult {
  const { groups, unused } = toolSets(speeds, plan.toolsPerLot)
  const sizeDraws = stream(seed, 'lot-size')
  const yieldDraws = stream(seed, 'lot-yield')
  const hotDraws = stream(seed, 'lot-hot')
  const runDraws = speeds.map((_, i) => stream(seed, `run:${i}`))
  const lots: Lot[] = []
  const remaining: number[] = []
  const inFlight: number[] = []
  const waiting: number[] = []
  const running: (number | null)[] = groups.map(() => null)
  const events: LotEvent[] = []
  const agenda = new EventQueue<Pending>()
  let now = 0

  const release = (hot = false) => {
    const size = plan.size === 'mixed' ? MIXED[sizeDraws() < 0.5 ? 0 : 1] : plan.size
    const lot: Lot = { id: lots.length, size, yield: YIELD.min + yieldDraws() * (YIELD.max - YIELD.min), hot, release: now, start: null, end: null, group: null }
    lots.push(lot)
    remaining.push(size)
    inFlight.push(0)
    waiting.push(lot.id)
    events.push({ t: now, type: 'release', lot: lot.id })
  }

  const startRun = (tool: number, lot: number) => {
    const wafers = nextLoad(remaining[lot])
    remaining[lot] -= wafers
    inFlight[lot]++
    const minutes = ((60 * LOAD) / speeds[tool]) * (1 + RUN_SPREAD * (2 * runDraws[tool]() - 1))
    agenda.push(now + minutes, { kind: 'run', tool, lot })
    events.push({ t: now, type: 'run', tool, lot, wafers, end: now + minutes })
  }

  // The lot a set takes next, if any: the reserved set takes hot lots only.
  const pick = (group: number): number | undefined => {
    const reserved = plan.reserve === true && group === 0 && groups.length > 1
    const pool = reserved ? waiting.filter((id) => lots[id].hot) : waiting
    if (pool.length === 0) return undefined
    if (plan.order === 'first') return pool[0]
    if (plan.order === 'hot') return pool.find((id) => lots[id].hot) ?? pool[0]
    const aged = pool.find((id) => now - lots[id].release >= AGING)
    if (aged !== undefined) return aged
    return pool.reduce((best, id) => (lots[id].size < lots[best].size ? id : best), pool[0])
  }

  const dispatch = (group: number) => {
    if (running[group] !== null) return
    const id = pick(group)
    if (id === undefined) return
    waiting.splice(waiting.indexOf(id), 1)
    running[group] = id
    lots[id].start = now
    lots[id].group = group
    events.push({ t: now, type: 'start', lot: id, group })
    for (const tool of groups[group]) if (remaining[id] > 0) startRun(tool, id)
  }

  // The reserved set looks first, so a hot lot doesn't go to another set that would take it later.
  const dispatchAll = () => groups.forEach((_, g) => dispatch(g))

  // A hot lot comes at a random time: on average, a lot's size in wafers over the hot share of what the
  // group can make.
  const meanSize = plan.size === 'mixed' ? (MIXED[0] + MIXED[1]) / 2 : plan.size
  const nextHot = () => agenda.push(now + ((60 * meanSize) / ((plan.hot ?? 1) * capacityPerHour(speeds))) * (0.1 + 1.8 * hotDraws()), { kind: 'hot' })
  if ((plan.hot ?? 0) > 0) nextHot()
  for (let k = 0; k < plan.depth; k++) release()
  dispatchAll()

  for (;;) {
    const next = agenda.pop()
    if (!next || next.t > HORIZON) break
    now = next.t
    if (next.payload.kind === 'hot') {
      release(true)
      dispatchAll()
      nextHot()
      continue
    }
    const { tool, lot } = next.payload
    inFlight[lot]--
    if (remaining[lot] > 0) {
      startRun(tool, lot)
    } else if (inFlight[lot] === 0) {
      const group = lots[lot].group ?? 0
      lots[lot].end = now
      events.push({ t: now, type: 'done', lot })
      running[group] = null
      // A finished hot lot isn't replaced: only the lots kept in the system are.
      if (!lots[lot].hot) release()
      dispatchAll()
    }
  }
  // Time on runs, counting the part of a run still going at the end that is inside the horizon.
  let busyTime = 0
  for (const entry of events) if (entry.type === 'run') busyTime += Math.min(entry.end, HORIZON) - entry.t

  const done = lots.filter((l) => l.end !== null)
  const cycle = (set: Lot[]) => (set.length === 0 ? 0 : set.reduce((sum, l) => sum + ((l.end ?? 0) - l.release), 0) / set.length / 60)
  const cycleBySize: Record<number, number> = {}
  for (const size of new Set(done.map((l) => l.size))) cycleBySize[size] = cycle(done.filter((l) => l.size === size))
  const promise = (hot: boolean): Kept => {
    const set = done.filter((l) => l.hot === hot)
    const due = hot ? DUE.hot : DUE.normal
    return { finished: set.length, onTime: set.length === 0 ? 1 : set.filter((l) => ((l.end ?? 0) - l.release) / 60 <= due).length / set.length, cycleHours: cycle(set) }
  }
  const waitingNow = waiting.map((id) => (HORIZON - lots[id].release) / 60)
  return {
    plan,
    seed,
    horizon: HORIZON,
    events,
    lots,
    groups,
    unused,
    wafers: done.reduce((sum, l) => sum + l.size, 0),
    good: done.reduce((sum, l) => sum + l.size * l.yield, 0),
    finished: done.length,
    cycleHours: cycle(done),
    cycleBySize,
    oldestWait: waitingNow.length === 0 ? 0 : Math.max(...waitingNow),
    promises: { hot: promise(true), normal: promise(false) },
    busy: busyTime / (speeds.length * HORIZON),
    capacity: capacityPerHour(speeds) * DAYS * 24,
  }
}
