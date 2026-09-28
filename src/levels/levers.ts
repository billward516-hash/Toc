import { mean, scale, steadied } from '../engine/distributions.ts'
import type { FactoryModel, Station } from '../engine/model.ts'
import type { Choices, Lever } from './types.ts'

export function applyLevers(model: FactoryModel, levers: Lever[], choices: Choices): FactoryModel {
  let release = model.release
  for (const lever of levers) {
    const value = choices[lever.id]
    if (value === undefined) continue
    if (lever.kind === 'releasePace') release = { kind: 'interval', every: { kind: 'fixed', value: Number(value) } }
    if (lever.kind === 'ropeTo') release = { kind: 'rope', constraint: value, buffer: lever.length }
  }
  for (const lever of levers) {
    const value = choices[lever.id]
    if (lever.kind === 'ropeLength' && value !== undefined && release.kind === 'rope') release = { ...release, buffer: Number(value) }
  }
  return {
    ...model,
    release,
    stations: model.stations.map((station) => levers.reduce((changed, lever) => changeStation(changed, lever, choices), station)),
  }
}

function changeStation(station: Station, lever: Lever, choices: Choices): Station {
  if (choices[lever.id] !== station.id) return station
  switch (lever.kind) {
    case 'upgrade':
      return { ...station, cycleTime: scale(station.cycleTime, lever.factor) }
    case 'coverBreak':
      return { ...station, breaks: [] }
    case 'maintain':
      return { ...station, jams: undefined }
    case 'steady':
      return { ...station, cycleTime: steadied(station.cycleTime) }
    default:
      return station
  }
}

// The same line on a perfect day: every station takes exactly its average time.
export function steadyTwin(model: FactoryModel): FactoryModel {
  return { ...model, stations: model.stations.map((s) => ({ ...s, cycleTime: { kind: 'fixed', value: mean(s.cycleTime) } })) }
}

export function leverValues(lever: Lever): string[] {
  switch (lever.kind) {
    case 'releasePace':
      return lever.every.map(String)
    case 'ropeLength':
      return lever.lengths.map(String)
    default:
      return lever.stations
  }
}

export function valueLabel(lever: Lever, value: string, model: FactoryModel): string {
  if (lever.kind === 'releasePace') return `Every ${value} min`
  if (lever.kind === 'ropeLength') return `${value} robots`
  return model.stations.find((s) => s.id === value)?.name ?? value
}

// Every complete plan a player could make.
export function allPlans(levers: Lever[]): Choices[] {
  return levers.reduce<Choices[]>(
    (plans, lever) => plans.flatMap((plan) => leverValues(lever).map((value) => ({ ...plan, [lever.id]: value }))),
    [{}],
  )
}
