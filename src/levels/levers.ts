import { scale } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import type { Choices, Lever } from './types.ts'

export function applyLevers(model: FactoryModel, levers: Lever[], choices: Choices): FactoryModel {
  return {
    ...model,
    stations: model.stations.map((station) =>
      levers.reduce((changed, lever) => {
        if (choices[lever.id] !== station.id) return changed
        switch (lever.kind) {
          case 'upgrade':
            return { ...changed, cycleTime: scale(changed.cycleTime, lever.factor) }
          case 'coverBreak':
            return { ...changed, breaks: [] }
        }
      }, station),
    ),
  }
}

// Every complete plan a player could make.
export function allPlans(levers: Lever[]): Choices[] {
  return levers.reduce<Choices[]>(
    (plans, lever) => plans.flatMap((plan) => lever.stations.map((station) => ({ ...plan, [lever.id]: station }))),
    [{}],
  )
}
