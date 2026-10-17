import { capacityPerHour, DAYS, HORIZON, MIXED, ORDER_SIZES, SPEEDS, YIELD, type LotPlan, type LotResult } from './lots.ts'

// The loading lab's lot rounds: one group of eight tools, run for two weeks. A lot is a customer's order,
// so its size is demand, not a choice, and it ships only when all of it is done. What the player chooses
// is how many tools each sublot gets, whether to cut orders into sublots, and how many orders to keep in
// the system, and what yield to start each order for.
export const LOT_ROUND = {
  title: 'Orders and tools',
  // The day the round is played on, so only the plan changes between runs.
  day: 2,
}

// The hot-order round: the same group, with some orders promised much sooner.
export const HOT_ROUND = {
  title: 'Hot orders',
  day: 2,
  // A hot order needs at least this many shipped to count.
  fewest: 3,
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step

// Wafers the group could process in the fortnight at full loads.
const rawCapacity = (speeds: readonly number[]) => capacityPerHour(speeds) * DAYS * 24

// What the order round asks of a workgroup: wafers shipped in full orders (60% of what it could process,
// since a lot of the rest is yield) and the average hours an order may take (2.4 times what an order
// takes on the whole fleet, so no more than two orders in the system).
export function lotMission(speeds: readonly number[]): { good: number; cycleHours: number } {
  const hold = meanOrder({ size: 'demand' } as LotPlan) / YIELD.min / capacityPerHour(speeds)
  return { good: roundTo(0.6 * rawCapacity(speeds), 500), cycleHours: Math.round(2.4 * hold) }
}

// What the hot-order round asks: the share of every kind of order shipped on time, and the wafers.
export function hotMission(speeds: readonly number[]): { onTime: number; good: number } {
  return { onTime: 0.85, good: roundTo(0.57 * rawCapacity(speeds), 500) }
}

// Where each round starts: the whole fleet on an order, a queue of orders, and a middling yield, which
// fails the mission.
export function startPlan(mode: 'lots' | 'hot', speeds: readonly number[]): LotPlan {
  const whole = { size: 'demand', toolsPerLot: speeds.length, split: 1, order: 'first', startFor: 0.77 } as const
  return mode === 'hot' ? { ...whole, depth: 3, hot: 0.15, reserve: false } : { ...whole, depth: 4 }
}

// A workgroup is generally run with the whole fleet dedicated to one order, so orders never mix; some
// workgroups can be divided into single tools. Those are the two ways the lab offers.

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
export function hotOrdersPerDay(plan: LotPlan, speeds: readonly number[] = SPEEDS): number {
  return ((plan.hot ?? 0) * capacityPerHour(speeds) * 24) / meanOrder(plan)
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
  const mission = lotMission(result.speeds)
  const goodOk = result.good >= mission.good
  const cycleOk = result.finished > 0 && result.cycleHours <= mission.cycleHours
  return { goodOk, cycleOk, passed: goodOk && cycleOk }
}

export interface HotVerdict {
  hotOk: boolean
  normalOk: boolean
  goodOk: boolean
  passed: boolean
}

export function judgeHot(result: LotResult): HotVerdict {
  const { fewest } = HOT_ROUND
  const mission = hotMission(result.speeds)
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

export function describePlan(plan: LotPlan, tools = 8): string {
  const sets = Math.floor(tools / plan.toolsPerLot)
  const split = plan.split ?? 1
  const hot = (plan.hot ?? 0) > 0 ? `; ${Math.round((plan.hot ?? 0) * 100)}% hot orders, ${plan.order === 'hot' ? 'hot first' : plan.order === 'shortest' ? 'shortest first' : 'no priority'}${plan.reserve ? ', one set reserved' : ''}` : plan.order === 'shortest' ? '; shortest first' : ''
  const way = plan.toolsPerLot >= tools ? 'whole fleet on each order' : plan.toolsPerLot === 1 ? 'one tool per order' : `${plan.toolsPerLot} tools each (${sets} sets)`
  return `${way}, ${split === 1 ? 'orders run whole' : `orders cut into ${split}`}, ${plan.depth} in the system, started for ${Math.round((plan.startFor ?? YIELD.min) * 100)}% yield${hot}`
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
      return `${result.unused.length} of the ${result.speeds.length} tools are in no set: sets of ${plan.toolsPerLot} use only ${sets * plan.toolsPerLot}. Run the whole fleet on one order, or one tool to an order.`
    }
    if (split.starved > 0.05) {
      return `Some sets had no sublot to run (${Math.round(split.starved * 100)}% of their time). Keep enough orders in the system to give every set a sublot: ${Math.ceil(sets / (plan.split ?? 1))} at least.`
    }
    if (split.tail > 0.08 && result.shortShare > 0.3) {
      return `${Math.round(result.shortShare * 100)}% of orders came up short of good wafers and needed a top-up run. A top-up is a small sublot that doesn't fill whole rounds of its tools, so tools stood idle (${Math.round(split.tail * 100)}% of their time). Start orders for a lower yield so fewer need one${plan.toolsPerLot >= result.speeds.length && result.speeds.length > 2 ? ', or, where the workgroup can be divided, divide it so a top-up ties up one tool, not the whole fleet' : ''}.`
    }
    if (split.tail > 0.08) {
      return `Tools finished their loads and stood idle while the others finished the sublot (${Math.round(split.tail * 100)}% of their time). A sublot fills its tools evenly only when its size is a multiple of 50 times the tools it uses, and customers' orders are what they are, so change the number of tools, or cut orders into fewer sublots.`
    }
    if ((plan.startFor ?? YIELD.min) <= YIELD.min + 0.005 && result.surplus > 4000) {
      return `Starting every order for the worst yield (69%) makes every order full the first time, but the spare good wafers it made, ${(Math.round(result.surplus / 100) * 100).toLocaleString('en-US')} in all, used tool time that could have shipped more. Start for a better yield and let the few short orders take a top-up.`
    }
    return 'Not enough good wafers shipped: yield averages about 77%, and every order must be full, so the tools have to run close to full all fortnight.'
  }
  if (plan.toolsPerLot === 1) {
    return `Dividing the workgroup keeps every tool busy, but each order now runs on one tool and takes about ${Math.round(holdHours(result))} hours, with ${plan.depth} orders in the system. Customers' orders can't shrink, so when the promise is a short cycle time, dedicate the whole fleet to one order at a time.`
  }
  if (result.shortShare > 0.3 && (plan.startFor ?? YIELD.min) > YIELD.min + 0.005 && holdHours(result) > 0 && result.cycleHours > lotMission(result.speeds).cycleHours * 1.2) {
    return `${Math.round(result.shortShare * 100)}% of orders came up short and waited for a top-up run before they could ship. Start orders for a lower yield so more are full the first time, and keep only as many orders in the system as the tools can run at once.`
  }
  if ((plan.split ?? 1) > 1 && staggerHours(result) > 1) {
    return `An order ships only when its last sublot is done, and sublots started ${Math.round(staggerHours(result))} hours apart on average, so the early ones sat finished and unshippable. Cut orders into sublots only when there are free sets to run them all at once.`
  }
  if (plan.depth > slots) {
    return `Orders waited too long: ${plan.depth - slots} of the ${plan.depth} orders were always waiting for a set. At most ${slots} ${slots === 1 ? 'order' : 'orders'} can be on the tools at once; more only adds waiting and ships nothing extra.`
  }
  if (plan.toolsPerLot >= result.speeds.length) {
    return `With the whole fleet on each order, an order still takes about ${Math.round(holdHours(result))} hours and orders can't be made smaller. Fewer orders in the system, and no top-up runs that hold the fleet for a short time, are what is left to shorten it.`
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
  parts.push(
    `Orders must ship full, so each was started for a ${Math.round((result.plan.startFor ?? YIELD.min) * 100)}% yield. ${Math.round(result.shortShare * 100)}% came up short and needed a top-up run; ${(Math.round(result.surplus / 100) * 100).toLocaleString('en-US')} good wafers beyond the orders were made.`,
  )
  if ((result.plan.split ?? 1) > 1) {
    parts.push(`Each order was cut into ${result.plan.split} sublots, which started ${staggerHours(result) < 0.1 ? 'together' : `${Math.round(staggerHours(result) * 10) / 10} hours apart on average`}. The order shipped only when the last was done.`)
  }
  return parts.join(' ')
}

// What to try next after a run of the hot-order round.
export function hotAdvice(result: LotResult): string {
  const verdict = judgeHot(result)
  if (verdict.passed) return 'Mission done.'
  const { plan, promises, due: DUE } = result
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
    if (plan.toolsPerLot === 1) {
      return `Dividing the workgroup puts each hot order on a single tool: ${hold} hours on its tool alone, ${took} in all. Dedicate the whole fleet to one order at a time and a hot order waits only for the order running, then runs in a fraction of the time.`
    }
    if (plan.toolsPerLot >= result.speeds.length && !plan.reserve) {
      return `Hot orders go first but still wait for the order on the fleet to finish, since nothing interrupts it (${took} hours in all, ${Math.round(promises.hot.onTime * 100)}% on time). Keep fewer orders in the system, and start orders for a lower yield so no top-up run holds the fleet longer.`
    }
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
  const { promises, plan, due: DUE } = result
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
  // Orders shipped, the wafers started for them, and the good wafers shipped (the orders themselves).
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
        wafers += order.started
        good += order.size
        cycle += event.t - order.release
        held -= order.started
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
