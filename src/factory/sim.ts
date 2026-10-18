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
  // Orders the average is over.
  orders: number
}

const ORDERS = 320
const WARM = 80

// One run of the factory at `demand` good units a day: ORDERS orders arrive, unevenly, each a size drawn
// between the smallest and largest, and go through the steps in order, waiting their turn at each. The
// first WARM orders, who find an empty factory, are left out of the averages.
export function runFactory(f: Factory, demand: number, seed: number): Measure {
  const spread = SPREAD[f.variation]
  const sizeDraws = stream(seed, 'size')
  const gapDraws = stream(seed, 'arrive')
  const meanGap = meanSize(f) / (demand / 24)
  const arrive: number[] = []
  const units: number[] = []
  let t = 0
  for (let k = 0; k < ORDERS; k++) {
    t += meanGap * (1 - spread.arrival + 2 * spread.arrival * gapDraws())
    arrive.push(t)
    units.push(startsFor(Math.round(f.sizeMin + sizeDraws() * (f.sizeMax - f.sizeMin)), f.yieldPct))
  }
  const release = [...arrive]
  const waits = f.steps.map(() => 0)
  const work = new Array<number>(ORDERS).fill(0)
  let ready = [...arrive]
  f.steps.forEach((step, s) => {
    const draws = stream(seed, `svc:${s}`)
    // Orders in the order they reach this step; with several tools to an order, they can overtake.
    const order = ready.map((_, k) => k).sort((a, b) => ready[a] - ready[b] || a - b)
    const free = new Array<number>(step.divided ? step.tools : 1).fill(0)
    const done = new Array<number>(ORDERS).fill(0)
    for (const k of order) {
      const hours = stepHours(step, units[k]) * (1 - spread.service + 2 * spread.service * draws())
      let server = 0
      for (let m = 1; m < free.length; m++) if (free[m] < free[server]) server = m
      const start = Math.max(ready[k], free[server])
      free[server] = start + hours
      done[k] = start + hours
      if (k >= WARM) {
        waits[s] += start - ready[k]
        work[k] += hours
      }
    }
    ready = done
  })
  const counted = ORDERS - WARM
  let cycle = 0
  let working = 0
  for (let k = WARM; k < ORDERS; k++) {
    cycle += ready[k] - release[k]
    working += work[k]
  }
  cycle /= counted
  working /= counted
  return { cycle, working, waiting: Math.max(0, cycle - working), waits: waits.map((w) => w / counted), wip: cycle / meanGap, orders: counted }
}

// The average of several runs, each with its own luck, so one run doesn't mislead.
export function measure(f: Factory, demand = f.demand, seeds = 6): Measure {
  const runs = Array.from({ length: seeds }, (_, k) => runFactory(f, demand, k + 1))
  const mean = (pick: (m: Measure) => number) => runs.reduce((sum, m) => sum + pick(m), 0) / runs.length
  return {
    cycle: mean((m) => m.cycle),
    working: mean((m) => m.working),
    waiting: mean((m) => m.waiting),
    waits: f.steps.map((_, s) => mean((m) => m.waits[s])),
    wip: mean((m) => m.wip),
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
