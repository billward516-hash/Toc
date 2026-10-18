import { periodDays, periodName, type Factory } from './model.ts'
import { analyze, measure, reach } from './sim.ts'

// The factory looked at three ways for each of two things that change: how much is asked of it, and how
// big the orders are. Each way is a too low, a midpoint, and a too high.
export type Spot = 'Too low' | 'Midpoint' | 'Too high'

export interface Case {
  group: 'Demand' | 'Batch size'
  spot: Spot
  // Good units a day asked for, and the batch size (smallest and largest) in this case.
  demand: number
  sizeMin: number
  sizeMax: number
  bottleneck: string
  load: number
  cycle: number
  waiting: number
  meets: boolean
  overloaded: boolean
}

const SPOTS: Spot[] = ['Too low', 'Midpoint', 'Too high']

function look(f: Factory, group: Case['group'], spot: Spot): Case {
  const a = analyze(f)
  const m = measure(f)
  return {
    group,
    spot,
    demand: f.demand,
    sizeMin: f.sizeMin,
    sizeMax: f.sizeMax,
    bottleneck: a.bottlenecks.map((i) => a.steps[i].name).join(' and '),
    load: a.load,
    cycle: m.cycle,
    waiting: m.waiting,
    meets: !a.overloaded && m.cycle <= f.target,
    overloaded: a.overloaded,
  }
}

// Demand: the midpoint is just inside the most the factory can take and still meet the cycle time wanted (or
// four fifths of what it can make when it cannot meet it at all), too low is half of that, and too high is
// nearly all it can make, past the knee. Batch size: the smallest, the middle, and the largest, at the
// demand asked for.
export function cases(f: Factory): Case[] {
  const a = analyze(f)
  const mid = 0.95 * (reach(f, a.capacity).demand ?? 0.84 * a.capacity)
  const high = mid < 0.97 * a.capacity ? 0.97 * a.capacity : 1.05 * a.capacity
  const demands = [0.5 * mid, mid, high]
  const middle = Math.max(f.sizeMin, Math.round((f.sizeMin + f.sizeMax) / 2))
  const sizes = [f.sizeMin, middle, f.sizeMax]
  return [
    ...SPOTS.map((spot, i) => look({ ...f, demand: demands[i] }, 'Demand', spot)),
    ...SPOTS.map((spot, i) => look({ ...f, sizeMin: sizes[i], sizeMax: sizes[i] }, 'Batch size', spot)),
  ]
}

const round = (n: number, digits = 0) => Number(n.toFixed(digits))

// The cases as rows of text, with the units counted the way the person counts them (a day or a week).
export function rows(f: Factory, list: Case[]): string[][] {
  const days = periodDays(f)
  return [
    ['Changes', 'Case', `Good units a ${periodName(f)}`, 'Batch size', 'Bottleneck', 'Load (%)', 'Cycle time (h)', 'Waiting (h)', `Meets ${round(f.target, 1)} h`],
    ...list.map((c) => [
      c.group,
      c.spot,
      String(round(c.demand * days)),
      c.sizeMin === c.sizeMax ? String(c.sizeMin) : `${c.sizeMin} to ${c.sizeMax}`,
      c.bottleneck,
      String(round(c.load * 100)),
      c.overloaded ? 'no end' : String(round(c.cycle, 1)),
      c.overloaded ? 'no end' : String(round(c.waiting, 1)),
      c.meets ? 'yes' : 'no',
    ]),
  ]
}

const quote = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)

export const csv = (f: Factory, list: Case[]): string => rows(f, list).map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n'
