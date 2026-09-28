import { mean, problemWith, type Dist } from './distributions.ts'

export interface Station {
  id: string
  name: string
  cycleTime: Dist
  // Times for particular products, in place of cycleTime.
  times?: Record<string, Dist>
  servers?: number
  // Named machines, each able to run only certain products. Used instead of `servers`.
  machines?: Machine[]
  // Time a machine spends switching from one product to another before it can start the next.
  changeover?: Dist
  // Finished units wait in a cart until this many are ready, or their lot is done, then move on together.
  transfer?: number
  breaks?: Break[]
  jams?: Jams
}

// One machine at a station. It runs only `products` (every product when absent); its own `times`
// come first, then the station's.
export interface Machine {
  name: string
  products?: string[]
  times?: Record<string, Dist>
}

export interface Product {
  id: string
  name: string
}

// A planned stop: the station finishes the part in hand, then starts nothing new until `to`.
export interface Break {
  from: number
  to: number
}

// Unplanned stops: the station runs for a time drawn from `every`, then jams for a time drawn from
// `lasts` (finishing the part in hand, like a break), and so on. Each seed jams at different times.
export interface Jams {
  every: Dist
  lasts: Dist
}

// A station's machines: its named ones, or `servers` identical machines that run everything.
export function machinesOf(station: Station): Machine[] {
  return station.machines ?? Array.from({ length: station.servers ?? 1 }, () => ({ name: station.name }))
}

export function canRun(machine: Machine, product: string | undefined): boolean {
  return product === undefined || machine.products === undefined || machine.products.includes(product)
}

export function timeFor(station: Station, machine: Machine, product: string | undefined): Dist {
  if (product === undefined) return station.cycleTime
  return machine.times?.[product] ?? station.times?.[product] ?? station.cycleTime
}

// The product of the job-th unit released, when the line makes several.
export function productOf(model: FactoryModel, job: number): string | undefined {
  return model.mix?.[job % model.mix.length]
}

export function onBreak(station: Station, t: number): boolean {
  return station.breaks?.some((b) => t >= b.from && t < b.to) ?? false
}

// Units of a single product a station could finish in the horizon if it never ran out of work,
// counting jams at their average.
export function capacity(station: Station, horizon: number): number {
  const stopped = (station.breaks ?? []).reduce((sum, b) => sum + Math.max(0, Math.min(b.to, horizon) - b.from), 0)
  const { jams } = station
  const running = jams ? mean(jams.every) / (mean(jams.every) + mean(jams.lasts)) : 1
  return ((horizon - stopped) * running * machinesOf(station).length) / mean(station.cycleTime)
}

export type Release =
  | { kind: 'saturate' }
  // Orders arrive on a schedule, `lot` units at a time (one by default).
  | { kind: 'interval'; every: Dist; lot?: number }
  | { kind: 'rope'; constraint: string; buffer: number }

// A linear line: units flow through the stations in array order. Times are in minutes.
export interface FactoryModel {
  stations: Station[]
  release: Release
  horizon: number
  // Several products share the line. New work follows `mix`, a repeating pattern of product ids.
  products?: Product[]
  mix?: string[]
}

export function validateModel(model: FactoryModel): string[] {
  const problems: string[] = []
  if (model.stations.length === 0) problems.push('the line has no stations')
  if (!(model.horizon > 0)) problems.push('horizon must be positive')
  const productIds = new Set((model.products ?? []).map((p) => p.id))
  if (productIds.size !== (model.products ?? []).length) problems.push('duplicate product id')
  if (model.products && !model.mix?.length) problems.push('a line with products needs a mix')
  if (model.mix && !model.products) problems.push('a mix needs products')
  for (const id of model.mix ?? []) if (!productIds.has(id)) problems.push(`mix: unknown product "${id}"`)
  const timesProblems = (where: string, times: Record<string, Dist> | undefined) => {
    for (const [product, dist] of Object.entries(times ?? {})) {
      if (!productIds.has(product)) problems.push(`${where}: times for unknown product "${product}"`)
      const time = problemWith(dist)
      if (time) problems.push(`${where}: ${product}: ${time}`)
    }
  }
  const ids = new Set<string>()
  for (const [index, station] of model.stations.entries()) {
    if (ids.has(station.id)) problems.push(`duplicate station id "${station.id}"`)
    ids.add(station.id)
    const servers = station.servers ?? 1
    if (!Number.isInteger(servers) || servers < 1) problems.push(`${station.id}: servers must be a positive integer`)
    if (station.machines && station.servers !== undefined) problems.push(`${station.id}: give machines or servers, not both`)
    if (station.machines?.length === 0) problems.push(`${station.id}: needs at least one machine`)
    const cycle = problemWith(station.cycleTime)
    if (cycle) problems.push(`${station.id}: ${cycle}`)
    timesProblems(station.id, station.times)
    for (const machine of station.machines ?? []) {
      const where = `${station.id}/${machine.name}`
      for (const product of machine.products ?? []) {
        if (!productIds.has(product)) problems.push(`${where}: unknown product "${product}"`)
      }
      timesProblems(where, machine.times)
      if (index === 0 && model.release.kind === 'saturate' && machine.products) {
        problems.push(`${where}: with saturate release, the first station's machines must run every product`)
      }
    }
    // A product no machine here can run would wait forever.
    for (const product of new Set(model.mix ?? [])) {
      if (!machinesOf(station).some((m) => canRun(m, product))) problems.push(`${station.id}: no machine can run "${product}"`)
    }
    for (const b of station.breaks ?? []) {
      if (!(b.from >= 0 && b.to > b.from)) problems.push(`${station.id}: a break must have 0 <= from < to`)
    }
    for (const dist of station.jams ? [station.jams.every, station.jams.lasts] : []) {
      const jam = problemWith(dist)
      if (jam) problems.push(`${station.id}: jams: ${jam}`)
    }
    const change = station.changeover && problemWith(station.changeover)
    if (change) problems.push(`${station.id}: changeover: ${change}`)
    const transfer = station.transfer ?? 1
    if (!Number.isInteger(transfer) || transfer < 1) problems.push(`${station.id}: transfer must be a positive integer`)
  }
  const { release } = model
  if (release.kind === 'interval') {
    const every = problemWith(release.every)
    if (every) problems.push(`release: ${every}`)
    const lot = release.lot ?? 1
    if (!Number.isInteger(lot) || lot < 1) problems.push('release: lot must be a positive integer')
  }
  if (release.kind === 'rope') {
    if (!ids.has(release.constraint)) problems.push(`rope: unknown constraint "${release.constraint}"`)
    if (!Number.isInteger(release.buffer) || release.buffer < 1) problems.push('rope: buffer must be a positive integer')
  }
  return problems
}

// Units per order: an interval release can bring several at once.
export function lotSize(release: Release): number {
  return release.kind === 'interval' ? (release.lot ?? 1) : 1
}
