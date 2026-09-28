import { describe, expect, it } from 'vitest'
import type { Dist } from './distributions.ts'
import { capacity, validateModel, type FactoryModel, type Release } from './model.ts'
import { runBatch, simulate, type SimResult } from './simulate.ts'
import { snapshotAt } from './timeline.ts'

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

describe('planned breaks', () => {
  const withBreak = (station: number) => {
    const model = line([fixed(2), fixed(5), fixed(3)])
    model.stations[station].breaks = [{ from: 40, to: 60 }]
    return model
  }

  it('costs output when the constraint stops', () => {
    // Paint finishes the part in hand at 42, then idles until 60: 20 minutes, 4 robots.
    expect(simulate(withBreak(1), 1).output).toBe(15)
  })

  it('costs nothing when a station with spare capacity stops', () => {
    expect(simulate(withBreak(2), 1).output).toBe(19)
  })

  it('counts breaks and parallel servers in capacity', () => {
    const paint = { id: 'paint', name: 'Paint', cycleTime: fixed(5), breaks: [{ from: 40, to: 60 }] }
    expect(capacity(paint, 100)).toBe(16)
    expect(capacity({ ...paint, servers: 2 }, 100)).toBe(32)
    expect(capacity({ ...paint, breaks: [{ from: 90, to: 200 }] }, 100)).toBe(18)
  })

  it('never starts work during a break', () => {
    const result = simulate(withBreak(1), 1)
    const startsAtPaint = result.events.flatMap((e) => (e.type === 'start' && e.station === 1 ? [e.t] : []))
    expect(startsAtPaint.some((t) => t >= 40 && t < 60)).toBe(false)
    expect(startsAtPaint).toContain(60)
  })
})

describe('jams', () => {
  const jammy = (station: number, every: Dist, lasts: Dist, cycles = [fixed(2), fixed(5), fixed(3)]) => {
    const model = line(cycles, { kind: 'saturate' }, 100)
    model.stations[station].jams = { every, lasts }
    return model
  }
  const jamsAt = (result: SimResult, station: number) =>
    result.events.flatMap((e) => (e.type === 'jam' && e.station === station ? [[e.t, e.until]] : []))

  it('stops a station after it finishes the part in hand, and restarts it when cleared', () => {
    const result = simulate(jammy(1, fixed(40), fixed(20)), 1)
    // Jams from 40 to 60, and again at 100 as the shift ends: the same stop as a 40-60 break, so the same output.
    expect(jamsAt(result, 1)).toEqual([
      [40, 60],
      [100, 120],
    ])
    const startsAtPaint = result.events.flatMap((e) => (e.type === 'start' && e.station === 1 ? [e.t] : []))
    expect(startsAtPaint.some((t) => t >= 40 && t < 60)).toBe(false)
    expect(startsAtPaint).toContain(60)
    expect(result.output).toBe(15)
  })

  it('jams at the same moments whatever the rest of the line does, and differently on another day', () => {
    const every = uniform(10, 30)
    const lasts = uniform(2, 8)
    const slow = simulate(jammy(1, every, lasts, [uniform(1, 3), triangular(2, 4, 7), uniform(2, 4)]), 5)
    const fast = simulate(jammy(1, every, lasts, [uniform(0.5, 1), triangular(2, 4, 7), uniform(1, 2)]), 5)
    expect(jamsAt(slow, 1).length).toBeGreaterThan(2)
    expect(jamsAt(fast, 1)).toEqual(jamsAt(slow, 1))
    expect(jamsAt(simulate(jammy(1, every, lasts), 6), 1)).not.toEqual(jamsAt(slow, 1))
  })

  it('counts jams at their average in capacity', () => {
    const mold = { id: 'mold', name: 'Mold', cycleTime: fixed(2), jams: { every: fixed(30), lasts: uniform(5, 15) } }
    expect(capacity(mold, 100)).toBe(37.5)
  })

  it('rejects impossible jams', () => {
    expect(() => simulate(jammy(1, fixed(0), fixed(5)), 1)).toThrow(/jams/)
  })
})

describe('products and machines', () => {
  // Posters and flyers share a two-press print station; the big press is kept for posters.
  const shop = (big: string[] | undefined, mix = ['poster', 'flyer', 'flyer']): FactoryModel => ({
    products: [
      { id: 'poster', name: 'Poster' },
      { id: 'flyer', name: 'Flyer' },
    ],
    mix,
    stations: [
      { id: 'design', name: 'Design', cycleTime: fixed(2) },
      {
        id: 'print',
        name: 'Print',
        cycleTime: fixed(4),
        times: { poster: fixed(5) },
        machines: [
          { name: 'Small press', products: ['flyer'], times: { flyer: fixed(6) } },
          { name: 'Big press', products: big },
        ],
      },
      { id: 'pack', name: 'Pack', cycleTime: fixed(1) },
    ],
    release: { kind: 'saturate' },
    horizon: 120,
  })
  const startsAt = (result: SimResult, station: number) =>
    result.events.flatMap((e) => (e.type === 'start' && e.station === station ? [e] : []))

  it('labels released work with the mix, over and over', () => {
    const result = simulate(shop(['poster']), 1)
    expect(result.products?.slice(0, 7)).toEqual(['poster', 'flyer', 'flyer', 'poster', 'flyer', 'flyer', 'poster'])
    expect(result.products).toHaveLength(result.released)
    expect(simulate(line([fixed(1)]), 1).products).toBeUndefined()
  })

  it('runs each product only on machines allowed to run it, at that machine’s time', () => {
    const result = simulate(shop(['poster']), 1)
    for (const start of startsAt(result, 1)) {
      const product = result.products![start.job]
      expect(start.machine).toBe(product === 'poster' ? 1 : 0)
      expect(start.end - start.t).toBe(product === 'poster' ? 5 : 6)
    }
  })

  it('lets a free machine skip work it cannot run and take the oldest it can', () => {
    const result = simulate(shop(['poster']), 1)
    const skipped = startsAt(result, 1).find((start) => {
      const before = snapshotAt(result, start.t - 1e-9).waiting[1]
      return before.length > 1 && before[0] !== start.job
    })
    expect(skipped).toBeDefined()
    expect(result.products![skipped!.job]).toBe('poster')
  })

  it('ships more when a machine may run more products', () => {
    const ruled = simulate(shop(['poster']), 1)
    const open = simulate(shop(undefined), 1)
    expect(startsAt(open, 1).some((s) => s.machine === 1 && open.products![s.job] === 'flyer')).toBe(true)
    expect(open.output).toBeGreaterThan(ruled.output)
  })

  it('keeps waiting and working work consistent in snapshots', () => {
    const result = simulate(shop(['poster']), 1)
    for (const t of [0, 10, 33.3, 60, 120]) {
      const snap = snapshotAt(result, t)
      expect(snap.waiting.map((q) => q.length)).toEqual(snap.queues)
      for (const active of snap.working[1]) expect([0, 1]).toContain(active.machine)
      const inProcess = snap.queues.reduce((a, b) => a + b, 0) + snap.working.reduce((a, w) => a + w.length, 0)
      expect(inProcess + snap.shipped).toBe(snap.released)
    }
  })

  it('rejects products that could never be made', () => {
    const problems = (model: FactoryModel) => validateModel(model)
    expect(problems({ ...shop(['poster']), mix: ['poster', 'banner'] })).toContain('mix: unknown product "banner"')
    const noFlyers = shop(['poster'])
    noFlyers.stations[1].machines = [{ name: 'Big press', products: ['poster'] }]
    expect(problems(noFlyers)).toContain('print: no machine can run "flyer"')
    const pickyStart = shop(['poster'])
    pickyStart.stations[0].machines = [{ name: 'Poster desk', products: ['poster'] }, { name: 'Desk' }]
    expect(problems(pickyStart)).toContain("design/Poster desk: with saturate release, the first station's machines must run every product")
    expect(problems({ ...shop(['poster']), mix: undefined })).toContain('a line with products needs a mix')
    expect(problems({ ...shop(['poster']), stations: shop(['poster']).stations.map((s, i) => (i === 1 ? { ...s, servers: 2 } : s)) })).toContain(
      'print: give machines or servers, not both',
    )
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
