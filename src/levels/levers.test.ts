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

describe('rope and maintenance levers', () => {
  const jammy: FactoryModel = {
    ...model,
    stations: model.stations.map((s) => ({ ...s, jams: { every: { kind: 'fixed', value: 60 }, lasts: { kind: 'fixed', value: 10 } } })),
  }
  const rope: Lever[] = [
    { id: 'tie', kind: 'ropeTo', label: 'Tie', stations: ['cut', 'paint'], length: 5 },
    { id: 'length', kind: 'ropeLength', label: 'Length', lengths: [3, 8] },
  ]

  it('ties a rope of the lever length, then lets the length lever resize it', () => {
    expect(applyLevers(model, rope.slice(0, 1), { tie: 'paint' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 5 })
    expect(applyLevers(model, rope, { length: '8', tie: 'paint' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 8 })
  })

  it('resizes a rope the line already has, and leaves a line without one alone', () => {
    const roped: FactoryModel = { ...model, release: { kind: 'rope', constraint: 'paint', buffer: 5 } }
    expect(applyLevers(roped, rope.slice(1), { length: '3' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 3 })
    expect(applyLevers(model, rope.slice(1), { length: '3' }).release).toEqual({ kind: 'saturate' })
  })

  it('stops jams only where maintenance goes, and never touches planned breaks', () => {
    const fix: Lever = { id: 'fix', kind: 'maintain', label: 'Fix', stations: ['cut', 'paint'] }
    const changed = applyLevers(jammy, [fix], { fix: 'paint' })
    expect(changed.stations[1].jams).toBeUndefined()
    expect(changed.stations[1].breaks).toEqual(lunch)
    expect(changed.stations[0].jams).toEqual(jammy.stations[0].jams)
    const covered = applyLevers(jammy, [levers[1]], { floater: 'paint' })
    expect(covered.stations[1].breaks).toEqual([])
    expect(covered.stations[1].jams).toEqual(jammy.stations[1].jams)
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
