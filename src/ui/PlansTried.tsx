import { useMemo } from 'react'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { steadyShare } from '../engine/timeline.ts'
import { bufferScore, maxStars, profitScore, readBar } from '../levels/graph.ts'
import { applyLevers, planCost, valueLabel } from '../levels/levers.ts'
import { planKey, plansTried } from '../levels/plans.ts'
import type { Choices, Goal, Level } from '../levels/types.ts'
import { tenths } from '../levels/values.ts'
import type { StoredEvent } from '../progress/store.ts'
import { barMeasure, type Words } from './barTexts.ts'
import { Icon } from './icons.tsx'
import { Stars } from './parts.tsx'

type PlanGoal = Extract<Goal, { kind: 'output' | 'steady' | 'buffer' | 'elevate' | 'flow' | 'profit' | 'bars' }>

// One measure of a plan on the level's own day, and whether it cleared the goal's bar there (no
// verdict for a measure with no bar, such as money spent on an elevate level).
interface Cell {
  text: string
  ok?: boolean
}

interface Column {
  label: string
  read: (day: SimResult, spend: number) => Cell
}

const percent = (share: number) => `${Math.floor(100 * share)}%`
const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`
const money = (amount: number) => (Math.round(amount) < 0 ? '−' : '') + dollars(Math.abs(Math.round(amount)))
const minutes = (value: number | null) => (value === null ? '–' : `${Math.round(value)} min`)

// The measures a level judges plans by, as columns.
function columnsFor(goal: PlanGoal, words: Words, baseline: SimResult): Column[] {
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

interface PlansTriedProps {
  level: Level
  goal: PlanGoal
  history: readonly StoredEvent[]
  words: Words
  baseline: SimResult
  // The plan on the floor or picked in the form, to mark in the table.
  current?: Choices
  // While planning: start from one of the plans in the table.
  onUse?: (plan: Choices) => void
}

// Every plan the player has run on this level, side by side (kept with their progress, so it lasts
// between visits): the choices, how the plan did on the level's own day against each of the goal's
// bars, and the result it earned.
export function PlansTried({ level, goal, history, words, baseline, current, onUse }: PlansTriedProps) {
  const plans = useMemo(() => plansTried(level, history), [level, history])
  const columns = useMemo(() => columnsFor(goal, words, baseline), [goal, words, baseline])
  // Each plan runs once on the level's own day, and its cells are read then, not on every frame.
  const rows = useMemo(
    () =>
      plans.map((tried) => {
        const day = simulate(applyLevers(level.model, level.levers, tried.plan), level.seed)
        const spend = planCost(level.levers, tried.plan)
        return { ...tried, cells: columns.map((column) => column.read(day, spend)) }
      }),
    [plans, level, columns],
  )
  if (rows.length === 0) return null
  // Only the decisions that differ between plans go in the rows; the rest are said once, below.
  const { levers, model } = level
  const varying = rows.length > 1 ? levers.filter((lever) => new Set(rows.map((row) => row.plan[lever.id])).size > 1) : levers
  const same = levers.filter((lever) => !varying.includes(lever))
  const choice = (lever: (typeof levers)[number], plan: Choices) => valueLabel(lever, plan[lever.id], model)
  const stars = maxStars(level)
  const severalDays = 'freshDays' in goal && goal.freshDays > 0
  const here = current ? planKey(level, current) : null
  return (
    <section className="plans-tried" aria-label="Plans you've tried">
      <h3>Plans you've tried</h3>
      <div className="table-scroll">
        <table className="data-table plans-table">
          <thead>
            <tr>
              <th scope="col">{levers.length === 1 ? levers[0].label : 'Plan'}</th>
              {columns.map((column) => (
                <th key={column.label} scope="col">
                  {column.label}
                </th>
              ))}
              <th scope="col" className="outcome">
                Result
              </th>
              {onUse && (
                <th scope="col">
                  <span className="visually-hidden">Try it again</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={planKey(level, row.plan)} className={planKey(level, row.plan) === here ? 'current' : undefined}>
                <th scope="row">
                  {varying.map((lever) => (
                    <span key={lever.id} className="choice">
                      {levers.length > 1 && <small>{lever.label}: </small>}
                      {choice(lever, row.plan)}
                    </span>
                  ))}
                </th>
                {row.cells.map((cell, k) => (
                  <td key={columns[k].label} className={cell.ok === undefined ? undefined : cell.ok ? 'ok' : 'miss'}>
                    {cell.ok !== undefined && <Icon name={cell.ok ? 'check' : 'cross'} />}
                    {cell.text}
                    {cell.ok !== undefined && <span className="visually-hidden">{cell.ok ? ', met' : ', missed'}</span>}
                  </td>
                ))}
                <td className="outcome">
                  {stars > 0 && <Stars earned={row.stars} max={stars} />}
                  <span className={row.met ? 'met' : 'unmet'}>{row.met ? 'Goal met' : 'Not yet'}</span>
                  {row.tries > 1 && <small>best of {row.tries} runs</small>}
                </td>
                {onUse && (
                  <td>
                    <button className="btn small" onClick={() => onUse(row.plan)}>
                      Use
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {same.length > 0 && (
        <p className="hint">
          In every plan: {same.map((lever) => `${lever.label}: ${choice(lever, rows[0].plan)}`).join('; ')}.
        </p>
      )}
      <p className="hint">
        The numbers are for the day you watched{severalDays ? '; stars count every day the plan ran' : ''}. A check met the goal there; a cross
        missed it.
      </p>
    </section>
  )
}
