import type { SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
import { bufferScore, profitScore, readBar } from '../levels/graph.ts'
import type { Goal } from '../levels/types.ts'
import { tenths } from '../levels/values.ts'
import { barMeasure, type Words } from './barTexts.ts'

export type PlanGoal = Extract<Goal, { kind: 'output' | 'steady' | 'buffer' | 'elevate' | 'flow' | 'profit' | 'bars' }>

// One measure of a plan on the level's own day, and whether it cleared the goal's bar there (no
// verdict for a measure with no bar, such as money spent on an elevate level).
export interface Cell {
  text: string
  ok?: boolean
}

export interface Column {
  label: string
  read: (day: SimResult, spend: number) => Cell
}

const percent = (share: number) => `${Math.floor(100 * share)}%`
const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`
const money = (amount: number) => (Math.round(amount) < 0 ? '−' : '') + dollars(Math.abs(Math.round(amount)))
const minutes = (value: number | null) => (value === null ? '–' : `${Math.round(value)} min`)

// The measures a level judges plans by, as columns.
export function columnsFor(goal: PlanGoal, words: Words, baseline: SimResult): Column[] {
  const shipped = (min: number): Column => ({ label: 'Shipped', read: (day) => ({ text: String(day.output), ok: day.output >= min }) })
  switch (goal.kind) {
    case 'output':
      return [shipped(goal.target)]
    case 'steady':
      return [
        { label: 'Steady', read: (day) => ({ text: percent(steadyShare(day, goal.pileLimit)), ok: steadyShare(day, goal.pileLimit) >= goal.minSteady }) },
        shipped(goal.minShipped),
      ]
    case 'buffer':
      return [
        { label: 'Healthy', read: (day) => ({ text: percent(bufferScore(goal, day).healthy), ok: bufferScore(goal, day).healthy >= goal.minHealthy }) },
        { label: 'On the floor', read: (day) => ({ text: String(tenths(day.avgWip)), ok: day.avgWip <= goal.maxAvgWip }) },
      ]
    case 'elevate':
      return [
        shipped(goal.target),
        { label: 'Steady', read: (day) => ({ text: percent(steadyShare(day, goal.pileLimit)), ok: steadyShare(day, goal.pileLimit) >= goal.minSteady }) },
        { label: 'Spent', read: (_, spend) => ({ text: dollars(spend) }) },
      ]
    case 'flow':
      return [shipped(goal.target), { label: 'Lead time', read: (day) => ({ text: minutes(day.avgLeadTime), ok: (day.avgLeadTime ?? Infinity) <= goal.maxLeadTime }) }]
    case 'profit':
      return [
        { label: 'Profit', read: (day) => ({ text: money(profitScore(goal, day).profit), ok: profitScore(goal, day).profit >= goal.target }) },
        shipped(goal.minShipped),
        { label: 'Inventory', read: (day) => ({ text: money(profitScore(goal, day).inventory), ok: profitScore(goal, day).inventory <= goal.maxInventory }) },
      ]
    case 'bars':
      return goal.bars.map((bar) => {
        const measure = barMeasure(bar, words, baseline)
        return {
          label: measure.label,
          read: (day, spend) => {
            const reading = readBar(bar, day, spend)
            return { text: measure.format(reading.value), ok: reading.met }
          },
        }
      })
  }
}
