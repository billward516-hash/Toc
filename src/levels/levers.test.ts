import { describe, expect, it } from 'vitest'
import type { FactoryModel } from '../engine/model.ts'
import { allPlans, applyLevers } from './levers.ts'
import type { Lever } from './types.ts'

const lunch = [{ from: 240, to: 300 }]
const model: FactoryModel = {
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 2, max: 4 }, breaks: lunch },
    { id: 'paint', name: 'Paint', cycleTime: { kind: 'fixed', value: 5 }, breaks: lunch },
  ],
  release: { kind: 'saturate' },
  horizon: 480,
}

const levers: Lever[] = [
  { id: 'tool', kind: 'upgrade', label: 'Tool', stations: ['cut', 'paint'], factor: 0.8 },
  { id: 'floater', kind: 'coverBreak', label: 'Floater', stations: ['cut', 'paint'] },
]

describe('applyLevers', () => {
  it('speeds up only the station that gets the upgrade', () => {
    const changed = applyLevers(model, levers, { tool: 'paint', floater: 'cut' })
    expect(changed.stations[1].cycleTime).toEqual({ kind: 'fixed', value: 4 })
    expect(changed.stations[0].cycleTime).toEqual(model.stations[0].cycleTime)
  })

  it('removes breaks only where the floater covers', () => {
    const changed = applyLevers(model, levers, { tool: 'paint', floater: 'cut' })
    expect(changed.stations[0].breaks).toEqual([])
    expect(changed.stations[1].breaks).toEqual(lunch)
  })

  it('leaves the original model untouched', () => {
    applyLevers(model, levers, { tool: 'cut', floater: 'paint' })
    expect(model.stations[0].cycleTime).toEqual({ kind: 'uniform', min: 2, max: 4 })
    expect(model.stations[1].breaks).toEqual(lunch)
  })
})

describe('allPlans', () => {
  it('lists every combination of choices', () => {
    expect(allPlans(levers)).toEqual([
      { tool: 'cut', floater: 'cut' },
      { tool: 'cut', floater: 'paint' },
      { tool: 'paint', floater: 'cut' },
      { tool: 'paint', floater: 'paint' },
    ])
  })
})
