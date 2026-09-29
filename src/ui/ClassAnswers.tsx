import { useMemo, useState } from 'react'
import type { ClassPlan, LevelAnswers } from '../classroom/board.ts'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { maxStars } from '../levels/graph.ts'
import { applyLevers, planCost, valueLabel } from '../levels/levers.ts'
import { planKey } from '../levels/plans.ts'
import type { Choices, Level } from '../levels/types.ts'
import { levelWording, levelWords } from './classText.ts'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { badgesFor, leverIcon } from './leverLooks.ts'
import { PlaybackPanel, Stars } from './parts.tsx'
import { columnsFor, type PlanGoal } from './planColumns.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

type Picks = Extract<LevelAnswers, { kind: 'pick' }>

interface ClassAnswersProps {
  level: Level
  answers: LevelAnswers
  showNames: boolean
  // Plays a plan, or with null the factory as it is, on this screen for everyone to watch.
  onWatch: (plan: Choices | null) => void
}

// Everyone's answers on one level, for the class to talk over.
export function ClassAnswers({ level, answers, showNames, onWatch }: ClassAnswersProps) {
  const wording = useMemo(() => levelWording(level), [level])
  return (
    <>
      <p className="prompt class-question">{wording.question}</p>
      {answers.kind === 'pick' ? (
        <PickAnswers key={level.id} answers={answers} labels={wording.labels} onWatch={() => onWatch(null)} />
      ) : (
        <PlanAnswers level={level} plans={answers.plans} showNames={showNames} onWatch={onWatch} />
      )}
    </>
  )
}

// A level with a right answer: how many first said each answer, then each student's answer. Which one
// is right stays hidden until the instructor shows it, so the class can argue it out first.
function PickAnswers({ answers, labels, onWatch }: { answers: Picks; labels: Map<string, string>; onWatch: () => void }) {
  const [reveal, setReveal] = useState(false)
  const name = (id: string) => labels.get(id) ?? id
  const answered = answers.picks.length
  return (
    <>
      <ol className="tally" aria-label="First answers">
        {answers.choices.map((choice) => (
          <li key={choice.id} className={reveal && choice.right ? 'right' : undefined}>
            <span className="tally-label">
              {name(choice.id)}
              {reveal && choice.right && (
                <span className="right-tag">
                  <Icon name="check" /> Right
                </span>
              )}
            </span>
            <span className="tally-bar" aria-hidden="true">
              <i style={{ width: `${answered > 0 ? (100 * choice.count) / answered : 0}%` }} />
            </span>
            <span className="tally-count">{choice.count}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button className="btn" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
          <Icon name="eye" /> {reveal ? 'Hide the right answer' : 'Show the right answer'}
        </button>
        <button className="btn" onClick={onWatch}>
          <Icon name="play" /> Watch the factory
        </button>
      </div>
      {answered > 0 && (
        <div className="table-scroll">
          <table className="data-table class-picks">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">First answer</th>
                {reveal && (
                  <>
                    <th scope="col">Answers given</th>
                    <th scope="col">Got it</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {answers.picks.map((pick) => (
                <tr key={pick.id}>
                  <th scope="row">{pick.label}</th>
                  <td>{name(pick.first)}</td>
                  {reveal && (
                    <>
                      <td>{pick.tries}</td>
                      <td className={pick.solved ? 'ok' : 'miss'}>
                        {pick.solved ? (
                          <>
                            <Icon name="check" /> Yes
                          </>
                        ) : (
                          'Not yet'
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// A planning level: every plan the class ran, best first, how it did on the level's own day, and who
// ran it. Any of them plays on the big screen.
function PlanAnswers({ level, plans, showNames, onWatch }: { level: Level; plans: ClassPlan[]; showNames: boolean; onWatch: (plan: Choices | null) => void }) {
  const goal = level.goal as PlanGoal
  const words = useMemo(() => levelWords(level), [level])
  const baseline = useMemo(() => simulate(level.model, level.seed), [level])
  const columns = useMemo(() => columnsFor(goal, words, baseline), [goal, words, baseline])
  const rows = useMemo(
    () =>
      plans.map((plan) => {
        const day = simulate(applyLevers(level.model, level.levers, plan.plan), level.seed)
        const spend = planCost(level.levers, plan.plan)
        return { ...plan, cells: columns.map((column) => column.read(day, spend)) }
      }),
    [plans, level, columns],
  )
  const { levers, model } = level
  // Only the decisions that differ between plans go in the rows; the rest are said once, below.
  const varying = rows.length > 1 ? levers.filter((lever) => new Set(rows.map((row) => row.plan[lever.id])).size > 1) : levers
  const same = levers.filter((lever) => !varying.includes(lever))
  const stars = maxStars(level)
  return (
    <>
      <div className="actions">
        <button className="btn" onClick={() => onWatch(null)}>
          <Icon name="play" /> Watch the factory as it is
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="hint">No plans yet. They appear here as students run them.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table plans-table class-plans">
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
                <th scope="col" className="outcome">
                  Ran it
                </th>
                <th scope="col">
                  <span className="visually-hidden">Watch it</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={planKey(level, row.plan)}>
                  <th scope="row">
                    {varying.map((lever) => (
                      <span key={lever.id} className="choice">
                        {levers.length > 1 && <small>{lever.label}: </small>}
                        {valueLabel(lever, row.plan[lever.id], model)}
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
                  </td>
                  <td className="outcome ran">
                    {row.students.length} {row.students.length === 1 ? 'student' : 'students'}
                    {showNames && <small className="names">{row.students.join(', ')}</small>}
                  </td>
                  <td>
                    <button className="btn small" onClick={() => onWatch(row.plan)}>
                      <Icon name="play" /> Watch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {same.length > 0 && rows.length > 0 && (
        <p className="hint">In every plan: {same.map((lever) => `${lever.label}: ${valueLabel(lever, rows[0].plan[lever.id], model)}`).join('; ')}.</p>
      )}
      {rows.length > 0 && <p className="hint">The numbers are for the level's own day. Stars are the best any run of the plan earned.</p>}
    </>
  )
}

// A plan, or the factory as it is, playing on the big screen for the class to watch together.
export function ClassReplay({ level, plan, onBack }: { level: Level; plan: Choices | null; onBack: () => void }) {
  const { goal } = level
  const model = useMemo(() => (plan ? applyLevers(level.model, level.levers, plan) : level.model), [level, plan])
  const result = useMemo(() => simulate(model, level.seed), [model, level.seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => snapshotAt(result, playback.t), [result, playback.t])
  return (
    <section className="replay" aria-label={plan ? 'A plan from the class, playing' : 'The factory as it is, playing'}>
      <div className="replay-top">
        <button className="btn small" onClick={onBack}>
          <Icon name="back" /> Back to the answers
        </button>
        <div className="replay-title">
          <p className="kicker">
            Tier {level.tier}: {level.title}
          </p>
          <h2>{plan ? 'A plan from the class' : 'The factory as it is'}</h2>
        </div>
        <dl className="dashboard">
          <div className="stat">
            <dt>Shipped</dt>
            <dd>{snapshot.shipped}</dd>
          </div>
          <div className="stat">
            <dt>In process</dt>
            <dd>{snapshot.released - snapshot.shipped}</dd>
          </div>
        </dl>
      </div>
      {plan && (
        <ul className="plan-summary">
          {level.levers.map((lever) => (
            <li key={lever.id}>
              <Icon name={leverIcon(lever)} /> {lever.label}: <strong>{valueLabel(lever, plan[lever.id], level.model)}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="floor">
        <FactoryView
          model={model}
          snapshot={snapshot}
          badges={plan ? badgesFor(level.levers, plan) : {}}
          constraint={goal.kind === 'buffer' ? goal.drum : null}
          buffer={goal.kind === 'buffer' ? { station: goal.drum, low: goal.low, high: goal.high } : null}
          jobProducts={result.products}
          unit={level.unit}
          rushJobs={result.rush}
          glide={playback.gliding ? speed : 0}
        />
      </div>
      <PlaybackPanel playback={playback} speed={speed} onSpeed={setSpeed} horizon={model.horizon} />
    </section>
  )
}
