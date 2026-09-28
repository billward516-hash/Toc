import { mean, problemWith, type Dist } from './distributions.ts'

export interface Station {
  id: string
  name: string
  cycleTime: Dist
  servers?: number
  breaks?: Break[]
  jams?: Jams
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

export function onBreak(station: Station, t: number): boolean {
  return station.breaks?.some((b) => t >= b.from && t < b.to) ?? false
}

// Units a station could finish in the horizon if it never ran out of work, counting jams at their average.
export function capacity(station: Station, horizon: number): number {
  const stopped = (station.breaks ?? []).reduce((sum, b) => sum + Math.max(0, Math.min(b.to, horizon) - b.from), 0)
  const { jams } = station
  const running = jams ? mean(jams.every) / (mean(jams.every) + mean(jams.lasts)) : 1
  return ((horizon - stopped) * running * (station.servers ?? 1)) / mean(station.cycleTime)
}

export type Release =
  | { kind: 'saturate' }
  | { kind: 'interval'; every: Dist }
  | { kind: 'rope'; constraint: string; buffer: number }

// A linear line: units flow through the stations in array order. Times are in minutes.
export interface FactoryModel {
  stations: Station[]
  release: Release
  horizon: number
}

export function validateModel(model: FactoryModel): string[] {
  const problems: string[] = []
  if (model.stations.length === 0) problems.push('the line has no stations')
  if (!(model.horizon > 0)) problems.push('horizon must be positive')
  const ids = new Set<string>()
  for (const station of model.stations) {
    if (ids.has(station.id)) problems.push(`duplicate station id "${station.id}"`)
    ids.add(station.id)
    const servers = station.servers ?? 1
    if (!Number.isInteger(servers) || servers < 1) problems.push(`${station.id}: servers must be a positive integer`)
    const cycle = problemWith(station.cycleTime)
    if (cycle) problems.push(`${station.id}: ${cycle}`)
    for (const b of station.breaks ?? []) {
      if (!(b.from >= 0 && b.to > b.from)) problems.push(`${station.id}: a break must have 0 <= from < to`)
    }
    for (const dist of station.jams ? [station.jams.every, station.jams.lasts] : []) {
      const jam = problemWith(dist)
      if (jam) problems.push(`${station.id}: jams: ${jam}`)
    }
  }
  const { release } = model
  if (release.kind === 'interval') {
    const every = problemWith(release.every)
    if (every) problems.push(`release: ${every}`)
  }
  if (release.kind === 'rope') {
    if (!ids.has(release.constraint)) problems.push(`rope: unknown constraint "${release.constraint}"`)
    if (!Number.isInteger(release.buffer) || release.buffer < 1) problems.push('rope: buffer must be a positive integer')
  }
  return problems
}
