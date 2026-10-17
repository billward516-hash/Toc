import { capacityPerHour, DAYS, DUE, HORIZON, MIXED, ORDER_SIZES, type LotPlan, type LotResult } from './lots.ts'

// The loading lab's lot rounds: one group of eight tools, run for two weeks. A lot is a customer's order,
// so its size is demand, not a choice, and it ships only when all of it is done. What the player chooses
// is how many tools each sublot gets, whether to cut orders into sublots, and how many orders to keep in
// the system.
export const LOT_ROUND = {
  title: 'Orders and tools',
  // The day the round is played on, so only the plan changes between runs.
  day: 2,
  mission: { good: 64000, cycleHours: 12 },
  start: { size: 'demand', toolsPerLot: 8, depth: 4, split: 1, order: 'first' } satisfies LotPlan,
}

// The hot-order round: the same group, with some orders promised much sooner.
export const HOT_ROUND = {
  title: 'Hot orders',
  day: 2,
  // Every order should meet its promise, and the group still has to ship.
  mission: { onTime: 0.85, good: 60000 },
  // A hot order needs at least this many shipped to count.
  fewest: 3,
  start: { size: 'demand', toolsPerLot: 4, depth: 4, split: 1, order: 'first', hot: 0.15, reserve: false } satisfies LotPlan,
}

export const LIMITS = {
  toolsPerLot: { min: 1, max: 8 },
  depth: { min: 1, max: 12 },
  split: { min: 1, max: 4 },
  // Hot orders as a share of the group's capacity.
  hot: { min: 0, max: 0.5, step: 0.05 },
}

export const meanOrder = (plan: LotPlan): number =>
  plan.size === 'mixed' ? (MIXED[0] + MIXED[1]) / 2 : plan.size === 'demand' ? ORDER_SIZES.reduce((a, b) => a + b, 0) / ORDER_SIZES.length : plan.size

// Hot orders a day on average, for a plan.
export function hotOrdersPerDay(plan: LotPlan): number {
  return ((plan.hot ?? 0) * capacityPerHour() * 24) / meanOrder(plan)
}

// Orders that can be on the tools at once: each takes `split` sets, and each set a sublot.
export function orderSlots(plan: LotPlan, sets: number): number {
  return Math.max(1, Math.floor(sets / (plan.split ?? 1)))
}

export interface LotVerdict {
  goodOk: boolean
  cycleOk: boolean
  passed: boolean
}

export function judgeLots(result: LotResult): LotVerdict {
  const goodOk = result.good >= LOT_ROUND.mission.good
  const cycleOk = result.finished > 0 && result.cycleHours <= LOT_ROUND.mission.cycleHours
  return { goodOk, cycleOk, passed: goodOk && cycleOk }
}

export interface HotVerdict {
  hotOk: boolean
  normalOk: boolean
  goodOk: boolean
  passed: boolean
}

export function judgeHot(result: LotResult): HotVerdict {
  const { mission, fewest } = HOT_ROUND
  const hotOk = result.promises.hot.finished >= fewest && result.promises.hot.onTime >= mission.onTime
  const normalOk = result.promises.normal.finished > 0 && result.promises.normal.onTime >= mission.onTime
  const goodOk = result.good >= mission.good
  return { hotOk, normalOk, goodOk, passed: hotOk && normalOk && goodOk }
}

// Where the tools' time went, as shares of every tool's two weeks.
export interface TimeSplit {
  // Running loads.
  running: number
  // Tools of a set with a sublot committed, standing idle while the others finish it.
  tail: number
  // Sets with no sublot to run.
  starved: number
  // Tools no set includes.
  unused: number
}

export function timeSplit(result: LotResult): TimeSplit {
  const tools = result.groups.reduce((n, g) => n + g.length, 0) + result.unused.length
  const total = tools * HORIZON
  let run = 0
  for (const event of result.events) {
    if (event.type === 'run') run += Math.max(0, Math.min(event.end, HORIZON) - event.t)
  }
  let committed = 0
  for (const lot of result.lots) {
    if (lot.start === null || lot.group === null) continue
    committed += (Math.min(lot.end ?? HORIZON, HORIZON) - lot.start) * result.groups[lot.group].length
  }
  const inSets = result.groups.reduce((n, g) => n + g.length, 0) * HORIZON
  return { running: run / total, tail: (committed - run) / total, starved: (inSets - committed) / total, unused: (result.unused.length * HORIZON) / total }
}

// Average hours from an order's first sublot starting to its shipping, for the orders shipped.
export function holdHours(result: LotResult): number {
  const done = result.orders.filter((o) => o.end !== null && o.start !== null)
  return done.length === 0 ? 0 : done.reduce((sum, o) => sum + ((o.end ?? 0) - (o.start ?? 0)), 0) / done.length / 60
}

// The same for hot orders.
export function hotHoldHours(result: LotResult): number {
  const hot = result.orders.filter((o) => o.hot && o.end !== null && o.start !== null)
  return hot.length === 0 ? 0 : hot.reduce((sum, o) => sum + ((o.end ?? 0) - (o.start ?? 0)), 0) / hot.length / 60
}

// How long after its first sublot started an order's last one did, on average, for orders cut into
// sublots: the time a finished sublot sits waiting for the rest.
export function staggerHours(result: LotResult): number {
  const split = result.orders.filter((o) => o.end !== null && o.sublots.length > 1)
  if (split.length === 0) return 0
  const gap = (id: number) => {
    const starts = result.orders[id].sublots.map((s) => result.lots[s].start ?? 0)
    return Math.max(...starts) - Math.min(...starts)
  }
  return split.reduce((sum, o) => sum + gap(o.id), 0) / split.length / 60
}

export function describePlan(plan: LotPlan): string {
  const sets = Math.floor(8 / plan.toolsPerLot)
  const split = plan.split ?? 1
  const hot = (plan.hot ?? 0) > 0 ? `; ${Math.round((plan.hot ?? 0) * 100)}% hot orders, ${plan.order === 'hot' ? 'hot first' : plan.order === 'shortest' ? 'shortest first' : 'no priority'}${plan.reserve ? ', one set reserved' : ''}` : plan.order === 'shortest' ? '; shortest first' : ''
  return `${plan.toolsPerLot} ${plan.toolsPerLot === 1 ? 'tool' : 'tools'} each (${sets} ${sets === 1 ? 'set' : 'sets'}), ${split === 1 ? 'orders run whole' : `orders cut into ${split}`}, ${plan.depth} in the system${hot}`
}

// What to try next after a run of the order round.
export function lotAdvice(result: LotResult): string {
  const verdict = judgeLots(result)
  if (verdict.passed) return 'Mission done.'
  const { plan } = result
  const sets = result.groups.length
  const split = timeSplit(result)
  const slots = orderSlots(plan, sets)
  if (!verdict.goodOk) {
    if (split.unused > 0.03) {
      return `${result.unused.length} of the 8 tools are in no set: sets of ${plan.toolsPerLot} use only ${sets * plan.toolsPerLot}. Pick a number of tools that divides 8 (1, 2, 4 or 8).`
    }
    if (split.starved > 0.05) {
      return `Some sets had no sublot to run (${Math.round(split.starved * 100)}% of their time). Keep enough orders in the system to give every set a sublot: ${Math.ceil(sets / (plan.split ?? 1))} at least.`
    }
    if (split.tail > 0.08) {
      return `Tools finished their loads and stood idle while the others finished the sublot (${Math.round(split.tail * 100)}% of their time). A sublot fills its tools evenly only when its size is a multiple of 50 times the tools it uses, and customers' orders are what they are, so change the number of tools, or cut orders into fewer sublots.`
    }
    return 'Not enough good wafers: yield averages about 77%, so the tools have to be running close to full all fortnight.'
  }
  if ((plan.split ?? 1) > 1 && staggerHours(result) > 1) {
    return `An order ships only when its last sublot is done, and sublots started ${Math.round(staggerHours(result))} hours apart on average, so the early ones sat finished and unshippable. Cut orders into sublots only when there are free sets to run them all at once.`
  }
  if (plan.depth > slots) {
    return `Orders waited too long: ${plan.depth - slots} of the ${plan.depth} orders were always waiting for a set. At most ${slots} ${slots === 1 ? 'order' : 'orders'} can be on the tools at once; more only adds waiting and ships nothing extra.`
  }
  return `An order held its tools about ${Math.round(holdHours(result))} hours, and orders are customers' demand, so they can't be made smaller. Give each order more tools, so it finishes sooner, and keep only one order per set of tools in the system.`
}

// How the fortnight went, in words.
export function whatHappenedLots(result: LotResult): string {
  const sets = result.groups.length
  const slots = orderSlots(result.plan, sets)
  const wait = Math.max(0, result.cycleHours - holdHours(result))
  const waiting = Math.max(0, result.plan.depth - slots)
  const parts = [
    `An order spent ${Math.round(holdHours(result))} hours from its first sublot starting to shipping, and ${Math.round(wait)} hours before that waiting for a set.`,
    waiting > 0
      ? `With room for ${slots} ${slots === 1 ? 'order' : 'orders'} on the tools at once and ${result.plan.depth} in the system, ${waiting} ${waiting === 1 ? 'is' : 'are'} always waiting. Cycle time is orders in the system divided by orders shipped an hour, so orders beyond what the tools can hold only lengthen the wait.`
      : 'The system holds no more orders than the tools can run at once, so no order waits for anything but a set to finish.',
  ]
  if ((result.plan.split ?? 1) > 1) {
    parts.push(`Each order was cut into ${result.plan.split} sublots, which started ${staggerHours(result) < 0.1 ? 'together' : `${Math.round(staggerHours(result) * 10) / 10} hours apart on average`}. The order shipped only when the last was done.`)
  }
  return parts.join(' ')
}

// Hours a hot order is promised, as the player sees it.
export const promiseWords = `${DUE.hot} hours for a hot order, ${DUE.normal} for any other`

// What to try next after a run of the hot-order round.
export function hotAdvice(result: LotResult): string {
  const verdict = judgeHot(result)
  if (verdict.passed) return 'Mission done.'
  const { plan, promises } = result
  const split = timeSplit(result)
  if ((plan.hot ?? 0) === 0 || promises.hot.finished < HOT_ROUND.fewest) {
    return 'Hardly any hot orders came through, so there was nothing to test the promise on. Send some hot orders in.'
  }
  if (!verdict.hotOk) {
    const took = Math.round(promises.hot.cycleHours)
    if (plan.order !== 'hot') {
      return `Hot orders are promised ${DUE.hot} hours but waited their turn like any other: ${took} hours on average, ${Math.round(promises.hot.onTime * 100)}% on time. A promise is kept by running hot orders first.`
    }
    const hold = Math.round(hotHoldHours(result))
    if (!plan.reserve && hold > DUE.hot / 2) {
      return `Even first in line, a hot order can't interrupt a sublot being run out. It waits for one to finish, then needs ${hold} hours itself: ${took} hours in all. Orders are customers' demand and can't shrink, so give each more tools and it finishes sooner.`
    }
    if (!plan.reserve) {
      return `Hot orders go first, but each still waits for a running sublot to finish (${took} hours in all, ${Math.round(promises.hot.onTime * 100)}% on time). Fewer, bigger sets run an order sooner and leave fewer waiting; or reserve a set so there is always one free.`
    }
    return `Even with a set reserved, hot orders took ${took} hours: they queue behind each other, or each needs too long on too few tools. Give each order more tools.`
  }
  if (!verdict.normalOk) {
    return `Hot orders took the front of the queue and the other orders paid: they averaged ${Math.round(promises.normal.cycleHours)} hours against a ${DUE.normal}-hour promise (${Math.round(promises.normal.onTime * 100)}% on time). Send fewer hot orders, keep fewer orders in the system, or don't hold a set idle for them.`
  }
  if (plan.reserve && split.starved > 0.05) {
    return `The reserved set stood idle ${Math.round(split.starved * 100)}% of the time. That is what a lane kept free for hot orders costs: shipping fell short. Reserve nothing, or send enough hot orders to use it.`
  }
  return lotAdvice(result)
}

// How the fortnight went with hot orders, in words.
export function whatHappenedHot(result: LotResult): string {
  const { promises, plan } = result
  const hot = Math.round(promises.hot.cycleHours)
  const normal = Math.round(promises.normal.cycleHours)
  return `${promises.hot.finished} hot orders took ${hot} hours on average against ${DUE.hot} promised; the other ${promises.normal.finished} took ${normal} against ${DUE.normal}. ${
    plan.order === 'hot'
      ? 'Going first costs the other orders little, since a hot order only jumps the queue, but it cannot interrupt a sublot that is running out: it still waits for one to finish.'
      : 'With no priority, a hot order waits in line like any other order.'
  }`
}

export interface LotSnapshot {
  t: number
  // Sublots waiting for a set, oldest first.
  waiting: number[]
  // The sublot each set is running, if any.
  sets: (number | null)[]
  // The load each tool is running now.
  tools: ({ lot: number; wafers: number; start: number; end: number } | null)[]
  // Orders shipped, and the wafers and good wafers in them.
  finished: number
  wafers: number
  good: number
  // Wafers in finished sublots whose order has not shipped: done, but not shippable.
  held: number
  // Average hours from joining the queue to shipping, over the orders shipped so far.
  cycleHours: number | null
  // The share of the tools' time so far spent running.
  busy: number
}

export function lotSnapshotAt(result: LotResult, t: number, toolCount: number): LotSnapshot {
  const waiting: number[] = []
  const sets: (number | null)[] = result.groups.map(() => null)
  const tools: LotSnapshot['tools'] = Array.from({ length: toolCount }, () => null)
  let finished = 0
  let wafers = 0
  let good = 0
  let cycle = 0
  let run = 0
  let held = 0
  for (const event of result.events) {
    if (event.t > t) break
    switch (event.type) {
      case 'release':
        waiting.push(event.lot)
        break
      case 'start':
        waiting.splice(waiting.indexOf(event.lot), 1)
        sets[event.group] = event.lot
        break
      case 'run':
        tools[event.tool] = { lot: event.lot, wafers: event.wafers, start: event.t, end: event.end }
        run += Math.min(event.end, t) - event.t
        break
      case 'done': {
        const lot = result.lots[event.lot]
        sets[lot.group ?? 0] = null
        held += lot.size
        break
      }
      case 'ship': {
        const order = result.orders[event.order]
        finished++
        wafers += order.size
        good += order.size * order.yield
        cycle += event.t - order.release
        held -= order.size
        break
      }
    }
  }
  return {
    t,
    waiting,
    sets,
    tools: tools.map((run) => (run && t < run.end ? run : null)),
    finished,
    wafers,
    good,
    held,
    cycleHours: finished > 0 ? cycle / finished / 60 : null,
    busy: t > 0 ? run / (toolCount * t) : 0,
  }
}

export const DAYS_SHOWN = DAYS
