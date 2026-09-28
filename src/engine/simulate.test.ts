import { describe, expect, it } from 'vitest'
import type { Dist } from './distributions.ts'
import { capacity, validateModel, type FactoryModel, type Market, type Release } from './model.ts'
import { runBatch, simulate, type SimResult } from './simulate.ts'
import { bufferZones, snapshotAt, steadyShare } from './timeline.ts'

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

describe('changeovers, lots, and carts', () => {
  // Orange and ocean candles alternate; Melt takes 2 minutes a candle and 3 to switch scents.
  const workshop = (changes: Partial<FactoryModel> = {}, melt: Partial<FactoryModel['stations'][number]> = {}): FactoryModel => ({
    products: [
      { id: 'orange', name: 'Orange' },
      { id: 'ocean', name: 'Ocean' },
    ],
    mix: ['orange', 'ocean'],
    stations: [
      { id: 'melt', name: 'Melt', cycleTime: fixed(2), changeover: fixed(3), ...melt },
      { id: 'pack', name: 'Pack', cycleTime: fixed(1) },
    ],
    release: { kind: 'saturate' },
    horizon: 60,
    ...changes,
  })
  const starts = (result: SimResult, station: number) =>
    result.events.flatMap((e) => (e.type === 'start' && e.station === station ? [e] : []))

  it('spends a changeover whenever a machine switches products, and not otherwise', () => {
    const alternating = simulate(workshop(), 1)
    const [first, second] = starts(alternating, 0)
    expect(first.ready).toBeUndefined()
    expect(second.ready! - second.t).toBe(3)
    expect(second.end - second.ready!).toBe(2)
    // Every candle after the first costs 5 minutes: 12 finished in the hour, and 12 changeovers,
    // the last from 57 to 60.
    expect(alternating.stations[0].completed).toBe(12)
    expect(alternating.stations[0].changeoverTime).toBe(36)
    const runs = simulate(workshop({ mix: ['orange', 'orange', 'orange', 'orange', 'ocean', 'ocean', 'ocean', 'ocean'] }), 1)
    expect(runs.stations[0].completed).toBeGreaterThan(alternating.stations[0].completed)
    expect(simulate(workshop({}, { changeover: undefined }), 1).stations[0].changeoverTime).toBe(0)
  })

  it('brings a whole lot at each release', () => {
    const result = simulate(workshop({ release: { kind: 'interval', every: fixed(10), lot: 3 } }), 1)
    const releases = result.events.flatMap((e) => (e.type === 'release' ? [e.t] : []))
    expect(releases.slice(0, 7)).toEqual([0, 0, 0, 10, 10, 10, 20])
  })

  it('moves finished work in carts: when full, or when the last unit of a lot is done', () => {
    const carted = simulate(workshop({}, { transfer: 3, changeover: undefined }), 1)
    const moves = carted.events.flatMap((e) => (e.type === 'move' ? [e] : []))
    expect(moves.every((m) => m.jobs.length === 3)).toBe(true)
    expect(carted.stations[0].transfer).toBe(3)
    const lots = simulate(workshop({ release: { kind: 'interval', every: fixed(20), lot: 4 } }, { transfer: 10, changeover: undefined }), 1)
    const lotMoves = lots.events.flatMap((e) => (e.type === 'move' ? [e.jobs] : []))
    expect(lotMoves.slice(0, 2)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ])
  })

  it('accounts for every unit, carts included, and counts piles only once work arrives', () => {
    const lots = { release: { kind: 'interval', every: fixed(9), lot: 4 } } as const
    const carted = simulate(workshop(lots, { transfer: 4, changeover: undefined }), 2)
    for (const t of [0, 7.5, 20, 41, 60]) {
      const snap = snapshotAt(carted, t)
      const held = [...snap.queues, ...snap.carts.map((c) => c.length), ...snap.working.map((w) => w.length)].reduce((a, b) => a + b, 0)
      expect(held + snap.shipped).toBe(snap.released)
    }
    // Carted, Pack's pile jumps by a whole cart: 4 arrive, Pack starts one at once, and 3 wait.
    // Moved one at a time, Pack never has more than one waiting.
    const loose = simulate(workshop(lots, { changeover: undefined }), 2)
    expect(bufferZones(carted, 1, 0, 2).some((z) => z.zone === 'flooding')).toBe(true)
    expect(bufferZones(loose, 1, 0, 2).some((z) => z.zone === 'flooding')).toBe(false)
    expect(steadyShare(carted, 3)).toBeLessThan(steadyShare(loose, 3))
  })

  it('rejects impossible settings', () => {
    expect(validateModel(workshop({ release: { kind: 'interval', every: fixed(5), lot: 0 } }))).toContain('release: lot must be a positive integer')
    expect(validateModel(workshop({}, { transfer: 1.5 }))).toContain('melt: transfer must be a positive integer')
    expect(validateModel(workshop({}, { changeover: fixed(0) }))[0]).toMatch(/melt: changeover/)
  })
})

describe('priorities', () => {
  // Orders for one cake and three cupcakes arrive faster than the oven can bake them all.
  const bakery = (priority?: string[]): FactoryModel => ({
    products: [
      { id: 'cake', name: 'Cake' },
      { id: 'cupcake', name: 'Cupcake' },
    ],
    mix: ['cake', 'cupcake', 'cupcake', 'cupcake'],
    stations: [
      { id: 'mix', name: 'Mix', cycleTime: fixed(0.5) },
      { id: 'bake', name: 'Bake', cycleTime: fixed(2), times: { cake: fixed(10) }, priority },
      { id: 'box', name: 'Box', cycleTime: fixed(0.5) },
    ],
    release: { kind: 'interval', every: fixed(1.5) },
    horizon: 120,
  })

  it('works on the first-priority product whenever one is waiting', () => {
    const result = simulate(bakery(['cupcake']), 1)
    const starts = result.events.flatMap((e) => (e.type === 'start' && e.station === 1 ? [e] : []))
    for (const start of starts) {
      const waiting = snapshotAt(result, start.t - 1e-9).waiting[1]
      if (waiting.some((job) => result.products![job] === 'cupcake')) expect(result.products![start.job]).toBe('cupcake')
    }
  })

  it('counts what shipped of each product, and the priority changes the mix', () => {
    const first = simulate(bakery(['cupcake']), 1)
    const fifo = simulate(bakery(), 1)
    const cakes = simulate(bakery(['cake']), 1)
    for (const result of [first, fifo, cakes]) {
      expect(Object.values(result.shippedBy!).reduce((a, b) => a + b, 0)).toBe(result.output)
    }
    expect(first.shippedBy!.cupcake).toBeGreaterThan(fifo.shippedBy!.cupcake)
    expect(cakes.shippedBy!.cake).toBeGreaterThan(fifo.shippedBy!.cake)
    expect(simulate(line([fixed(1)]), 1).shippedBy).toBeUndefined()
    expect(validateModel(bakery(['pie']))).toContain('bake: priority names unknown product "pie"')
  })
})

describe('long breakdowns', () => {
  const broken: FactoryModel = {
    ...line([fixed(2), fixed(3)]),
    stations: [
      { id: 's0', name: 'Station 0', cycleTime: fixed(2) },
      { id: 's1', name: 'Station 1', cycleTime: fixed(3), outages: [{ at: fixed(20), lasts: fixed(30) }] },
    ],
  }
  const result = simulate(broken, 1)

  it('stops the station for the whole breakdown, then starts it again', () => {
    expect(result.events).toContainEqual({ t: 20, type: 'jam', station: 1, until: 50, outage: true })
    const starts = result.events.filter((e) => e.type === 'start' && e.station === 1).map((e) => e.t)
    expect(starts.filter((t) => t > 20 && t < 50)).toEqual([])
    expect(starts).toContain(50)
    expect(result.output).toBeLessThan(simulate(line([fixed(2), fixed(3)]), 1).output - 8)
  })

  it('stops several stations at the same moment in an incident', () => {
    const surge: FactoryModel = {
      ...line([fixed(2), fixed(3), fixed(1)]),
      incidents: [{ at: uniform(10, 40), outages: [{ station: 's0', lasts: fixed(5) }, { station: 's2', lasts: fixed(15) }] }],
    }
    const stops = simulate(surge, 4).events.filter((e) => e.type === 'jam')
    expect(stops).toHaveLength(2)
    expect(stops[0].t).toBe(stops[1].t)
    expect(stops.map((e) => e.type === 'jam' && e.until - e.t)).toEqual([5, 15])
    expect(validateModel({ ...surge, incidents: [{ at: fixed(5), outages: [{ station: 'glue', lasts: fixed(5) }] }] })).toEqual(['incident: unknown station "glue"'])
  })

  it('counts the breakdown in capacity', () => {
    expect(capacity(broken.stations[1], 100)).toBeCloseTo(70 / 3, 10)
  })

  it('shows the breakdown and when it ends', () => {
    expect(snapshotAt(result, 30).brokenUntil).toEqual([null, 50])
    expect(snapshotAt(result, 30).jammed).toEqual([false, true])
    expect(snapshotAt(result, 60).brokenUntil).toEqual([null, null])
  })
})

describe('direct materials', () => {
  const supplied: FactoryModel = {
    ...line([fixed(1), fixed(1)], { kind: 'saturate' }, 60),
    supply: { onHand: 5, deliveries: [{ due: 20, amount: 10 }, { due: 40, amount: 10, late: fixed(10) }] },
  }
  const result = simulate(supplied, 1)

  it('starts work only with material on hand, and waits for late deliveries', () => {
    expect(result.events.filter((e) => e.type === 'delivery')).toEqual([
      { t: 20, type: 'delivery', amount: 10, due: 20 },
      { t: 50, type: 'delivery', amount: 10, due: 40 },
    ])
    const starts = result.events.filter((e) => e.type === 'start' && e.station === 0).map((e) => e.t)
    expect(starts).toEqual([0, 1, 2, 3, 4, ...Array.from({ length: 10 }, (_, k) => 20 + k), ...Array.from({ length: 10 }, (_, k) => 50 + k)])
    expect(result.released).toBe(25)
    expect(result.output).toBe(24)
  })

  it('tracks the stockroom over the shift', () => {
    // 4 + 3 + 2 + 1 after the first starts, then 9 down to 1 after each delivery.
    expect(result.supply?.onHand).toBe(5)
    expect(result.supply?.avgStock).toBeCloseTo(100 / 60, 10)
    expect(snapshotAt(result, 10)).toMatchObject({ stock: 0, deliveries: 0 })
    expect(snapshotAt(result, 25)).toMatchObject({ stock: 4, deliveries: 1 })
  })
})

describe('defects and scrap', () => {
  const withDefects = (defects: number, inspect: number | null, release: Release = { kind: 'saturate' }): FactoryModel => ({
    ...line([fixed(1), fixed(2), fixed(1)], release, 100),
    stations: [fixed(1), fixed(2), fixed(1)].map((cycleTime, i) => ({
      id: `s${i}`,
      name: `Station ${i}`,
      cycleTime,
      ...(i === 0 ? { defects } : {}),
      ...(i === inspect ? { inspects: true } : {}),
    })),
  })

  it('scraps defective units where the line inspects, after they used every station on the way', () => {
    const all = simulate(withDefects(1, 2), 1)
    expect(all.output).toBe(0)
    expect(all.scrapped).toBe(all.stations[2].completed)
    expect(all.stations[1].completed).toBeGreaterThan(40)
    expect(snapshotAt(all, 100).scrapped).toEqual([0, 0, all.scrapped])
  })

  it('never passes a scrapped unit on, and ships defective units nobody checks', () => {
    const half = simulate(withDefects(0.5, 1), 3)
    const end = snapshotAt(half, 100)
    const inProcess = end.queues.reduce((a, b) => a + b, 0) + end.working.reduce((a, w) => a + w.length, 0)
    expect(half.scrapped).toBeGreaterThan(10)
    expect(half.scrapped! + half.output + inProcess).toBe(half.released)
    expect(half.stations[2].completed).toBe(half.output)
    const unchecked = simulate(withDefects(1, null), 1)
    expect(unchecked.escaped).toBe(unchecked.output)
  })

  it('keeps the rope pulling when work is scrapped before the constraint', () => {
    const roped = simulate(withDefects(1, 0, { kind: 'rope', constraint: 's2', buffer: 3 }), 1)
    expect(roped.released).toBeGreaterThan(50)
    expect(roped.output).toBe(0)
  })
})

describe('changing orders', () => {
  const two = (changes: Partial<FactoryModel>, station: Partial<FactoryModel['stations'][number]> = {}): FactoryModel => ({
    products: [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ],
    mix: ['a', 'b'],
    stations: [{ id: 's0', name: 'Station 0', cycleTime: fixed(2), ...station }],
    release: { kind: 'interval', every: fixed(1) },
    horizon: 60,
    ...changes,
  })

  it('switches the order pattern at a mix change', () => {
    const result = simulate(two({ mix: ['a'], mixChanges: [{ at: 10, mix: ['b'] }] }), 1)
    const released = result.events.filter((e) => e.type === 'release').map((e) => [e.t, result.products![e.job]])
    expect(released.filter(([t]) => (t as number) < 10).every(([, p]) => p === 'a')).toBe(true)
    expect(released.filter(([t]) => (t as number) >= 10).every(([, p]) => p === 'b')).toBe(true)
  })

  it('changes a station\'s priorities during the shift', () => {
    const result = simulate(two({}, { priority: ['a'], priorityChanges: [{ at: 30, order: ['b'] }] }), 1)
    const started = result.events.filter((e) => e.type === 'start').map((e) => [e.t, result.products![e.job]])
    expect(started.filter(([t]) => (t as number) > 2 && (t as number) < 30).every(([, p]) => p === 'a')).toBe(true)
    expect(started.filter(([t]) => (t as number) >= 30).every(([, p]) => p === 'b')).toBe(true)
  })

  it('keeps running the same product while any is waiting, where the station keeps products together', () => {
    const colors = (keepProduct: boolean) =>
      simulate(two({ release: { kind: 'interval', every: fixed(1) } }, { keepProduct, changeover: fixed(3) }), 1).stations[0].changeoverTime
    // Alternating orders: a changeover before almost every job, or only when one product runs out
    // (here once, at the start, before the queue builds up).
    expect(colors(false)).toBeGreaterThanOrEqual(30)
    expect(colors(true)).toBe(3)
  })

  it('releases rush orders on top of the flow, and lets them jump the queue only where the station expedites', () => {
    const rush = (expedite: boolean) => simulate(two({ rush: [{ at: 10, count: 2, product: 'b' }] }, { expedite }), 1)
    const expedited = rush(true)
    expect(expedited.rush).toHaveLength(2)
    expect(expedited.events.filter((e) => e.type === 'release' && e.rush).map((e) => e.t)).toEqual([10, 10])
    const firstAfter = (result: SimResult) => result.events.find((e) => e.type === 'start' && e.t >= 10)
    expect(expedited.rush).toContain(firstAfter(expedited)!.type === 'start' && (firstAfter(expedited) as { job: number }).job)
    expect(rush(false).rush).not.toContain((firstAfter(rush(false)) as { job: number }).job)
  })

  it('rejects impossible disruptions', () => {
    const broken: FactoryModel = {
      ...two({ mixChanges: [{ at: -1, mix: ['c'] }], rush: [{ at: 5, count: 0 }], supply: { onHand: -1, deliveries: [{ due: 5, amount: 0 }] } }),
      stations: [{ id: 's0', name: 'Station 0', cycleTime: fixed(2), defects: 2, outages: [{ at: fixed(-5), lasts: fixed(10) }] }],
    }
    expect(validateModel(broken)).toEqual([
      's0: outage: fixed time must be positive',
      's0: defects must be a chance from 0 to 1',
      'a mix change needs a time of at least 0',
      'mix change: unknown product "c"',
      'a rush order needs a time of at least 0 and a positive whole count',
      'supply: on hand must be a whole number of at least 0',
      'supply: a delivery needs a due time of at least 0 and a positive whole amount',
    ])
  })
})

describe('the shop counter', () => {
  const shop = (release: Release, market: Partial<Market> = {}, extra: Partial<FactoryModel> = {}): FactoryModel => ({
    ...line([fixed(1), fixed(2)], release, 300),
    market: { customers: fixed(40), opens: 100, closes: 300, ...market },
    ...extra,
  })
  const customerTimes = (result: SimResult) => result.events.flatMap((e) => (e.type === 'sale' || e.type === 'lost' ? [e.t] : []))

  it('makes the planned number, as fast as the first station takes them', () => {
    const result = simulate(line([fixed(1), fixed(2)], { kind: 'plan', quantity: 10 }, 100), 1)
    expect(result.released).toBe(10)
    expect(result.output).toBe(10)
    expect(result.events.filter((e) => e.type === 'release').map((e) => e.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('sells what was made, turns customers away once it runs out, and throws out the rest', () => {
    // Everything is made by 2:00, before the shop opens.
    expect(simulate(shop({ kind: 'plan', quantity: 30 }), 1).market).toEqual({ customers: 40, sold: 30, lost: 10, waste: 0 })
    expect(simulate(shop({ kind: 'plan', quantity: 50 }), 1).market).toEqual({ customers: 40, sold: 40, lost: 0, waste: 10 })
  })

  it('brings the same customers at the same times whatever the plan, and others on another day', () => {
    const times = customerTimes(simulate(shop({ kind: 'plan', quantity: 5 }, { customers: uniform(20, 60) }), 3))
    expect(times.length).toBeGreaterThanOrEqual(20)
    expect(times.every((t) => t >= 100 && t < 300)).toBe(true)
    expect(customerTimes(simulate(shop({ kind: 'replenish', target: 4 }, { customers: uniform(20, 60) }), 3))).toEqual(times)
    expect(customerTimes(simulate(shop({ kind: 'plan', quantity: 5 }, { customers: uniform(20, 60) }), 4))).not.toEqual(times)
  })

  it('replaces each unit sold, keeping the target on the shelf or on the way', () => {
    const result = simulate(shop({ kind: 'replenish', target: 6 }), 2)
    const day = result.market!
    expect(day.lost).toBe(0)
    expect(result.released).toBe(6 + day.sold)
    for (const t of [50, 150, 250]) {
      const snapshot = snapshotAt(result, t)
      expect(snapshot.shop!.shelf + snapshot.released - snapshot.shipped).toBe(6)
    }
    expect(day.waste).toBeLessThanOrEqual(6)
    expect(day.waste).toBeGreaterThanOrEqual(5)
  })

  it('stops replacing what sells at the set time', () => {
    const result = simulate(shop({ kind: 'replenish', target: 6, until: 200 }), 2)
    expect(result.events.filter((e) => e.type === 'release').every((e) => e.t < 200)).toBe(true)
    expect(result.market!.waste).toBeLessThan(simulate(shop({ kind: 'replenish', target: 6 }), 2).market!.waste)
  })

  it('brings a share of the customers in a busy spell', () => {
    const times = customerTimes(simulate(shop({ kind: 'plan', quantity: 50 }, { rush: { from: 150, to: 180, share: 0.5 } }), 1))
    expect(times.filter((t) => t >= 150 && t < 180).length).toBeGreaterThanOrEqual(20)
  })

  it('sells each customer only what they want', () => {
    const flavors: Partial<FactoryModel> = {
      products: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      mix: ['a'],
      stations: [{ id: 's0', name: 'Station 0', cycleTime: fixed(0.2) }],
    }
    // All 400 are made by 1:20, before the shop opens.
    const result = simulate(shop({ kind: 'plan', quantity: 400 }, { customers: fixed(400), wants: { a: fixed(3), b: fixed(1) } }, flavors), 1)
    const day = result.market!
    expect(day.wantedBy!.a + day.wantedBy!.b).toBe(400)
    expect(day.wantedBy!.a).toBeGreaterThan(260)
    expect(day.wantedBy!.a).toBeLessThan(340)
    // Only A is made, so every customer who wants B leaves without buying.
    expect(day.lostBy!.b).toBe(day.wantedBy!.b)
    expect(day.soldBy).toEqual({ a: day.wantedBy!.a })
    expect(day.wasteBy).toEqual({ a: 400 - day.wantedBy!.a })
    const end = snapshotAt(result, 300).shop!
    expect(end).toEqual({ shelf: 400 - day.sold, shelfBy: { a: 400 - day.sold }, sold: day.sold, lost: day.lost })
  })

  it('shows the shelf and the customers so far', () => {
    const result = simulate(shop({ kind: 'plan', quantity: 30 }), 1)
    expect(snapshotAt(result, 50).shop).toEqual({ shelf: 24, sold: 0, lost: 0 })
    const end = snapshotAt(result, 300).shop!
    expect(end).toEqual({ shelf: 0, sold: 30, lost: 10 })
    expect(simulate(line([fixed(1)]), 1).market).toBeUndefined()
    expect(snapshotAt(simulate(line([fixed(1)]), 1), 50).shop).toBeUndefined()
  })

  it('rejects impossible shops', () => {
    expect(validateModel(shop({ kind: 'plan', quantity: -1 }, { opens: 200, closes: 400, rush: { from: 100, to: 150, share: 2 } }))).toEqual([
      'plan: quantity must be a whole number of at least 0',
      'market: needs 0 <= opens < closes <= horizon',
      'market: a rush needs opens <= from < to <= closes and a share from 0 to 1',
    ])
    expect(validateModel({ ...line([fixed(1)]), release: { kind: 'replenish', target: 0 } })).toEqual([
      'replenish: needs a market',
      'replenish: target must be a positive integer',
    ])
    const flavors: Partial<FactoryModel> = { products: [{ id: 'a', name: 'A' }], mix: ['a'] }
    expect(validateModel(shop({ kind: 'plan', quantity: 5 }, {}, flavors))).toEqual(['market: a line with products needs wants'])
    expect(validateModel(shop({ kind: 'plan', quantity: 5 }, { wants: { a: fixed(1), z: fixed(0) } }, flavors))).toEqual([
      'market: wants unknown product "z"',
      'market: wants z: fixed time must be positive',
    ])
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
