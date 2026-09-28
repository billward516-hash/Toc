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
  popups: Popup[]
}

export type Goal = { kind: 'identifyBottleneck'; answer: string }

export type Trigger = { kind: 'answered'; correct: true } | { kind: 'answered'; correct: false; station?: string }

export interface Popup {
  trigger: Trigger
  title: string
  body: string
}
