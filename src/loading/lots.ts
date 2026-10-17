import { EventQueue } from '../engine/eventQueue.ts'
import { stream } from '../engine/random.ts'

// A group of tools that process wafers for the loading lab's lot rounds. A lot is a customer's order:
// it ships when all of it is done, so a part of it finished early cannot go. An order may be split into
// sublots, but it is not complete until the last sublot is. A sublot is committed to some of the group's
// tools and run out before they take another, so sublots never mix. Tools run loads of up to 50 wafers in
// the same time whatever the load; a sublot's loads go to whichever of its tools is free. The queue is
// kept full: whenever an order ships, another joins it, so only the number of orders in the system is
// chosen.

// Wafers in a full tool load, and the fewest a run may carry.
export const LOAD = 50
export const MIN_LOAD = 15

// Wafers an hour each tool makes at full loads: a couple of slower tools, the rest faster.
export const SPEEDS = [25, 25, 40, 40, 40, 40, 40, 40]

// How a run's time varies from tool to tool and run to run, around the average.
export const RUN_SPREAD = 0.1

// What customers order: each order is one of these, with equal chance. They are demand, not a choice.
export const ORDER_SIZES = [600, 1200, 1800, 2400]
export const MIXED = [600, 2400]

// Average yield of an order is drawn from this range, an order at a time.
export const YIELD = { min: 0.69, max: 0.85 }

// Two weeks, in minutes.
export const DAYS = 14
export const HORIZON = DAYS * 24 * 60

// Shortest-first would leave a big sublot waiting for ever; one whose order has waited this long (three
// days) goes first.
export const AGING = 72 * 60

// Hot orders carry a shorter promise: hours from joining the queue to shipping, for a hot order and for
// any other.
export const DUE = { hot: 14, normal: 40 }

export interface LotPlan {
  // Wafers in every order; 'demand' for orders of every size customers send (ORDER_SIZES), or 'mixed' for
  // a queue of 600s and 2400s.
  size: number | 'demand' | 'mixed'
  // Tools a sublot is committed to. The group splits into as many such sets as it can fill; tools left
  // over sit idle.
  toolsPerLot: number
  // Orders in the system, from joining the queue until they ship.
  depth: number
  // 'hot' runs the sublots of hot orders ahead of the others, each kind in the order it came.
  order: 'first' | 'shortest' | 'hot'
  // Sublots each order is cut into, which together make up the order. 1 runs it whole.
  split?: number
  // Hot orders promised sooner arrive at random times, on top of the orders kept in the system, making up
  // this share of the group's capacity (0 to 1), when the plan has any.
  hot?: number
  // One set takes sublots of hot orders only, standing idle when there are none.
  reserve?: boolean
}

// A customer's order.
export interface Order {
  id: number
  size: number
  yield: number
  // Arrived as a hot order, promised sooner than the rest.
  hot: boolean
  release: number
  // When its first sublot started, and when its last finished, so it shipped.
  start: number | null
  end: number | null
  sublots: number[]
}

// A part of an order, run out on a set of tools.
export interface Lot {
  id: number
  order: number
  size: number
  start: number | null
  end: number | null
  group: number | null
}

export type LotEvent =
  | { t: number; type: 'release'; lot: number }
  | { t: number; type: 'start'; lot: number; group: number }
  | { t: number; type: 'run'; tool: number; lot: number; wafers: number; end: number }
  // A sublot is done, though its order may not be.
  | { t: number; type: 'done'; lot: number }
  // The last sublot is done: the order ships.
  | { t: number; type: 'ship'; order: number }

// How hot orders or the others fared against their promises: orders shipped, the share on time, and
// average cycle hours.
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
  orders: Order[]
  lots: Lot[]
  // The tools of each set a sublot can be committed to, and the tools no set uses.
  groups: number[][]
  unused: number[]
  // Wafers in shipped orders, and the good ones among them.
  wafers: number
  good: number
  // Orders shipped.
  finished: number
  // Average hours from joining the queue to shipping, over the orders shipped.
  cycleHours: number
  // The same, by order size.
  cycleBySize: Record<number, number>
  // Hours the order that has waited longest without starting has been waiting, at the end.
  oldestWait: number
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

// The sizes an order is cut into: equal parts in whole loads where it can be, the last taking the rest.
export function sublotSizes(size: number, split: number): number[] {
  const parts = Math.max(1, Math.min(split, Math.floor(size / LOAD)))
  const each = Math.floor(size / parts / LOAD) * LOAD
  return Array.from({ length: parts }, (_, k) => (k === parts - 1 ? size - each * (parts - 1) : each))
}

type Pending = { kind: 'run'; tool: number; lot: number } | { kind: 'hot' }

export function runLots(plan: LotPlan, seed: number, speeds: readonly number[] = SPEEDS): LotResult {
  const { groups, unused } = toolSets(speeds, plan.toolsPerLot)
  const sizeDraws = stream(seed, 'lot-size')
  const yieldDraws = stream(seed, 'lot-yield')
  const hotDraws = stream(seed, 'lot-hot')
  const runDraws = speeds.map((_, i) => stream(seed, `run:${i}`))
  const orders: Order[] = []
  const lots: Lot[] = []
  const remaining: number[] = []
  const inFlight: number[] = []
  // Sublots of each order not yet done.
  const open: number[] = []
  const waiting: number[] = []
  const running: (number | null)[] = groups.map(() => null)
  const events: LotEvent[] = []
  const agenda = new EventQueue<Pending>()
  let now = 0

  const orderSize = (): number => {
    if (plan.size === 'mixed') return MIXED[sizeDraws() < 0.5 ? 0 : 1]
    if (plan.size === 'demand') return ORDER_SIZES[Math.min(ORDER_SIZES.length - 1, Math.floor(sizeDraws() * ORDER_SIZES.length))]
    return plan.size
  }

  // An order joins the queue with all its sublots at once.
  const release = (hot = false) => {
    const size = orderSize()
    const order: Order = { id: orders.length, size, yield: YIELD.min + yieldDraws() * (YIELD.max - YIELD.min), hot, release: now, start: null, end: null, sublots: [] }
    orders.push(order)
    open.push(0)
    for (const part of sublotSizes(size, plan.split ?? 1)) {
      const lot: Lot = { id: lots.length, order: order.id, size: part, start: null, end: null, group: null }
      lots.push(lot)
      remaining.push(part)
      inFlight.push(0)
      waiting.push(lot.id)
      order.sublots.push(lot.id)
      open[order.id]++
      events.push({ t: now, type: 'release', lot: lot.id })
    }
  }

  const startRun = (tool: number, lot: number) => {
    const wafers = nextLoad(remaining[lot])
    remaining[lot] -= wafers
    inFlight[lot]++
    const minutes = ((60 * LOAD) / speeds[tool]) * (1 + RUN_SPREAD * (2 * runDraws[tool]() - 1))
    agenda.push(now + minutes, { kind: 'run', tool, lot })
    events.push({ t: now, type: 'run', tool, lot, wafers, end: now + minutes })
  }

  // The sublot a set takes next, if any: the reserved set takes sublots of hot orders only.
  const pick = (group: number): number | undefined => {
    const reserved = plan.reserve === true && group === 0 && groups.length > 1
    const hot = (id: number) => orders[lots[id].order].hot
    const pool = reserved ? waiting.filter(hot) : waiting
    if (pool.length === 0) return undefined
    if (plan.order === 'first') return pool[0]
    if (plan.order === 'hot') return pool.find(hot) ?? pool[0]
    const aged = pool.find((id) => now - orders[lots[id].order].release >= AGING)
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
    const order = orders[lots[id].order]
    if (order.start === null) order.start = now
    events.push({ t: now, type: 'start', lot: id, group })
    for (const tool of groups[group]) if (remaining[id] > 0) startRun(tool, id)
  }

  // The reserved set looks first, so a hot order's sublot doesn't go to another set that would take it later.
  const dispatchAll = () => groups.forEach((_, g) => dispatch(g))

  // A hot order comes at a random time: on average, an order's size in wafers over the hot share of what
  // the group can make.
  const meanSize = plan.size === 'mixed' ? (MIXED[0] + MIXED[1]) / 2 : plan.size === 'demand' ? ORDER_SIZES.reduce((a, b) => a + b, 0) / ORDER_SIZES.length : plan.size
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
      const order = orders[lots[lot].order]
      open[order.id]--
      if (open[order.id] === 0) {
        order.end = now
        events.push({ t: now, type: 'ship', order: order.id })
        // A shipped hot order isn't replaced: only the orders kept in the system are.
        if (!order.hot) release()
      }
      dispatchAll()
    }
  }
  // Time on runs, counting the part of a run still going at the end that is inside the horizon.
  let busyTime = 0
  for (const entry of events) if (entry.type === 'run') busyTime += Math.min(entry.end, HORIZON) - entry.t

  const done = orders.filter((o) => o.end !== null)
  const cycle = (set: Order[]) => (set.length === 0 ? 0 : set.reduce((sum, o) => sum + ((o.end ?? 0) - o.release), 0) / set.length / 60)
  const cycleBySize: Record<number, number> = {}
  for (const size of new Set(done.map((o) => o.size))) cycleBySize[size] = cycle(done.filter((o) => o.size === size))
  const promise = (hot: boolean): Kept => {
    const set = done.filter((o) => o.hot === hot)
    const due = hot ? DUE.hot : DUE.normal
    return { finished: set.length, onTime: set.length === 0 ? 1 : set.filter((o) => ((o.end ?? 0) - o.release) / 60 <= due).length / set.length, cycleHours: cycle(set) }
  }
  const notStarted = orders.filter((o) => o.start === null).map((o) => (HORIZON - o.release) / 60)
  return {
    plan,
    seed,
    horizon: HORIZON,
    events,
    orders,
    lots,
    groups,
    unused,
    wafers: done.reduce((sum, o) => sum + o.size, 0),
    good: done.reduce((sum, o) => sum + o.size * o.yield, 0),
    finished: done.length,
    cycleHours: cycle(done),
    cycleBySize,
    oldestWait: notStarted.length === 0 ? 0 : Math.max(...notStarted),
    promises: { hot: promise(true), normal: promise(false) },
    busy: busyTime / (speeds.length * HORIZON),
    capacity: capacityPerHour(speeds) * DAYS * 24,
  }
}
