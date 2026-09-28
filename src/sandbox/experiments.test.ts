import { describe, expect, it } from 'vitest'
import { validateModel } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { EXPERIMENTS } from './experiments.ts'
import { changeStation, cleanSetup, sandboxModel, slowest, type SandboxSetup } from './setup.ts'

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
const run = (setup: SandboxSetup) => DAYS.map((day) => simulate(sandboxModel(setup), day))
const setupOf = (id: string) => EXPERIMENTS.find((e) => e.id === id)!.setup
const withRope = (setup: SandboxSetup, station: number, length: number): SandboxSetup => ({ ...setup, release: { kind: 'rope', station, length } })
// The station with the biggest pile on average over the shift.
const biggestPile = (day: SimResult) => day.stations.reduce((best, s, i) => (s.avgQueue > day.stations[best].avgQueue ? i : best), 0)

describe('things to try in free play', () => {
  it('each sets up a valid line that could have been built by hand', () => {
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(EXPERIMENTS.length)
    for (const { setup } of EXPERIMENTS) {
      expect(validateModel(sandboxModel(setup))).toEqual([])
      expect(cleanSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup)
    }
  })

  it('where does the work pile up: in front of the slowest station, and a rope there keeps the output', () => {
    const setup = setupOf('pile')
    const busy = run(setup)
    const rope = run(withRope(setup, slowest(setup), 10))
    busy.forEach((day, i) => {
      expect(biggestPile(day)).toBe(slowest(setup))
      expect(rope[i].output).toBe(day.output)
      expect(rope[i].avgWip).toBeLessThan(day.avgWip / 1.5)
    })
  })

  it('the perfect line: the same averages with lots of variation ship fewer, every day', () => {
    const setup = setupOf('perfect')
    const perfect = run(setup)
    const lots = run({ ...setup, stations: setup.stations.map((s) => ({ ...s, variation: 'lots' })) })
    lots.forEach((day, i) => expect(day.output).toBeLessThan(perfect[i].output))
  })

  it("which jams cost robots: Cut's cost none, and the same jams at Paint cost several", () => {
    const setup = setupOf('jams')
    const atCut = run(setup)
    const none = run(changeStation(setup, 0, { jams: false }))
    const atPaint = run(changeStation(changeStation(setup, 0, { jams: false }), 2, { jams: true }))
    atCut.forEach((day, i) => {
      expect(day.output).toBe(none[i].output)
      expect(atPaint[i].output).toBeLessThan(day.output - 5)
    })
  })

  it('the next constraint: a second Paint machine ships more, the pile moves to Assemble, and so should the rope', () => {
    const setup = setupOf('next')
    expect(slowest(setup)).toBe(2)
    const before = run(setup)
    const twoPaint = changeStation(setup, 2, { machines: 2 })
    expect(slowest(twoPaint)).toBe(3)
    const after = run(twoPaint)
    const moved = run(withRope(twoPaint, 3, 10))
    after.forEach((day, i) => {
      expect(day.output).toBeGreaterThan(before[i].output + 10)
      expect(biggestPile(day)).toBe(3)
      expect(moved[i].output).toBe(day.output)
      expect(moved[i].avgWip).toBeLessThan(day.avgWip / 1.5)
    })
  })

  it('how long a rope: 2 starves Paint, 10 keeps it busy, and 20 only adds robots on the floor', () => {
    const setup = setupOf('rope')
    const [two, ten, twenty] = [2, 10, 20].map((length) => run(withRope(setup, 2, length)))
    ten.forEach((day, i) => {
      expect(two[i].output).toBeLessThan(day.output - 10)
      expect(twenty[i].output).toBe(day.output)
      expect(twenty[i].avgWip).toBeGreaterThan(day.avgWip + 5)
    })
  })
})
