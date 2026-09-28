import type { FactoryModel, Machine } from '../engine/model.ts'

export interface Level {
  id: string
  tier: number
  title: string
  principles: number[]
  requires: string[]
  briefing: string
  model: FactoryModel
  seed: number
  goal: Goal
  levers: Lever[]
  popups: Popup[]
}

export type Goal =
  | { kind: 'identifyBottleneck'; answer: string; prompt: string; watchMinutes: number }
  | { kind: 'output'; target: number; prompt: string }
  // Steady flow: no station holds `pileLimit` or more waiting parts for at least `minSteady` of the shift.
  | { kind: 'steady'; pileLimit: number; minSteady: number; minShipped: number; prompt: string }
  // Watch a steady twin of the line, predict how the real (varying) line compares, then run it.
  | { kind: 'predict'; prompt: string; options: { id: string; label: string }[]; answer: string }
  // Drum-buffer-rope. One star: the pile in front of the drum stays within [low, high] for at least
  // `minHealthy` of the shift. Two: also average work in process at or under `maxAvgWip`.
  // Three: both hold on `freshDays` more days the player hasn't seen.
  | { kind: 'buffer'; drum: string; low: number; high: number; minHealthy: number; maxAvgWip: number; freshDays: number; prompt: string }
  // Batches and flow (spec §5.3–5.4). One star: at least `target` shipped. Two: also an average lead
  // time (order in to shipped) of `maxLeadTime` minutes or less. Three: both again on `freshDays` more days.
  | { kind: 'flow'; target: number; maxLeadTime: number; freshDays: number; prompt: string }
  // Product mix (spec §5.3–5.5). Throughput is sales minus ingredients; profit is throughput minus the
  // shift's operating expense, which stays the same whatever gets made. Judged on the level's own day
  // and `freshDays` more. One star: profit of at least `target` every day. Two: also at least
  // `minShipped` shipped every day. Three: also average inventory, valued at ingredient cost, of at most
  // `maxInventory` every day.
  | {
      kind: 'profit'
      economics: Record<string, Economics>
      expense: number
      target: number
      minShipped: number
      maxInventory: number
      freshDays: number
      prompt: string
    }
  // Elevating the constraint, judged on the level's own day and `freshDays` more (spec §5.4). One star:
  // at least `target` shipped every day. Two: also steady every day (no pile of `pileLimit` or more for
  // at least `minSteady` of the shift). Three: also at least `minGainPer1000` more shipped on the
  // level's own day for every $1,000 spent; a free plan always clears it.
  | {
      kind: 'elevate'
      target: number
      pileLimit: number
      minSteady: number
      minGainPer1000: number
      freshDays: number
      prompt: string
    }

// The only changes a player may make in a level.
export type Lever =
  | { id: string; kind: 'upgrade'; label: string; stations: string[]; factor: number }
  | { id: string; kind: 'coverBreak'; label: string; stations: string[] }
  | { id: string; kind: 'steady'; label: string; stations: string[] }
  | { id: string; kind: 'maintain'; label: string; stations: string[] }
  | { id: string; kind: 'releasePace'; label: string; every: number[] }
  | { id: string; kind: 'ropeTo'; label: string; stations: string[]; length: number }
  | { id: string; kind: 'ropeLength'; label: string; lengths: number[] }
  // Which products one named machine may run; an option without products lets it run every one.
  | { id: string; kind: 'machineRule'; label: string; station: string; machine: string; options: RuleOption[] }
  // Buy one of these machines, or none.
  | { id: string; kind: 'buy'; label: string; options: Purchase[] }
  // Orders arrive in lots of one product, the same number of units a shift on average.
  | { id: string; kind: 'lotSize'; label: string; sizes: number[] }
  // Cut the changeover time at one station.
  | { id: string; kind: 'quickChange'; label: string; stations: string[]; factor: number }
  // Every station sends finished work on this many at a time.
  | { id: string; kind: 'transferSize'; label: string; sizes: number[] }
  // Which product a station works on first; an option without an order works oldest first.
  | { id: string; kind: 'priority'; label: string; station: string; options: PriorityOption[] }
  // What the shop sells: each option sets the order pattern and how often an order comes in.
  | { id: string; kind: 'menu'; label: string; options: MenuOption[] }

export interface Economics {
  price: number
  materials: number
}

export interface MenuOption {
  id: string
  label: string
  mix: string[]
  every: number
}

export interface PriorityOption {
  id: string
  label: string
  order?: string[]
}

export interface RuleOption {
  id: string
  label: string
  products?: string[]
}

export interface Purchase {
  id: string
  label: string
  station: string
  machine: Machine
  price: number
}

// Lever id -> chosen value: a station id, a number of minutes or robots, or an option id ('none' for no purchase).
export type Choices = Record<string, string>

export type Trigger =
  | { kind: 'answered'; correct: true }
  | { kind: 'answered'; correct: false; station?: string }
  | { kind: 'ran'; met: boolean; choices?: Choices }
  | { kind: 'predicted'; option: string }

export interface Popup {
  trigger: Trigger
  title: string
  body: string
}
