import type { Factory } from './model.ts'
import type { Analysis, Measure, Reach, WhatIf } from './sim.ts'

// What the numbers mean, in plain words, for the person looking at their factory.
export interface Verdict {
  tone: 'ok' | 'warn' | 'bad'
  headline: string
  lines: string[]
}

const hours = (h: number) => (h < 10 ? h.toFixed(1) : String(Math.round(h)))
const units = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (x: number) => `${Math.round(x * 100)}%`

export function verdict(f: Factory, a: Analysis, m: Measure, r: Reach, tries: WhatIf[]): Verdict {
  const lines: string[] = []
  const names = a.bottlenecks.map((i) => a.steps[i].name)
  const slow = a.steps[a.bottleneck]
  if (a.bottlenecks.length > 1) {
    lines.push(
      `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are all about as slow, ${pct(slow.utilization)} busy or close to it. With several bottlenecks, orders wait in front of each of them, and a delay at one shows up at the next.`,
    )
  } else {
    lines.push(`${slow.name} is the bottleneck: ${pct(slow.utilization)} busy. It limits the factory to about ${units(a.capacity)} good units a day, and you ask for ${units(f.demand)}.`)
  }
  if (a.overloaded) {
    lines.push(
      `You ask for more than ${slow.name} can make, so orders pile up in front of it without end, and the longer it runs the longer an order takes. The ${hours(m.cycle)} hours shown is only for the first few hundred orders.`,
    )
  } else {
    lines.push(`An order takes about ${hours(m.cycle)} hours: ${hours(m.working)} being worked on and ${hours(m.waiting)} waiting in piles. You wanted ${hours(f.target)}.`)
    const longest = m.waits.indexOf(Math.max(...m.waits))
    if (m.waiting > 0.1 * m.cycle) lines.push(`The longest wait is in front of ${a.steps[longest].name}: about ${hours(m.waits[longest])} hours.`)
  }
  if (r.demand === null) {
    lines.push(
      `Even a nearly empty factory takes ${hours(r.floor)} hours to make an order, which is more than the ${hours(f.target)} you want. The work itself is too slow: add tools where orders spend most of their time, or ask whether a smaller batch would do.`,
    )
  } else {
    lines.push(`Cycle time stays within ${hours(f.target)} hours up to about ${units(r.demand)} good units a day, ${pct(r.load ?? 0)} of what the factory can make. Past that, it climbs steeply: that is the knee.`)
  }
  const best = tries.reduce((x, y) => (y.saved > x.saved ? y : x), tries[0])
  if (best && best.saved > 0.05 * Math.max(1, m.cycle)) {
    lines.push(`One more tool at ${a.steps[best.step].name} would take about ${hours(best.saved)} hours off an order and lift capacity to ${units(best.capacity)} units a day.`)
  } else if (best) {
    const step = f.steps[a.bottleneck]
    lines.push(
      `One more tool anywhere saves little. ${step.divided || step.load <= 1 ? '' : `At ${slow.name} a run takes ${step.load} units a tool, so a tool helps only when it saves a whole round for orders this size.`}`.trim(),
    )
  }
  const meets = !a.overloaded && m.cycle <= f.target
  const close = !a.overloaded && m.cycle <= f.target * 1.15
  return {
    tone: meets ? 'ok' : close ? 'warn' : 'bad',
    headline: meets
      ? `On target: ${hours(m.cycle)} h against the ${hours(f.target)} h you want`
      : a.overloaded
        ? `Over capacity: ${slow.name} can't keep up`
        : `Too slow: ${hours(m.cycle)} h against the ${hours(f.target)} h you want`,
    lines,
  }
}
