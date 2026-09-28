import { describe, expect, it } from 'vitest'
import type { FactoryModel } from './model.ts'
import { simulate } from './simulate.ts'
import { bufferShare, bufferZones, snapshotAt, steadyShare } from './timeline.ts'

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

  it('measures how long the line stayed free of big piles', () => {
    const fixedLine: FactoryModel = {
      ...model,
      stations: [2, 5, 3].map((value, i) => ({ ...model.stations[i], cycleTime: { kind: 'fixed', value } })),
      horizon: 100,
    }
    const run = simulate(fixedLine, 1)
    // Paint's pile reaches 5 at minute 16, drops to 4 at 17, and stays at 5 or more from 18 on.
    expect(steadyShare(run, 5)).toBeCloseTo(0.17, 10)
    expect(steadyShare(run, 5, 17)).toBeCloseTo(16 / 17, 10)
    expect(steadyShare(run, 100)).toBe(1)
  })

  it('measures how long a buffer stayed within its band', () => {
    const fixedLine: FactoryModel = {
      ...model,
      stations: [2, 5, 3].map((value, i) => ({ ...model.stations[i], cycleTime: { kind: 'fixed', value } })),
      horizon: 100,
    }
    const run = simulate(fixedLine, 1)
    // Paint's pile: 1 from minute 4, 2 from 6, back to 1 at 7, 2 at 8, 3 at 10; it never drops below 2 after 8.
    // In the band [2, 4] from 6 to 7 and from 8 until it reaches 5 at 16, then briefly again from 17 to 18.
    expect(bufferShare(run, 1, 2, 4)).toBeCloseTo((1 + 8 + 1) / 100, 10)
    expect(bufferShare(run, 1, 0, 1000)).toBe(1)
    expect(bufferZones(run, 1, 2, 4)).toEqual([
      { from: 0, to: 6, zone: 'dry' },
      { from: 6, to: 7, zone: 'healthy' },
      { from: 7, to: 8, zone: 'dry' },
      { from: 8, to: 16, zone: 'healthy' },
      { from: 16, to: 17, zone: 'flooding' },
      { from: 17, to: 18, zone: 'healthy' },
      { from: 18, to: 100, zone: 'flooding' },
    ])
  })

  it('shows which stations are jammed, and ignores jams when counting piles', () => {
    const jammed: FactoryModel = { ...model, stations: model.stations.map((s, i) => (i === 1 ? { ...s, jams: { every: { kind: 'fixed', value: 60 }, lasts: { kind: 'fixed', value: 20 } } } : s)) }
    const run = simulate(jammed, 11)
    expect(snapshotAt(run, 59).jammed).toEqual([false, false, false])
    expect(snapshotAt(run, 60).jammed).toEqual([false, true, false])
    expect(snapshotAt(run, 80).jammed).toEqual([false, false, false])
    const withoutJams = { ...run, events: run.events.filter((e) => e.type !== 'jam') }
    expect(steadyShare(run, 3)).toBe(steadyShare(withoutJams, 3))
    expect(bufferShare(run, 1, 2, 6)).toBe(bufferShare(withoutJams, 1, 2, 6))
  })

  it('reports in-progress work with its start and finish times', () => {
    const snap = snapshotAt(result, 100)
    for (const active of snap.working.flat()) {
      expect(active.start).toBeLessThanOrEqual(100)
      expect(active.end).toBeGreaterThan(100)
    }
  })
})
