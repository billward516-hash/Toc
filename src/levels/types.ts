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

// The only changes a player may make in a level. Each lever applies to one station the player picks.
export type Lever =
  | { id: string; kind: 'upgrade'; label: string; stations: string[]; factor: number }
  | { id: string; kind: 'coverBreak'; label: string; stations: string[] }

// Lever id -> chosen station id.
export type Choices = Record<string, string>

export type Trigger =
  | { kind: 'answered'; correct: true }
  | { kind: 'answered'; correct: false; station?: string }
  | { kind: 'ran'; met: boolean; choices?: Choices }

export interface Popup {
  trigger: Trigger
  title: string
  body: string
}
