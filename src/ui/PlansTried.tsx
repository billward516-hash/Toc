import { useMemo } from 'react'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { maxStars } from '../levels/graph.ts'
import { applyLevers, planCost, valueLabel } from '../levels/levers.ts'
import { planKey, plansTried } from '../levels/plans.ts'
import type { Choices, Level } from '../levels/types.ts'
import type { StoredEvent } from '../progress/store.ts'
import type { Words } from './barTexts.ts'
import { Icon } from './icons.tsx'
import { Stars } from './parts.tsx'
import { columnsFor, type PlanGoal } from './planColumns.ts'

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
