import type { FactoryModel } from '../engine/model.ts'
import type { SimResult } from '../engine/simulate.ts'
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
export function breaksDown(model: FactoryModel): boolean {
  return Boolean(model.incidents?.length || model.stations.some((s) => s.outages?.length))
}

// Whether a line has anything for the shift log to report.
export function hasDisruptions(model: FactoryModel): boolean {
  return Boolean(
    breaksDown(model) ||
      model.supply ||
      model.rush?.length ||
      model.mixChanges?.length ||
      model.stations.some((s) => s.priorityChanges?.length || s.inspects),
  )
}

// Every disruption up to minute `t` of the shown run: breakdowns, deliveries (and trucks running late),
// rush orders, changes to the orders, and scrap so far.
export function shiftLog(model: FactoryModel, result: SimResult, t: number, unit: string): LogEntry[] {
  const entries: LogEntry[] = []
  const productName = (id: string) => model.products?.find((p) => p.id === id)?.name ?? id
  const material = model.supply?.name ?? 'material'

  for (const event of result.events) {
    if (event.t > t) break
    if (event.type === 'jam' && event.outage) {
      const over = t >= event.until
      entries.push({
        at: event.t,
        icon: 'wrench',
        text: `${model.stations[event.station].name} broke down`,
        detail: over ? `running again at ${clock(event.until)}` : `down until ${clock(event.until)}`,
        tone: 'bad',
      })
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

  // Scrap, as a running count at each inspecting station.
  model.stations.forEach((station, i) => {
    if (!station.inspects) return
    const scrapped = result.events.filter((e) => e.type === 'finish' && e.station === i && e.scrap && e.t <= t)
    if (scrapped.length === 0) return
    entries.push({ at: scrapped.at(-1)!.t, icon: 'bin', text: `${station.name} has scrapped ${scrapped.length}`, detail: 'so far', tone: 'bad' })
  })

  return entries.sort((a, b) => a.at - b.at)
}
