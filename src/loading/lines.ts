import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import { STEPS } from '../sandbox/setup.ts'

// The loading lab: one line, loaded with more or fewer orders, to see what load does to cycle time.
// A "day" is three shifts, long enough for a line near its limit to show what it does to the queues.
export const DAY = 1440

// Work times swing a lot from robot to robot (from a quarter to 1.75 times the average, as in Tier 2),
// and orders arrive unevenly. Both are why queues form before a station is fully busy.
export const SPREAD = 0.75
export const ARRIVAL_SPREAD = 0.9

// An upgraded station works this much faster (0.6: in three-fifths of the time).
export const UPGRADE = 0.6

// Orders per hour the dial can ask for.
export const RATES = { min: 6, max: 24, step: 1 }

// A station is a bottleneck when its pace is within this share of the slowest station's: close enough
// that it will hold the line back some of the time, and queues up work in front of it.
export const NEAR = 0.1

export type Upgrades = readonly boolean[]

export const noUpgrades = (minutes: readonly number[]): boolean[] => minutes.map(() => false)

// Average minutes each station takes per robot once upgrades are in.
export function paces(minutes: readonly number[], upgraded: Upgrades = []): number[] {
  return minutes.map((m, i) => (upgraded[i] ? m * UPGRADE : m))
}

export function varied(minutes: number): Dist {
  return { kind: 'uniform', min: minutes * (1 - SPREAD), max: minutes * (1 + SPREAD) }
}

// The line at `rate` orders an hour. Orders come one at a time, a gap between them drawn at random
// around 60 / rate minutes.
export function labModel(minutes: readonly number[], upgraded: Upgrades, rate: number): FactoryModel {
  const gap = 60 / rate
  return {
    stations: paces(minutes, upgraded).map((m, i) => ({ ...STEPS[i], cycleTime: varied(m) })),
    release: { kind: 'interval', every: { kind: 'uniform', min: gap * (1 - ARRIVAL_SPREAD), max: gap * (1 + ARRIVAL_SPREAD) } },
    horizon: DAY,
  }
}

// Robots an hour the line can make at most: the slowest station's pace.
export function capacityPerHour(minutes: readonly number[], upgraded: Upgrades = []): number {
  return 60 / Math.max(...paces(minutes, upgraded))
}

// The share of the bottleneck's capacity an order rate asks for: 1 is exactly what it can make.
export function loadShare(minutes: readonly number[], upgraded: Upgrades, rate: number): number {
  return rate / capacityPerHour(minutes, upgraded)
}

// The stations that hold the line back: the slowest, and any within NEAR of its pace.
export function bottlenecks(minutes: readonly number[], upgraded: Upgrades = []): number[] {
  const pace = paces(minutes, upgraded)
  const slowest = Math.max(...pace)
  return pace.flatMap((m, i) => (m >= slowest * (1 - NEAR) ? [i] : []))
}

// Minutes of actual work on one robot, start to finish: what a cycle would take with no waiting at all.
export function workTime(minutes: readonly number[], upgraded: Upgrades = []): number {
  return paces(minutes, upgraded).reduce((sum, m) => sum + m, 0)
}
