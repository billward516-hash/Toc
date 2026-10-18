import type { Factory } from './model.ts'
import { measure, ropeOf, type Measure } from './sim.ts'

// What the rope does for the person's factory, side by side: the line as it runs now, and with the rope,
// both at the yield asked for and with a yield problem.
export interface Side {
  // Share of the time the bottleneck was busy: a rope that is too tight starves it.
  bottleneckBusy: number
  // Orders waiting in front of the bottleneck, on average.
  inFront: number
  // Orders held back at the rope's workgroup, on average (those wait before the line, not in it).
  heldBack: number
  // Share of the time the rope's workgroup was idle.
  feederIdle: number
  // Hours from an order's release into the line to its leaving it, and from its arrival.
  lineCycle: number
  cycle: number
}

export interface RopeStudy {
  bottleneck: string
  feeder: string
  // Yield, in points, the problem case runs at.
  troubledYield: number
  normal: { plain: Side; roped: Side }
  troubled: { plain: Side; roped: Side }
}

function side(m: Measure, bottleneck: number, feeder: number): Side {
  return {
    bottleneckBusy: m.busy[bottleneck],
    inFront: m.waits[bottleneck] / m.meanGap,
    heldBack: m.held / m.meanGap,
    feederIdle: 1 - m.busy[feeder],
    lineCycle: m.cycle - m.held,
    cycle: m.cycle,
  }
}

// Null when the rope has nothing to do: the bottleneck is the first workgroup, so nothing feeds it.
export function ropeStudy(f: Factory): RopeStudy | null {
  const tie = ropeOf({ ...f, rope: { ...f.rope, on: true } })
  if (!tie) return null
  const both = (g: Factory) => ({
    plain: side(measure(g, g.demand, 6, false), tie.bottleneck, tie.at),
    roped: side(measure(g, g.demand, 6, true), tie.bottleneck, tie.at),
  })
  const troubledYield = Math.max(1, f.yieldPct - f.rope.issue)
  return {
    bottleneck: f.steps[tie.bottleneck].name,
    feeder: f.steps[tie.at].name,
    troubledYield,
    normal: both(f),
    troubled: both({ ...f, yieldPct: troubledYield }),
  }
}

const orders = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)))
const pct = (n: number) => `${Math.round(n * 100)}%`
const hours = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)))

// The study in plain words, for the person to read before the numbers.
export function ropeWords(f: Factory, s: RopeStudy): string[] {
  const { plain, roped } = s.troubled
  const lines = [
    `Drum, buffer, rope: ${s.bottleneck} is the drum. The rope idles ${s.feeder} whenever ${f.rope.buffer} ${f.rope.buffer === 1 ? 'order is' : 'orders are'} already waiting in front of ${s.bottleneck}, so ${s.feeder} makes no more than ${s.bottleneck} can use.`,
    `With a yield problem (${s.troubledYield}% instead of ${f.yieldPct}%), about ${orders(plain.inFront)} orders pile up in front of ${s.bottleneck} as it runs now, and about ${orders(roped.inFront)} with the rope. ${s.feeder} sits idle ${pct(roped.feederIdle)} of the time instead of ${pct(plain.feederIdle)}, and ${orders(roped.heldBack)} orders are held back before the line instead of being started.`,
    `Orders spend ${hours(roped.lineCycle)} hours in the line with the rope, against ${hours(plain.lineCycle)} without it, in that yield problem.`,
  ]
  const starved = s.normal.plain.bottleneckBusy - s.normal.roped.bottleneckBusy
  if (starved > 0.03) lines.push(`Careful: with the rope at your yield, ${s.bottleneck} is busy ${pct(s.normal.roped.bottleneckBusy)} of the time instead of ${pct(s.normal.plain.bottleneckBusy)}. The buffer is too small, and the bottleneck is running out of work. Make it bigger.`)
  else lines.push(`At your yield the rope costs ${s.bottleneck} almost nothing: it is busy ${pct(s.normal.roped.bottleneckBusy)} of the time against ${pct(s.normal.plain.bottleneckBusy)}.`)
  if (s.normal.roped.cycle > s.normal.plain.cycle * 1.15) lines.push(`Orders held back wait before the line, so the time from arrival to leaving is longer with the rope (${hours(s.normal.roped.cycle)} against ${hours(s.normal.plain.cycle)} hours). What the rope protects is the work in the line and the units wasted, not the customer's clock.`)
  return lines
}
