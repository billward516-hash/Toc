import type { Factory } from './model.ts'
import { LIMITS } from './model.ts'
import { analyze, measure } from './sim.ts'

// What one workgroup would have to do for the factory to make the output wanted: how many more units an
// hour each of its tools must make, or how many more tools it needs, to just keep up with the demand, and
// to keep up and still meet the cycle time wanted.
export interface Gain {
  // Units an hour per tool needed, and the change from now (negative when it already has more than enough).
  rate: number
  more: number
  // The change as a share of the rate now.
  share: number
}

export interface Need {
  step: number
  name: string
  rate: number
  // To just keep up with the demand (busy all the time, so the cycle time can still be long).
  output: Gain
  // To keep up and meet the cycle time wanted; null when improving this workgroup alone cannot do it.
  cycle: Gain | null
  // When no rate does it, the workgroup that would hold the line back however fast this one is.
  limitedBy: string | null
  // The same as tools at the rate it has now: to keep up, and to meet the cycle time wanted (null if no number of
  // tools does it).
  tools: { output: number; cycle: number | null }
}

const withRate = (f: Factory, step: number, rate: number): Factory => ({ ...f, steps: f.steps.map((s, i) => (i === step ? { ...s, rate } : s)) })
const withTools = (f: Factory, step: number, tools: number): Factory => ({ ...f, steps: f.steps.map((s, i) => (i === step ? { ...s, tools } : s)) })

const gain = (now: number, rate: number): Gain => ({ rate, more: rate - now, share: rate / now - 1 })

const meets = (f: Factory) => !analyze(f).overloaded && measure(f, f.demand, 6).cycle <= f.target

// The most a rate is tried at, as a multiple of the rate now.
const BEST = 20

export function need(f: Factory, step: number): Need {
  const now = f.steps[step].rate
  const a = analyze(f)
  // A step's speed is its rate over its busy share, so the rate to keep up is the rate now times that share.
  const keepUp = Math.max(LIMITS.rate.min, now * a.steps[step].utilization)
  // Meeting the cycle time needs at least what keeping up needs, so look from there to a best rate.
  let cycle: Gain | null = null
  const top = Math.min(LIMITS.rate.max, Math.max(keepUp, now) * BEST)
  if (meets(withRate(f, step, top))) {
    let low = keepUp
    let high = top
    if (meets(withRate(f, step, low))) high = low
    else
      for (let i = 0; i < 14; i++) {
        const mid = (low + high) / 2
        if (meets(withRate(f, step, mid))) high = mid
        else low = mid
      }
    cycle = gain(now, high)
  }
  let limitedBy: string | null = null
  if (!cycle) {
    const fast = analyze(withRate(f, step, top))
    const worst = fast.steps.reduce((best, s, i) => (s.utilization > fast.steps[best].utilization ? i : best), 0)
    limitedBy = worst === step ? null : fast.steps[worst].name
  }
  let toolsOutput = f.steps[step].tools
  while (toolsOutput < LIMITS.tools.max && analyze(withTools(f, step, toolsOutput)).steps[step].utilization > 1) toolsOutput++
  let toolsCycle: number | null = null
  for (let t = toolsOutput; t <= Math.min(LIMITS.tools.max, toolsOutput + 30); t++) {
    if (meets(withTools(f, step, t))) {
      toolsCycle = t
      break
    }
  }
  return { step, name: f.steps[step].name, rate: now, output: gain(now, keepUp), cycle, limitedBy, tools: { output: toolsOutput, cycle: toolsCycle } }
}

// A workgroup trying a rate: what the line then makes and how long an order takes.
export interface Trial {
  capacity: number
  // How busy the tried workgroup is, the workgroup that is busiest then, and how busy.
  busy: number
  next: { name: string; busy: number }
  cycle: number
  keepsUp: boolean
  meetsCycle: boolean
}

export function tryRate(f: Factory, step: number, rate: number): Trial {
  const g = withRate(f, step, rate)
  const a = analyze(g)
  const m = measure(g, g.demand, 6)
  const busiest = a.steps.reduce((best, s, i) => (s.utilization > a.steps[best].utilization ? i : best), 0)
  return {
    capacity: a.capacity,
    busy: a.steps[step].utilization,
    next: { name: a.steps[busiest].name, busy: a.steps[busiest].utilization },
    cycle: m.cycle,
    keepsUp: !a.overloaded,
    meetsCycle: !a.overloaded && m.cycle <= g.target,
  }
}
