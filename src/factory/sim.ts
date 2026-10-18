import { stream } from '../engine/random.ts'
import { meanSize, SPREAD, type Factory, type Step } from './model.ts'

// The units an order of `size` good units needs started, so that `yieldPct` of them come out good.
export const startsFor = (size: number, yieldPct: number): number => Math.ceil(size / (yieldPct / 100))

// Hours one order of `units` takes at a step, with nothing in its way: the runs it needs, a run taking
// load / rate hours however full it is. With the whole fleet on the order the runs are shared among the
// tools; with the workgroup divided, the order is on one tool.
export function stepHours(step: Step, units: number): number {
  const runs = step.divided ? Math.ceil(units / step.load - 1e-9) : Math.ceil(units / (step.tools * step.load) - 1e-9)
  return runs * (step.load / step.rate)
}

// Units an hour a step can really make on orders of `units`: its tools' pace, less what part-full runs
// waste. A divided workgroup runs an order on each tool at once.
export function effectiveRate(step: Step, units: number): number {
  const hours = stepHours(step, units)
  return (step.divided ? step.tools * units : units) / hours
}

export interface StepAnalysis {
  name: string
  // Units an hour on paper, with every tool running full loads all the time, and with your orders' sizes.
  paper: number
  effective: number
  // Share of the step's time the demand keeps it busy: over 100% and work piles up without end.
  utilization: number
  bottleneck: boolean
}

export interface Analysis {
  steps: StepAnalysis[]
  // Good units a day the whole factory can make, and the demand as a share of it.
  capacity: number
  load: number
  // The bottleneck step, and the steps about as slow as it.
  bottleneck: number
  bottlenecks: number[]
  overloaded: boolean
  // Hours of work in one average order from first step to last, with no waiting.
  workHours: number
}

// How close to the slowest a step must be to count as a bottleneck too.
export const NEAR = 0.1

export function analyze(f: Factory): Analysis {
  const units = startsFor(meanSize(f), f.yieldPct)
  const startsPerHour = (f.demand / 24) / (f.yieldPct / 100)
  const steps = f.steps.map((step): StepAnalysis => {
    const effective = effectiveRate(step, units)
    return { name: step.name, paper: step.tools * step.rate, effective, utilization: startsPerHour / effective, bottleneck: false }
  })
  const top = Math.max(...steps.map((s) => s.utilization))
  const bottlenecks = steps.flatMap((s, i) => (s.utilization >= top * (1 - NEAR) ? [i] : []))
  for (const i of bottlenecks) steps[i].bottleneck = true
  const slowest = Math.min(...steps.map((s) => s.effective))
  const capacity = slowest * (f.yieldPct / 100) * 24
  return {
    steps,
    capacity,
    load: f.demand / capacity,
    bottleneck: steps.findIndex((s) => s.utilization === top),
    bottlenecks,
    overloaded: top > 1,
    workHours: f.steps.reduce((sum, step) => sum + stepHours(step, units), 0),
  }
}

export interface Measure {
  // Average hours from an order's arrival to its leaving the last step.
  cycle: number
  // Hours of that spent being worked on, and waiting.
  working: number
  waiting: number
  // Average hours an order waits in front of each step.
  waits: number[]
  // Orders in the factory, on average (Little's law).
  wip: number
  // Hours an order was held back by the rope, on average (0 with no rope), how busy each step was, and the
  // hours between orders arriving.
  held: number
  busy: number[]
  meanGap: number
  // Orders the average is over.
  orders: number
}

const ORDERS = 320
const WARM = 80

// The whole of one run, order by order: when each arrived, its units started, and for every step when it
// reached the step, when it began there, when it left, and on which tool. With the rope on, `held` is the
// hours each order was held back at the rope's workgroup, which is part of its wait there.
export interface Schedule {
  arrive: number[]
  units: number[]
  ready: number[][]
  start: number[][]
  done: number[][]
  tool: number[][]
  held: number[]
  // The workgroup the rope idles, or null with no rope.
  ropeAt: number | null
}

// The workgroup the rope is tied to: the first bottleneck, and the workgroup that idles for it, which must
// come before it. Null when there is none to idle (the bottleneck is first, or the rope is off).
export function ropeOf(f: Factory): { at: number; bottleneck: number } | null {
  if (!f.rope.on) return null
  const bottleneck = Math.min(...analyze(f).bottlenecks)
  if (bottleneck === 0) return null
  return { at: Math.min(f.rope.at, bottleneck - 1), bottleneck }
}

// `orders` orders arrive, unevenly, at `demand` good units a day, each a size drawn between the smallest
// and largest, and go through the steps in order, waiting their turn at each. With `rope`, the rope's
// workgroup starts an order only once the order `buffer` places ahead of it has started at the bottleneck.
export function schedule(f: Factory, demand: number, seed: number, orders = ORDERS, rope = false): Schedule {
  const spread = SPREAD[f.variation]
  const sizeDraws = stream(seed, 'size')
  const gapDraws = stream(seed, 'arrive')
  const meanGap = meanSize(f) / (demand / 24)
  const arrive: number[] = []
  const units: number[] = []
  let t = 0
  for (let k = 0; k < orders; k++) {
    t += meanGap * (1 - spread.arrival + 2 * spread.arrival * gapDraws())
    arrive.push(t)
    units.push(startsFor(Math.round(f.sizeMin + sizeDraws() * (f.sizeMax - f.sizeMin)), f.yieldPct))
  }
  const tie = rope ? ropeOf({ ...f, rope: { ...f.rope, on: true } }) : null
  const out: Schedule = { arrive, units, ready: [], start: [], done: [], tool: [], held: new Array<number>(orders).fill(0), ropeAt: tie?.at ?? null }
  const grid = () => f.steps.map(() => new Array<number>(orders).fill(0))
  if (tie) {
    // Order by order, since the rope ties an order to ones ahead of it at a later step.
    out.ready = grid()
    out.start = grid()
    out.done = grid()
    out.tool = grid()
    const draws = f.steps.map((_, s) => stream(seed, `svc:${s}`))
    const free = f.steps.map((step) => new Array<number>(step.divided ? step.tools : 1).fill(0))
    for (let k = 0; k < orders; k++) {
      let at = arrive[k]
      f.steps.forEach((step, s) => {
        out.ready[s][k] = at
        let allowed = at
        if (s === tie.at && k >= f.rope.buffer) allowed = Math.max(at, out.start[tie.bottleneck][k - f.rope.buffer])
        if (s === tie.at) out.held[k] = allowed - at
        const hours = stepHours(step, units[k]) * (1 - spread.service + 2 * spread.service * draws[s]())
        let server = 0
        for (let m = 1; m < free[s].length; m++) if (free[s][m] < free[s][server]) server = m
        const begin = Math.max(allowed, free[s][server])
        free[s][server] = begin + hours
        out.start[s][k] = begin
        out.done[s][k] = begin + hours
        out.tool[s][k] = server
        at = begin + hours
      })
    }
    return out
  }
  let ready = [...arrive]
  f.steps.forEach((step, s) => {
    const draws = stream(seed, `svc:${s}`)
    // Orders in the order they reach this step; with several tools to an order, they can overtake.
    const order = ready.map((_, k) => k).sort((a, b) => ready[a] - ready[b] || a - b)
    const free = new Array<number>(step.divided ? step.tools : 1).fill(0)
    const start = new Array<number>(orders).fill(0)
    const done = new Array<number>(orders).fill(0)
    const tool = new Array<number>(orders).fill(0)
    for (const k of order) {
      const hours = stepHours(step, units[k]) * (1 - spread.service + 2 * spread.service * draws())
      let server = 0
      for (let m = 1; m < free.length; m++) if (free[m] < free[server]) server = m
      start[k] = Math.max(ready[k], free[server])
      free[server] = start[k] + hours
      done[k] = start[k] + hours
      tool[k] = server
    }
    out.ready.push(ready)
    out.start.push(start)
    out.done.push(done)
    out.tool.push(tool)
    ready = done
  })
  return out
}

// One run of the factory at `demand` good units a day, ORDERS orders long. The first WARM orders, who find
// an empty factory, are left out of the averages.
export function runFactory(f: Factory, demand: number, seed: number, rope = false): Measure {
  const run = schedule(f, demand, seed, ORDERS, rope)
  const meanGap = meanSize(f) / (demand / 24)
  const last = f.steps.length - 1
  const waits = f.steps.map(() => 0)
  let cycle = 0
  let working = 0
  let held = 0
  for (let k = WARM; k < ORDERS; k++) {
    f.steps.forEach((_, s) => {
      waits[s] += run.start[s][k] - run.ready[s][k] - (s === run.ropeAt ? run.held[k] : 0)
      working += run.done[s][k] - run.start[s][k]
    })
    cycle += run.done[last][k] - run.arrive[k]
    held += run.held[k]
  }
  const counted = ORDERS - WARM
  cycle /= counted
  working /= counted
  held /= counted
  // How busy a step was over the time the counted orders were in it, as a share of its tools' time.
  const busy = (s: number) => {
    let work = 0
    let first = Infinity
    let finish = 0
    for (let k = WARM; k < ORDERS; k++) {
      work += run.done[s][k] - run.start[s][k]
      first = Math.min(first, run.start[s][k])
      finish = Math.max(finish, run.done[s][k])
    }
    return Math.min(1, work / ((finish - first) * (f.steps[s].divided ? f.steps[s].tools : 1)))
  }
  return {
    cycle,
    working,
    waiting: Math.max(0, cycle - working - held),
    waits: waits.map((w) => w / counted),
    wip: cycle / meanGap,
    orders: counted,
    held,
    busy: f.steps.map((_, s) => busy(s)),
    meanGap,
  }
}

// The average of several runs, each with its own luck, so one run doesn't mislead.
export function measure(f: Factory, demand = f.demand, seeds = 6, rope = false): Measure {
  const runs = Array.from({ length: seeds }, (_, k) => runFactory(f, demand, k + 1, rope))
  const mean = (pick: (m: Measure) => number) => runs.reduce((sum, m) => sum + pick(m), 0) / runs.length
  return {
    cycle: mean((m) => m.cycle),
    working: mean((m) => m.working),
    waiting: mean((m) => m.waiting),
    waits: f.steps.map((_, s) => mean((m) => m.waits[s])),
    wip: mean((m) => m.wip),
    held: mean((m) => m.held),
    busy: f.steps.map((_, s) => mean((m) => m.busy[s])),
    meanGap: runs[0].meanGap,
    orders: runs[0].orders,
  }
}

export interface CurvePoint {
  // The demand as a share of what the factory can make, and in good units a day.
  load: number
  demand: number
  cycle: number
}

// Cycle time at a range of demands, up to a little past what the factory can make.
export function curve(f: Factory, capacity = analyze(f).capacity): CurvePoint[] {
  const loads = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.96, 0.99, 1.03, 1.08, 1.15]
  return loads.map((load) => ({ load, demand: load * capacity, cycle: measure(f, load * capacity, 4).cycle }))
}

export interface Reach {
  // The most good units a day that still meets the desired cycle time, and its share of capacity; null
  // when even a nearly empty factory takes longer than wanted.
  demand: number | null
  load: number | null
  // Hours an order takes with next to nothing in its way.
  floor: number
}

// How much demand the factory can take and still meet the desired cycle time.
export function reach(f: Factory, capacity = analyze(f).capacity): Reach {
  const floor = measure(f, 0.05 * capacity, 3).cycle
  if (floor > f.target) return { demand: null, load: null, floor }
  let low = 0.05
  let high = 0.995
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2
    if (measure(f, mid * capacity, 4).cycle <= f.target) low = mid
    else high = mid
  }
  return { demand: low * capacity, load: low, floor }
}

export interface WhatIf {
  step: number
  // The step with one more tool: what the factory can then make, and its cycle time at the current demand.
  capacity: number
  cycle: number
  // Hours saved against now (negative if slower).
  saved: number
}

// What one more tool at each step would do, so the one that helps shows.
export function whatIf(f: Factory, now: Measure = measure(f)): WhatIf[] {
  return f.steps.map((_, i) => {
    const more: Factory = { ...f, steps: f.steps.map((s, k) => (k === i ? { ...s, tools: s.tools + 1 } : s)) }
    const cycle = measure(more).cycle
    return { step: i, capacity: analyze(more).capacity, cycle, saved: now.cycle - cycle }
  })
}
