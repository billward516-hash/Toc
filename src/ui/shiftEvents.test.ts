import { describe, expect, it } from 'vitest'
import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import { simulate } from '../engine/simulate.ts'
import { describeEvent, problemStops } from './shiftEvents.ts'

const fixed = (value: number): Dist => ({ kind: 'fixed', value })
const line = (extra: Partial<FactoryModel> = {}): FactoryModel => ({
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: fixed(1) },
    { id: 'paint', name: 'Paint', cycleTime: fixed(2) },
  ],
  release: { kind: 'rope', constraint: 'paint', buffer: 3 },
  horizon: 120,
  ...extra,
})

describe('problemStops', () => {
  it('stops at a breakdown, once for an incident that stops several stations', () => {
    const cut = line({ incidents: [{ name: 'Power cut', at: fixed(30), outages: [{ station: 'cut', lasts: fixed(10) }, { station: 'paint', lasts: fixed(10) }] }] })
    expect(problemStops(cut, simulate(cut, 1), 'robots')).toEqual([{ at: 30, why: 'Power cut' }])
    const broken = line({ stations: [{ id: 'cut', name: 'Cut', cycleTime: fixed(1), outages: [{ at: fixed(20), lasts: fixed(5) }] }, { id: 'paint', name: 'Paint', cycleTime: fixed(2) }] })
    expect(problemStops(broken, simulate(broken, 1), 'robots')).toEqual([{ at: 20, why: 'Cut broke down' }])
  })

  it('stops when the stockroom runs out and when a truck is late', () => {
    const supplied = line({ supply: { name: 'plastic', onHand: 5, deliveries: [{ due: 40, amount: 5, late: fixed(10) }] } })
    const stops = problemStops(supplied, simulate(supplied, 1), 'robots')
    expect(stops.map((stop) => stop.why)).toEqual(['Out of plastic', 'The truck due at 0:40 is late', 'Out of plastic'])
    expect(stops[1].at).toBe(40)
  })

  it('stops at the first customer turned away in each stretch', () => {
    const shop = line({ release: { kind: 'plan', quantity: 5 }, market: { customers: fixed(20), opens: 20, closes: 120 } })
    const stops = problemStops(shop, simulate(shop, 1), 'cupcakes')
    expect(stops).toHaveLength(1)
    expect(stops[0].why).toBe('Out of cupcakes: a customer left without one')
  })

  it("stops when a buffer runs dry after it has filled, but not while it's first filling", () => {
    const starved = line({
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: fixed(1), outages: [{ at: fixed(40), lasts: fixed(30) }] },
        { id: 'paint', name: 'Paint', cycleTime: fixed(2) },
      ],
    })
    const stops = problemStops(starved, simulate(starved, 1), 'robots', { station: 1, low: 1, high: 3 })
    expect(stops.map((stop) => stop.why)).toEqual(['Cut broke down', "Paint's buffer ran dry"])
    expect(stops[1].at).toBeGreaterThan(40)
  })
})

describe('describeEvent', () => {
  it('says what happened in plain words', () => {
    const model = line()
    const result = simulate(model, 1)
    const words = result.events.slice(0, 3).map((event) => describeEvent(model, result, event, 'robots'))
    expect(words).toEqual(['Robot #1 released', 'Cut starts robot #1', 'Robot #2 released'])
    const shipped = result.events.find((e) => e.type === 'finish' && e.station === 1)!
    expect(describeEvent(model, result, shipped, 'robots')).toBe('Paint finished robot #1: shipped')
  })
})
