import { describe, expect, it } from 'vitest'
import type { FactoryModel } from './model.ts'
import { simulate } from './simulate.ts'
import { snapshotAt } from './timeline.ts'

const model: FactoryModel = {
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 1, max: 3 } },
    { id: 'paint', name: 'Paint', cycleTime: { kind: 'triangular', min: 2, mode: 4, max: 7 } },
    { id: 'pack', name: 'Pack', cycleTime: { kind: 'uniform', min: 2, max: 4 } },
  ],
  release: { kind: 'saturate' },
  horizon: 480,
}

describe('snapshotAt', () => {
  const result = simulate(model, 11)

  it('accounts for every released unit: waiting, working, or shipped', () => {
    for (const t of [0, 1.5, 30, 240, 480]) {
      const snap = snapshotAt(result, t)
      const waiting = snap.queues.reduce((a, b) => a + b, 0)
      const working = snap.working.reduce((a, w) => a + w.length, 0)
      expect(snap.queues.every((q) => q >= 0)).toBe(true)
      expect(waiting + working + snap.shipped).toBe(snap.released)
    }
  })

  it('agrees with the run summary at the end', () => {
    const end = snapshotAt(result, result.horizon)
    expect(end.shipped).toBe(result.output)
    expect(end.completed).toEqual(result.stations.map((s) => s.completed))
  })

  it('shows the pile-up in front of the bottleneck', () => {
    const fixedLine: FactoryModel = {
      ...model,
      stations: [2, 5, 3].map((value, i) => ({ ...model.stations[i], cycleTime: { kind: 'fixed', value } })),
      horizon: 100,
    }
    const snap = snapshotAt(simulate(fixedLine, 1), 100)
    expect(snap.queues).toEqual([0, 30, 0])
  })

  it('reports in-progress work with its start and finish times', () => {
    const snap = snapshotAt(result, 100)
    for (const active of snap.working.flat()) {
      expect(active.start).toBeLessThanOrEqual(100)
      expect(active.end).toBeGreaterThan(100)
    }
  })
})
