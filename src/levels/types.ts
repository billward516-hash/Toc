import type { FactoryModel } from '../engine/model.ts'

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

// The only changes a player may make in a level.
export type Lever =
  | { id: string; kind: 'upgrade'; label: string; stations: string[]; factor: number }
  | { id: string; kind: 'coverBreak'; label: string; stations: string[] }
  | { id: string; kind: 'steady'; label: string; stations: string[] }
  | { id: string; kind: 'releasePace'; label: string; every: number[] }

// Lever id -> chosen value: a station id, or for releasePace the interval in minutes.
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
