import type { SimResult } from '../engine/simulate.ts'
import { leadTimeSoFar, steadyShare, type Shop, type Snapshot } from '../engine/timeline.ts'
import { readBar, rushOnTime, type Reading } from '../levels/graph.ts'
import type { Bar, Goal } from '../levels/types.ts'
import { tenths } from '../levels/values.ts'
import type { Stat } from './parts.tsx'

export type BarsGoal = Extract<Goal, { kind: 'bars' }>

// Words for what a line makes and uses, for the texts below.
export interface Words {
  // What one unit of work is called, plural: "robots".
  unit: string
  material: string
  // A product's name, plural and lower case: "deluxe robots".
  products: (id: string) => string
}

const percent = (share: number) => `${Math.floor(100 * share)}%`
const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`
const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`

// What each bar asks, as a star goal.
export function goalText(bar: Bar, words: Words): string {
  switch (bar.metric) {
    case 'shipped':
      return `Ship at least ${bar.min} a shift`
    case 'shippedOf':
      return `Ship at least ${bar.min} ${words.products(bar.product)} a shift`
    case 'steady':
      return `Keep it steady: no pile of ${bar.pileLimit} or more for ${percent(bar.min)} of the shift`
    case 'leadTime':
      return `Get each order out in ${bar.max} minutes or less, on average`
    case 'wip':
      return `Keep ${bar.max} or less in process, on average`
    case 'stock':
      return `Keep ${bar.max} ${words.material} or less in the stockroom, on average`
    case 'scrapped':
      return bar.max === 0 ? 'Scrap nothing' : `Scrap ${bar.max} or fewer a shift`
    case 'rushOnTime':
      return `Ship every rush order by ${clock(bar.due)}`
    case 'spend':
      return bar.max === 0 ? 'Spend nothing' : `Spend ${dollars(bar.max)} or less`
    case 'lost':
      return bar.max === 0 ? 'Turn no customer away' : `Turn away ${bar.max} or fewer customers a day`
    case 'waste':
      return bar.max === 0 ? 'Throw nothing out' : `Throw out ${bar.max} or fewer a day`
  }
}

// One day's reading, short enough for a day card.
export function readingText(bar: Bar, reading: Reading, day: SimResult, words: Words): string {
  switch (bar.metric) {
    case 'shipped':
      return `${reading.value} shipped`
    case 'shippedOf':
      return `${reading.value} ${words.products(bar.product)}`
    case 'steady':
      return `${percent(reading.value)} steady`
    case 'leadTime':
      return Number.isFinite(reading.value) ? `${Math.round(reading.value)} min` : 'none shipped'
    case 'wip':
      return `${tenths(reading.value)} in process`
    case 'stock':
      return `${Math.round(reading.value)} ${words.material}`
    case 'scrapped':
      return `${reading.value} scrapped`
    case 'rushOnTime':
      return `${reading.value} of ${day.rush?.length ?? 0} rush on time`
    case 'spend':
      return `${dollars(reading.value)} spent`
    case 'lost':
      return `${reading.value} turned away`
    case 'waste':
      return `${reading.value} thrown out`
  }
}

// How a bar did across the days, as a checklist row.
export function rowText(bar: Bar, met: number, total: number, reading: Reading, words: Words): string {
  const days = `on ${met} of ${total} days`
  switch (bar.metric) {
    case 'shipped':
      return `Shipped at least ${bar.min} ${days}`
    case 'shippedOf':
      return `Shipped at least ${bar.min} ${words.products(bar.product)} ${days}`
    case 'steady':
      return `Steady ${days}`
    case 'leadTime':
      return `Orders out in ${bar.max} minutes or less, on average, ${days}`
    case 'wip':
      return `${bar.max} or less in process, on average, ${days}`
    case 'stock':
      return `${bar.max} ${words.material} or less in the stockroom, on average, ${days}`
    case 'scrapped':
      return bar.max === 0 ? `Scrapped nothing ${days}` : `Scrapped ${bar.max} or fewer ${days}`
    case 'rushOnTime':
      return `Every rush order out by ${clock(bar.due)} ${days}`
    case 'spend':
      return `Spent ${dollars(reading.value)} (limit ${dollars(bar.max)})`
    case 'lost':
      return bar.max === 0 ? `Turned no customer away ${days}` : `Turned away ${bar.max} or fewer ${days}`
    case 'waste':
      return bar.max === 0 ? `Threw nothing out ${days}` : `Threw out ${bar.max} or fewer ${days}`
  }
}

// What a bar measures, as a label, and the goal line to draw across the days.
export function barMeasure(bar: Bar, words: Words, day: SimResult): { label: string; goal: number; atLeast: boolean; format: (value: number) => string } {
  const whole = (value: number) => String(Math.round(value))
  switch (bar.metric) {
    case 'shipped':
      return { label: 'Shipped', goal: bar.min, atLeast: true, format: whole }
    case 'shippedOf':
      return { label: capitalize(words.products(bar.product)), goal: bar.min, atLeast: true, format: whole }
    case 'steady':
      return { label: 'Steady', goal: bar.min, atLeast: true, format: percent }
    case 'leadTime':
      return { label: 'Lead time', goal: bar.max, atLeast: false, format: (value) => `${Math.round(value)} min` }
    case 'wip':
      return { label: 'In process', goal: bar.max, atLeast: false, format: (value) => String(tenths(value)) }
    case 'stock':
      return { label: `${capitalize(words.material)} on hand`, goal: bar.max, atLeast: false, format: whole }
    case 'scrapped':
      return { label: 'Scrapped', goal: bar.max, atLeast: false, format: whole }
    case 'rushOnTime':
      return { label: `Rush orders out by ${clock(bar.due)}`, goal: day.rush?.length ?? 0, atLeast: true, format: whole }
    case 'spend':
      return { label: 'Spent', goal: bar.max, atLeast: false, format: dollars }
    case 'lost':
      return { label: 'Turned away', goal: bar.max, atLeast: false, format: whole }
    case 'waste':
      return { label: 'Thrown out', goal: bar.max, atLeast: false, format: whole }
  }
}

// The live dashboard for a bars level: shipped first, then what each bar watches.
export function barStats(goal: BarsGoal, result: SimResult, snapshot: Snapshot, words: Words, spend: number): Stat[] {
  if (snapshot.shop) return shopStats(result, snapshot.shop, snapshot.t)
  const stats: Stat[] = [{ label: 'Shipped', value: snapshot.shipped }]
  for (const bar of goal.bars) {
    if (bar.metric === 'shippedOf') stats.push({ label: capitalize(words.products(bar.product)), value: snapshot.shippedBy?.[bar.product] ?? 0 })
    if (bar.metric === 'steady') stats.push({ label: 'Steady', value: percent(steadyShare(result, bar.pileLimit, snapshot.t)) })
    if (bar.metric === 'stock') stats.push({ label: capitalize(words.material), value: snapshot.stock ?? 0 })
    if (bar.metric === 'scrapped') stats.push({ label: 'Scrapped', value: snapshot.scrapped.reduce((a, b) => a + b, 0) })
    if (bar.metric === 'leadTime') {
      const lead = leadTimeSoFar(result, snapshot.t)
      stats.push({ label: 'Lead time', value: lead === null ? '–' : `${Math.round(lead)} min` })
    }
    if (bar.metric === 'rushOnTime') stats.push({ label: 'Rush shipped', value: `${rushOnTime(result, snapshot.t)} of ${result.rush?.length ?? 0}` })
    if (bar.metric === 'spend') stats.push({ label: 'Spent', value: dollars(spend) })
  }
  stats.push({ label: 'In process', value: snapshot.released - snapshot.shipped - snapshot.scrapped.reduce((a, b) => a + b, 0) })
  const shipped = goal.bars.find((bar) => bar.metric === 'shipped')
  if (shipped?.metric === 'shipped') stats.push({ label: 'Goal', value: shipped.min })
  return stats
}

// The shop counter's day so far; what's thrown out shows once the shift is over.
export function shopStats(result: SimResult, shop: Shop, t: number): Stat[] {
  const stats: Stat[] = [
    { label: 'Sold', value: shop.sold },
    { label: 'Turned away', value: shop.lost },
    { label: 'On the shelf', value: shop.shelf },
  ]
  if (t >= result.horizon && result.market) stats.push({ label: 'Thrown out', value: result.market.waste })
  return stats
}

export function barsHint(goal: BarsGoal, baseline: SimResult, words: Words): string {
  const { market } = baseline
  const facts = market
    ? [
        `Today ${market.customers} customers come in: the shop sells ${market.sold} ${words.unit}, turns ${market.lost > 0 ? customers(market.lost) : 'no one'} away, and throws ${market.waste > 0 ? `out ${market.waste}` : 'none out'}`,
      ]
    : [`Today the factory ships ${baseline.output} a shift`]
  for (const bar of goal.bars) {
    if (bar.metric === 'shippedOf') facts.push(`${baseline.shippedBy?.[bar.product] ?? 0} of them ${words.products(bar.product)}`)
    if (bar.metric === 'steady') facts.push(`it's steady ${percent(steadyShare(baseline, bar.pileLimit))} of the time`)
    if (bar.metric === 'stock') facts.push(`it keeps about ${Math.round(baseline.supply?.avgStock ?? 0)} ${words.material} in the stockroom`)
    if (bar.metric === 'scrapped') facts.push(`it scraps ${baseline.scrapped ?? 0}`)
    if (bar.metric === 'rushOnTime') facts.push(`${rushOnTime(baseline, bar.due)} of ${baseline.rush?.length ?? 0} rush orders ship on time`)
  }
  const joined = facts.length > 1 ? `${facts.slice(0, -1).join(', ')}, and ${facts.at(-1)}` : facts[0]
  const days = goal.freshDays > 0 ? ` Your plan runs for ${goal.freshDays + 1} days.` : ''
  return `${joined}.${days}`
}

export function barsOutcome(goal: BarsGoal, result: SimResult, words: Words, spend: number): string {
  const readings = goal.bars.map((bar) => readingText(bar, readBar(bar, result, spend), result, words))
  return `Today: ${readings.join(', ')}.`
}

export function barsResultStats(goal: BarsGoal, result: SimResult, baseline: SimResult, words: Words, spend: number): Stat[] {
  const stats: Stat[] = goal.bars.slice(0, 3).map((bar) => {
    const { value } = readBar(bar, result, spend)
    switch (bar.metric) {
      case 'shipped':
        return { label: 'Shipped', value, detail: `goal ${bar.min}` }
      case 'shippedOf':
        return { label: capitalize(words.products(bar.product)), value, detail: `goal ${bar.min}` }
      case 'steady':
        return { label: 'Steady', value: percent(value), detail: `goal ${percent(bar.min)}` }
      case 'leadTime':
        return { label: 'Lead time, min', value: Number.isFinite(value) ? Math.round(value) : '–', detail: `goal ${bar.max} or less` }
      case 'wip':
        return { label: 'In process', value: tenths(value), detail: `limit ${bar.max}` }
      case 'stock':
        return { label: `${capitalize(words.material)} on hand`, value: Math.round(value), detail: `limit ${bar.max}` }
      case 'scrapped':
        return { label: 'Scrapped', value, detail: `limit ${bar.max}` }
      case 'rushOnTime':
        return { label: 'Rush on time', value: `${value}/${result.rush?.length ?? 0}`, detail: `by ${clock(bar.due)}` }
      case 'spend':
        return { label: 'Spent', value: dollars(value), detail: `limit ${dollars(bar.max)}` }
      case 'lost':
        return { label: 'Turned away', value, detail: `limit ${bar.max}` }
      case 'waste':
        return { label: 'Thrown out', value, detail: `limit ${bar.max}` }
    }
  })
  if (stats.length < 3 && result.market) stats.push({ label: 'Sold', value: result.market.sold, detail: `of ${result.market.customers} customers` })
  else if (stats.length < 3) stats.push({ label: 'Before', value: baseline.output, detail: 'shipped' })
  return stats
}

export function customers(count: number): string {
  return `${count} ${count === 1 ? 'customer' : 'customers'}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}
