import type { FactoryModel } from '../engine/model.ts'
import type { SimEvent, SimResult } from '../engine/simulate.ts'
import { bufferZones } from '../engine/timeline.ts'
import { customers } from './barTexts.ts'
import type { IconName } from './icons.tsx'

export interface LogEntry {
  at: number
  icon: IconName
  text: string
  detail?: string
  tone: 'bad' | 'warn' | 'info'
}

export const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`

// Whether any station on the line can break down, on its own or in an incident.
function breaksDown(model: FactoryModel): boolean {
  return Boolean(model.incidents?.length || model.stations.some((s) => s.outages?.length))
}

// What a red light means on this line: jams, breakdowns, or named incidents such as a power cut.
export function haltLabels(model: FactoryModel): string[] {
  const labels = new Set<string>()
  if (model.stations.some((s) => s.jams)) labels.add('Jammed')
  if (model.stations.some((s) => s.outages?.length)) labels.add('Broken down')
  for (const incident of model.incidents ?? []) labels.add(incident.name ?? 'Broken down')
  return [...labels]
}

// Why stations stand idle on purpose, other than breaks: "No operator", "Maintenance".
export function stopReasons(model: FactoryModel): string[] {
  return [...new Set(model.stations.flatMap((s) => (s.breaks ?? []).flatMap((b) => (b.reason ? [b.reason] : []))))]
}

// Whether anything on this line can go wrong mid-shift, for pausing at problems.
export function canGoWrong(model: FactoryModel): boolean {
  return Boolean(breaksDown(model) || model.supply || model.market)
}

// Whether a line has anything for the shift log to report.
export function hasDisruptions(model: FactoryModel): boolean {
  return Boolean(
    breaksDown(model) ||
      model.supply ||
      model.rush?.length ||
      model.mixChanges?.length ||
      model.market ||
      model.stations.some((s) => s.priorityChanges?.length || s.inspects || s.changeoverScrap || s.breaks?.some((b) => b.reason)),
  )
}

// Every disruption up to minute `t` of the shown run: breakdowns and named incidents such as a power
// cut, stops for a reason such as a missing operator, deliveries (and trucks running late), rush orders,
// changes to the orders, scrap and rework so far, and at a shop counter, running out and closing.
export function shiftLog(model: FactoryModel, result: SimResult, t: number, unit: string): LogEntry[] {
  const entries: LogEntry[] = []
  const productName = (id: string) => model.products?.find((p) => p.id === id)?.name ?? id
  const material = model.supply?.name ?? 'material'

  // A named incident stops several stations at once, so it's one entry.
  const incidents = new Map<string, { at: number; cause: string; stations: string[]; until: number }>()
  for (const event of result.events) {
    if (event.t > t) break
    if (event.type !== 'jam' || !event.outage) continue
    const station = model.stations[event.station].name
    if (event.cause) {
      const key = `${event.cause}@${event.t}`
      const incident = incidents.get(key) ?? { at: event.t, cause: event.cause, stations: [], until: event.until }
      incident.stations.push(station)
      incident.until = Math.max(incident.until, event.until)
      incidents.set(key, incident)
      continue
    }
    const over = t >= event.until
    entries.push({
      at: event.t,
      icon: 'wrench',
      text: `${station} broke down`,
      detail: over ? `running again at ${clock(event.until)}` : `down until ${clock(event.until)}`,
      tone: 'bad',
    })
  }
  for (const { at, cause, stations, until } of incidents.values()) {
    const which = stations.length === model.stations.length ? 'every station' : stations.join(' and ')
    entries.push({ at, icon: 'bolt', text: cause, detail: t >= until ? `${which} stopped, running again at ${clock(until)}` : `${which} stopped until ${clock(until)}`, tone: 'bad' })
  }

  // Stops with a reason, such as a missing operator or maintenance, once they start.
  for (const station of model.stations) {
    for (const stop of station.breaks ?? []) {
      if (!stop.reason || t < stop.from) continue
      entries.push({ at: stop.from, icon: 'clock', text: `${station.name}: ${stop.reason.toLowerCase()}`, detail: `${clock(stop.from)} to ${clock(stop.to)}`, tone: 'warn' })
    }
  }

  // Deliveries in the order they were due, matched to arrivals in the same order.
  const arrivals = result.events.filter((e) => e.type === 'delivery')
  const due = [...(model.supply?.deliveries ?? [])].sort((a, b) => a.due - b.due)
  due.forEach((delivery, k) => {
    const arrival = arrivals.filter((e) => e.type === 'delivery' && e.due === delivery.due)[due.slice(0, k).filter((d) => d.due === delivery.due).length]
    const late = arrival ? arrival.t - delivery.due : 0
    if (arrival && arrival.t <= t) {
      entries.push({
        at: arrival.t,
        icon: 'truck',
        text: `${delivery.amount} ${material} arrived`,
        detail: late >= 1 ? `${Math.round(late)} min late (due ${clock(delivery.due)})` : 'on time',
        tone: late >= 1 ? 'warn' : 'info',
      })
    } else if (t > delivery.due) {
      entries.push({ at: delivery.due, icon: 'truck', text: `Truck due at ${clock(delivery.due)}`, detail: 'running late', tone: 'bad' })
    }
  })

  const rushAt = new Map<number, number[]>()
  for (const event of result.events) {
    if (event.t > t) break
    if (event.type === 'release' && event.rush) rushAt.set(event.t, [...(rushAt.get(event.t) ?? []), event.job])
  }
  for (const [at, jobs] of rushAt) {
    const product = result.products?.[jobs[0]]
    entries.push({ at, icon: 'bolt', text: `Rush order: ${jobs.length} ${product ? `${productName(product).toLowerCase()}s` : unit}`, tone: 'warn' })
  }

  for (const change of model.mixChanges ?? []) {
    if (change.at > t) continue
    const names = [...new Set(change.mix)].map((id) => `${productName(id).toLowerCase()}s`)
    entries.push({ at: change.at, icon: 'swap', text: `Orders switch to ${names.join(' and ')}`, tone: 'info' })
  }
  for (const station of model.stations) {
    for (const change of station.priorityChanges ?? []) {
      if (change.at > t) continue
      const first = change.order.length > 0 ? `${productName(change.order[0]).toLowerCase()}s first` : 'oldest first'
      entries.push({ at: change.at, icon: 'sort', text: `New priority at ${station.name}: ${first}`, tone: 'info' })
    }
  }

  // Scrap and rework, as running counts at each station that scraps or sends work back.
  model.stations.forEach((station, i) => {
    if (!station.inspects && !station.changeoverScrap) return
    const scrapped = result.events.filter((e) => e.type === 'finish' && e.station === i && e.scrap && e.t <= t)
    if (scrapped.length > 0) {
      entries.push({ at: scrapped.at(-1)!.t, icon: 'bin', text: `${station.name} has scrapped ${scrapped.length}`, detail: 'so far', tone: 'bad' })
    }
    const back = result.events.filter((e) => e.type === 'finish' && e.station === i && e.rework !== undefined && e.t <= t)
    if (back.length > 0) {
      const to = model.stations.find((s) => s.id === station.reworkTo)?.name
      entries.push({ at: back.at(-1)!.t, icon: 'swap', text: `${station.name} has sent ${back.length} back to ${to}`, detail: 'so far', tone: 'warn' })
    }
  })

  if (model.market) entries.push(...shopLog(model, result, t, unit))
  return entries.sort((a, b) => a.at - b.at)
}

// The shop opening, a rush, each time it ran out of something (and how many customers left without
// it), and what it threw out at closing.
function shopLog(model: FactoryModel, result: SimResult, t: number, unit: string): LogEntry[] {
  const market = model.market!
  const entries: LogEntry[] = []
  if (t >= market.opens) entries.push({ at: market.opens, icon: 'tag', text: 'The shop opens', tone: 'info' })
  if (market.rush && t >= market.rush.from) {
    entries.push({ at: market.rush.from, icon: 'clock', text: 'The rush starts', detail: `until ${clock(market.rush.to)}`, tone: 'info' })
  }
  // Customers turned away, per product, in stretches: one that comes within 15 minutes of the last
  // continues the stretch, so a rush that empties the shelf again and again reads as one entry.
  const stretches: { product?: string; at: number; last: number; count: number }[] = []
  const current = new Map<string, (typeof stretches)[number]>()
  for (const event of result.events) {
    if (event.t > t) break
    if (event.type !== 'lost') continue
    const stretch = current.get(event.product ?? '')
    if (stretch && event.t - stretch.last <= 15) {
      stretch.count++
      stretch.last = event.t
    } else {
      const next = { product: event.product, at: event.t, last: event.t, count: 1 }
      current.set(event.product ?? '', next)
      stretches.push(next)
    }
  }
  const what = (product?: string) => (product === undefined ? unit : (model.products?.find((p) => p.id === product)?.name ?? product).toLowerCase())
  for (const { product, at, last, count } of stretches) {
    const detail = count === 1 ? turnedAway(1) : `${turnedAway(count)} by ${clock(last)}`
    entries.push({ at, icon: 'alert', text: `Out of ${what(product)}`, detail, tone: 'bad' })
  }
  if (t >= result.horizon && result.market) {
    const { waste } = result.market
    entries.push({ at: result.horizon, icon: 'bin', text: waste > 0 ? `Closing: ${waste} thrown out` : 'Closing: nothing thrown out', tone: waste > 0 ? 'warn' : 'info' })
  }
  return entries
}

// A moment worth stopping playback at, and what happened.
export interface Stop {
  at: number
  why: string
}

// Problems to stop at, in time order: a breakdown or named incident, the stockroom running out, a truck
// that's late, customers starting to be turned away, and a buffer running dry after it had filled.
export function problemStops(model: FactoryModel, result: SimResult, unit: string, buffer?: { station: number; low: number; high: number }): Stop[] {
  const stops: Stop[] = []
  const add = (at: number, why: string) => {
    if (!stops.some((stop) => stop.at === at)) stops.push({ at, why })
  }
  const material = model.supply?.name ?? 'material'
  let stock = result.supply?.onHand ?? Infinity
  const lastLost = new Map<string, number>()
  for (const event of result.events) {
    if (event.type === 'jam' && event.outage) add(event.t, event.cause ?? `${model.stations[event.station].name} broke down`)
    if (event.type === 'delivery') stock += event.amount
    if (event.type === 'start' && event.station === 0 && --stock === 0) add(event.t, `Out of ${material}`)
    if (event.type === 'lost') {
      const key = event.product ?? ''
      const last = lastLost.get(key)
      if (last === undefined || event.t - last > 15) {
        const product = event.product === undefined ? undefined : model.products?.find((p) => p.id === event.product)?.name.toLowerCase()
        add(event.t, `Out of ${product ?? unit}: a customer left without one`)
      }
      lastLost.set(key, event.t)
    }
  }
  for (const delivery of model.supply?.deliveries ?? []) {
    const arrival = result.events.find((e) => e.type === 'delivery' && e.due === delivery.due)
    if (!arrival || arrival.t > delivery.due + 1) add(delivery.due, `The truck due at ${clock(delivery.due)} is late`)
  }
  if (buffer) {
    // The buffer starts empty; it runs dry only once it has filled.
    const zones = bufferZones(result, buffer.station, buffer.low, buffer.high)
    const filled = zones.findIndex((zone) => zone.zone !== 'dry')
    const name = model.stations[buffer.station].name
    for (const zone of zones.slice(filled + 1)) if (filled >= 0 && zone.zone === 'dry') add(zone.from, `${name}'s buffer ran dry`)
  }
  return stops.sort((a, b) => a.at - b.at)
}

// One event in plain words, for the simulation log.
export function describeEvent(model: FactoryModel, result: SimResult, event: SimEvent, unit: string): string {
  const text = eventWords(model, result, event, unit)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function eventWords(model: FactoryModel, result: SimResult, event: SimEvent, unit: string): string {
  const one = unit.endsWith('s') ? unit.slice(0, -1) : unit
  const item = (job: number) => {
    const product = result.products?.[job]
    const name = product === undefined ? one : (model.products?.find((p) => p.id === product)?.name ?? product)
    return `${name} #${job + 1}`
  }
  const station = (i: number) => model.stations[i].name
  switch (event.type) {
    case 'release':
      return `${item(event.job)} released${event.rush ? ' (rush order)' : ''}`
    case 'start':
      return event.ready !== undefined && event.ready > event.t
        ? `${station(event.station)} starts a ${Math.round(event.ready - event.t)}-minute changeover for ${item(event.job)}`
        : `${station(event.station)} starts ${item(event.job)}`
    case 'finish': {
      const done = `${station(event.station)} finished ${item(event.job)}`
      if (event.scrap) return `${done}: scrapped`
      if (event.rework !== undefined) return `${done}: sent back to ${station(event.rework)}`
      return event.station === model.stations.length - 1 ? `${done}: ${model.market ? 'on the shelf' : 'shipped'}` : done
    }
    case 'move':
      return `${station(event.station)} sent a cart of ${event.jobs.length} to ${station(event.station + 1)}`
    case 'jam':
      if (event.cause) return `${event.cause} at ${station(event.station)} until ${clock(event.until)}`
      return `${station(event.station)} ${event.outage ? 'broke down' : 'jammed'} until ${clock(event.until)}`
    case 'delivery':
      return `${event.amount} ${model.supply?.name ?? 'material'} delivered`
    case 'sale':
      return `A customer bought ${item(event.job)}`
    case 'lost': {
      const product = event.product === undefined ? undefined : model.products?.find((p) => p.id === event.product)?.name.toLowerCase()
      return `A customer left without ${product ? `a ${product} ${one}` : `a ${one}`}`
    }
  }
}

function turnedAway(count: number): string {
  return `${customers(count)} turned away`
}
