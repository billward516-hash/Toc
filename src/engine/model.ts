import { problemWith, type Dist } from './distributions.ts'

export interface Station {
  id: string
  name: string
  cycleTime: Dist
  servers?: number
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
