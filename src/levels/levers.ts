import { mean, scale, steadied } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import type { Choices, Lever } from './types.ts'

export function applyLevers(model: FactoryModel, levers: Lever[], choices: Choices): FactoryModel {
  const pace = levers.find((lever) => lever.kind === 'releasePace' && choices[lever.id] !== undefined)
  return {
    ...model,
    release: pace ? { kind: 'interval', every: { kind: 'fixed', value: Number(choices[pace.id]) } } : model.release,
    stations: model.stations.map((station) =>
      levers.reduce((changed, lever) => {
        if (lever.kind === 'releasePace' || choices[lever.id] !== station.id) return changed
        switch (lever.kind) {
          case 'upgrade':
            return { ...changed, cycleTime: scale(changed.cycleTime, lever.factor) }
          case 'coverBreak':
            return { ...changed, breaks: [] }
          case 'steady':
            return { ...changed, cycleTime: steadied(changed.cycleTime) }
        }
      }, station),
    ),
  }
}

// The same line on a perfect day: every station takes exactly its average time.
export function steadyTwin(model: FactoryModel): FactoryModel {
  return { ...model, stations: model.stations.map((s) => ({ ...s, cycleTime: { kind: 'fixed', value: mean(s.cycleTime) } })) }
}

export function leverValues(lever: Lever): string[] {
  return lever.kind === 'releasePace' ? lever.every.map(String) : lever.stations
}

export function valueLabel(lever: Lever, value: string, model: FactoryModel): string {
  if (lever.kind === 'releasePace') return `Every ${value} min`
  return model.stations.find((s) => s.id === value)?.name ?? value
}

// Every complete plan a player could make.
export function allPlans(levers: Lever[]): Choices[] {
  return levers.reduce<Choices[]>(
    (plans, lever) => plans.flatMap((plan) => leverValues(lever).map((value) => ({ ...plan, [lever.id]: value }))),
    [{}],
  )
}
