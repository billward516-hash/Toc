import { mean, scale, steadied } from '../engine/distributions.ts'
import type { FactoryModel, Station } from '../engine/model.ts'
import type { Choices, Lever } from './types.ts'

export function applyLevers(model: FactoryModel, levers: Lever[], choices: Choices): FactoryModel {
  let release = model.release
  let mix = model.mix
  for (const lever of levers) {
    const value = choices[lever.id]
    if (value === undefined) continue
    if (lever.kind === 'releasePace') release = { kind: 'interval', every: { kind: 'fixed', value: Number(value) } }
    if (lever.kind === 'ropeTo') release = { kind: 'rope', constraint: value, buffer: lever.length }
    if (lever.kind === 'menu') {
      const option = lever.options.find((o) => o.id === value)
      if (option) {
        mix = option.mix
        release = { kind: 'interval', every: { kind: 'fixed', value: option.every } }
      }
    }
    if (lever.kind === 'lotSize' && release.kind === 'interval') {
      // Lots of n arrive n times as far apart, each lot all one product, taking the products in the mix's order.
      const n = Number(value)
      const lot = release.lot ?? 1
      release = { ...release, every: scale(release.every, n / lot), lot: n }
      mix = model.mix?.filter((_, i) => i % lot === 0).flatMap((product) => Array<string>(n).fill(product))
    }
  }
  for (const lever of levers) {
    const value = choices[lever.id]
    if (lever.kind === 'ropeLength' && value !== undefined && release.kind === 'rope') release = { ...release, buffer: Number(value) }
  }
  const transfer = levers.find((lever) => lever.kind === 'transferSize' && choices[lever.id] !== undefined)
  return {
    ...model,
    release,
    ...(mix ? { mix } : {}),
    stations: model.stations.map((station) => {
      const changed = levers.reduce((s, lever) => changeStation(s, lever, choices), station)
      return transfer ? { ...changed, transfer: Number(choices[transfer.id]) } : changed
    }),
  }
}

function changeStation(station: Station, lever: Lever, choices: Choices): Station {
  const value = choices[lever.id]
  if (lever.kind === 'machineRule') {
    const option = lever.options.find((o) => o.id === value)
    if (!option || lever.station !== station.id) return station
    const machines = station.machines?.map((m) => (m.name === lever.machine ? { ...m, products: option.products } : m))
    return { ...station, machines }
  }
  if (lever.kind === 'buy') {
    const purchase = lever.options.find((o) => o.id === value)
    if (!purchase || purchase.station !== station.id) return station
    return { ...station, machines: [...(station.machines ?? []), purchase.machine] }
  }
  if (lever.kind === 'priority') {
    const option = lever.options.find((o) => o.id === value)
    if (!option || lever.station !== station.id) return station
    return { ...station, priority: option.order }
  }
  if (value !== station.id) return station
  switch (lever.kind) {
    case 'upgrade':
      return { ...station, cycleTime: scale(station.cycleTime, lever.factor) }
    case 'coverBreak':
      return { ...station, breaks: [] }
    case 'maintain':
      return { ...station, jams: undefined }
    case 'steady':
      return { ...station, cycleTime: steadied(station.cycleTime) }
    case 'quickChange':
      return station.changeover ? { ...station, changeover: scale(station.changeover, lever.factor) } : station
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
    case 'machineRule':
      return lever.options.map((o) => o.id)
    case 'buy':
      return ['none', ...lever.options.map((o) => o.id)]
    case 'lotSize':
    case 'transferSize':
      return lever.sizes.map(String)
    case 'priority':
    case 'menu':
      return lever.options.map((o) => o.id)
    default:
      return lever.stations
  }
}

export function valueLabel(lever: Lever, value: string, model: FactoryModel): string {
  switch (lever.kind) {
    case 'releasePace':
      return `Every ${value} min`
    case 'ropeLength':
      return `${value} robots`
    case 'machineRule':
      return lever.options.find((o) => o.id === value)?.label ?? value
    case 'buy':
      return value === 'none' ? "Don't buy" : (lever.options.find((o) => o.id === value)?.label ?? value)
    case 'lotSize':
    case 'transferSize':
      return value === '1' ? 'One at a time' : `${value} at a time`
    case 'priority':
    case 'menu':
      return lever.options.find((o) => o.id === value)?.label ?? value
    default:
      return model.stations.find((s) => s.id === value)?.name ?? value
  }
}

// Money a plan spends on new machines.
export function planCost(levers: Lever[], choices: Choices): number {
  return levers.reduce((sum, lever) => {
    if (lever.kind !== 'buy') return sum
    return sum + (lever.options.find((o) => o.id === choices[lever.id])?.price ?? 0)
  }, 0)
}

// How far a plan goes over the level's budget; nothing when it fits, or when there is no budget.
export function overBudget(levers: Lever[], choices: Choices, budget?: number): number {
  return budget === undefined ? 0 : Math.max(0, planCost(levers, choices) - budget)
}

// Every complete plan a player could make.
export function allPlans(levers: Lever[]): Choices[] {
  return levers.reduce<Choices[]>(
    (plans, lever) => plans.flatMap((plan) => leverValues(lever).map((value) => ({ ...plan, [lever.id]: value }))),
    [{}],
  )
}
