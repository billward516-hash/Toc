import type { SimResult } from '../engine/simulate.ts'
import { barsScore } from '../levels/graph.ts'
import { barMeasure, goalText, lowerFirst, readingText, rowText, type BarsGoal, type Words } from './barTexts.ts'
import { Icon } from './icons.tsx'
import { DayDots, Stars } from './parts.tsx'

// From this many days, the results show each measure as dots along a line, with the day cards folded
// away (spec §5.4).
export const MANY_DAYS = 7

// What each star asks, shown before the player plans.
export function BarsStarGoals({ goal, words }: { goal: BarsGoal; words: Words }) {
  const days = goal.freshDays + 1
  return (
    <ol className="star-goals">
      {goal.bars.map((bar, i) => (
        <li key={bar.metric}>
          <Stars earned={i + 1} max={i + 1} /> {i > 0 ? `And ${lowerFirst(goalText(bar, words))}` : goalText(bar, words)}
          {i === 0 && days > 1 ? `, on all ${days} days` : ''}
        </li>
      ))}
    </ol>
  )
}

// Each bar the plan cleared or missed, and the plan day by day: as cards, or over many days, as dots
// along a line for each measure with the cards folded away.
export function BarsChecklist(props: { goal: BarsGoal; result: SimResult; fresh: SimResult[]; words: Words; spend: number }) {
  const { goal, result, fresh, words, spend } = props
  const score = barsScore(goal, result, fresh, spend)
  const days = [result, ...fresh]
  const total = score.days.length
  const rows = goal.bars.map((bar, b) => {
    const met = score.days.filter((day) => day[b].met).length
    return { ok: met === total, text: rowText(bar, met, total, score.days[0][b], words) }
  })
  // A plan costs the same every day, so the days leave spending out.
  const daily = goal.bars.map((bar, b) => ({ bar, b })).filter(({ bar }) => bar.metric !== 'spend')
  const shown = daily.slice(0, 2)
  const cards = (
    <>
      <p className="days-title">Your plan, day by day (day 1 is the one you watched):</p>
      <ol className="days compact">
        {score.days.map((readings, i) => {
          const ok = readings.every((reading) => reading.met)
          return (
            <li key={i} className={ok ? 'ok' : 'miss'}>
              <strong>
                <Icon name={ok ? 'check' : 'cross'} /> Day {i + 1}
              </strong>
              {shown.map(({ bar, b }) => (
                <span key={bar.metric}>{readingText(bar, readings[b], days[i], words)}</span>
              ))}
            </li>
          )
        })}
      </ol>
    </>
  )
  return (
    <div className="checklist">
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.ok ? 'ok' : 'miss'}>
            <Icon name={row.ok ? 'check' : 'cross'} /> {row.text}
          </li>
        ))}
      </ul>
      {total >= MANY_DAYS ? (
        <>
          {daily.map(({ bar, b }) => {
            const { label, goal: line, atLeast, format } = barMeasure(bar, words, result)
            return <DayDots key={bar.metric} label={label} values={score.days.map((day) => day[b].value)} goal={line} atLeast={atLeast} format={format} />
          })}
          <details className="day-cards">
            <summary>Each day</summary>
            {cards}
          </details>
        </>
      ) : (
        total > 1 && cards
      )}
    </div>
  )
}
