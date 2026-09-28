import { describe, expect, it } from 'vitest'
import type { Dist } from './distributions.ts'
import type { FactoryModel, Release } from './model.ts'
import { runBatch, simulate, type SimResult } from './simulate.ts'

const fixed = (value: number): Dist => ({ kind: 'fixed', value })
const uniform = (min: number, max: number): Dist => ({ kind: 'uniform', min, max })
const triangular = (min: number, mode: number, max: number): Dist => ({ kind: 'triangular', min, mode, max })

const line = (cycles: Dist[], release: Release = { kind: 'saturate' }, horizon = 100): FactoryModel => ({
  stations: cycles.map((cycleTime, i) => ({ id: `s${i}`, name: `Station ${i}`, cycleTime })),
  release,
  horizon,
})

const variable = line([uniform(1, 3), triangular(2, 4, 7), uniform(2, 4)], { kind: 'saturate' }, 480)

const durationsAt = (result: SimResult, station: number) =>
  result.events.flatMap((e) => (e.type === 'start' && e.station === station ? [e.end - e.t] : []))

describe('a deterministic line', () => {
  const result = simulate(line([fixed(2), fixed(5), fixed(3)]), 1)

  it('ships at the bottleneck pace', () => {
    // First unit ships at 2 + 5 + 3 = 10, then one every 5 minutes.
    expect(result.output).toBe(19)
  })

  it('keeps the bottleneck busy while the others wait', () => {
    const [cut, paint, pack] = result.stations.map((s) => s.utilization)
    expect(cut).toBeCloseTo(1)
    expect(paint).toBeCloseTo(0.98)
    expect(pack).toBeCloseTo(0.57)
  })

  it('does not ship more when a non-bottleneck speeds up', () => {
    expect(simulate(line([fixed(1), fixed(5), fixed(3)]), 1).output).toBe(19)
    expect(simulate(line([fixed(2), fixed(5), fixed(1)]), 1).output).toBe(19)
  })

  it('ships more when the bottleneck speeds up', () => {
    expect(simulate(line([fixed(2), fixed(4), fixed(3)]), 1).output).toBe(23)
  })

  it('logs events in time order', () => {
    expect(result.events.every((e, i) => i === 0 || result.events[i - 1].t <= e.t)).toBe(true)
  })
})

describe('reproducibility', () => {
  it('replays identically for the same seed', () => {
    expect(simulate(variable, 7)).toEqual(simulate(variable, 7))
  })

  it('differs across seeds', () => {
    expect(simulate(variable, 7).events).not.toEqual(simulate(variable, 8).events)
  })

  it("keeps each station's draws when a different station changes", () => {
    const faster = { ...variable, stations: variable.stations.map((s, i) => (i === 0 ? { ...s, cycleTime: uniform(0.5, 1.5) } : s)) }
    for (const station of [1, 2]) {
      const before = durationsAt(simulate(variable, 7), station)
      const after = durationsAt(simulate(faster, 7), station)
      const shared = Math.min(before.length, after.length)
      expect(shared).toBeGreaterThan(50)
      after.slice(0, shared).forEach((d, k) => expect(d).toBeCloseTo(before[k], 9))
    }
  })
})

describe('release policies', () => {
  it('releases on a fixed schedule', () => {
    const result = simulate(line([fixed(1)], { kind: 'interval', every: fixed(4) }, 20), 1)
    expect(result.events.flatMap((e) => (e.type === 'release' ? [e.t] : []))).toEqual([0, 4, 8, 12, 16, 20])
  })

  describe('a rope tied to the constraint', () => {
    const cycles = [uniform(1, 2), triangular(3, 4, 6), uniform(1, 3)]
    const roped = simulate(line(cycles, { kind: 'rope', constraint: 's1', buffer: 4 }, 480), 3)
    const flooded = simulate(line(cycles, { kind: 'saturate' }, 480), 3)

    it('never lets work ahead of the constraint exceed the buffer', () => {
      let ahead = 0
      let peak = 0
      for (const e of roped.events) {
        if (e.type === 'release') ahead++
        if (e.type === 'finish' && e.station === 1) ahead--
        peak = Math.max(peak, ahead)
      }
      expect(peak).toBe(4)
    })

    it('ships as much as flooding the floor, with a fraction of the inventory', () => {
      expect(roped.output).toBe(flooded.output)
      expect(roped.avgWip).toBeLessThan(flooded.avgWip / 5)
    })
  })

  it('shares work across parallel servers', () => {
    const doubled = line([fixed(2), fixed(6)], { kind: 'saturate' }, 120)
    doubled.stations[1].servers = 2
    expect(simulate(doubled, 1).output).toBe(38)
  })
})

describe('runBatch', () => {
  it('runs one independent simulation per seed', () => {
    const results = runBatch(variable, [1, 2, 3])
    expect(results.map((r) => r.seed)).toEqual([1, 2, 3])
    expect(results[1]).toEqual(simulate(variable, 2))
  })
})

describe('invalid models', () => {
  it('throws instead of looping forever', () => {
    expect(() => simulate(line([fixed(0)]), 1)).toThrow(/positive/)
    expect(() => simulate(line([fixed(1)], { kind: 'rope', constraint: 'nope', buffer: 3 }), 1)).toThrow(/unknown constraint/)
  })
})
