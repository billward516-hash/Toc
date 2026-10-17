import { simulate, type SimResult } from '../engine/simulate.ts'
import { labModel, loadShare, workTime, type Upgrades } from './lines.ts'

// What one load did, on one day or on average over many.
export interface Outcome {
  rate: number
  // The share of the bottleneck's capacity the rate asked for.
  load: number
  // Average minutes from order to shipping, for the robots shipped.
  cycle: number
  // Minutes of that cycle spent waiting in a pile rather than being worked on.
  waiting: number
  // Robots in the factory, on average.
  wip: number
  shipped: number
  // Orders still in the factory at the end of the day.
  inside: number
}

export function outcomeOf(minutes: readonly number[], upgraded: Upgrades, rate: number, result: SimResult): Outcome {
  const cycle = result.avgLeadTime ?? 0
  return {
    rate,
    load: loadShare(minutes, upgraded, rate),
    cycle,
    waiting: Math.max(0, cycle - workTime(minutes, upgraded)),
    wip: result.avgWip,
    shipped: result.output,
    inside: result.released - result.output,
  }
}

export function runDay(minutes: readonly number[], upgraded: Upgrades, rate: number, day: number): SimResult {
  return simulate(labModel(minutes, upgraded, rate), day)
}

// The line at each rate, averaged over days 1 to `days`: the curve a single day only samples.
export function loadCurve(minutes: readonly number[], upgraded: Upgrades, rates: readonly number[], days: number): Outcome[] {
  return rates.map((rate) => {
    const each = Array.from({ length: days }, (_, d) => outcomeOf(minutes, upgraded, rate, runDay(minutes, upgraded, rate, d + 1)))
    const mean = (pick: (o: Outcome) => number) => each.reduce((sum, o) => sum + pick(o), 0) / days
    return {
      rate,
      load: loadShare(minutes, upgraded, rate),
      cycle: mean((o) => o.cycle),
      waiting: mean((o) => o.waiting),
      wip: mean((o) => o.wip),
      shipped: mean((o) => o.shipped),
      inside: mean((o) => o.inside),
    }
  })
}
