import { useMemo, useState } from 'react'
import type { FactoryModel } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { snapshotAt, steadyShare } from '../engine/timeline.ts'
import { feedbackForRun, goalMet, maxStars } from '../levels/graph.ts'
import { applyLevers, leverValues, valueLabel } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Choices, Goal, Lever } from '../levels/types.ts'
import { goalValues } from '../levels/values.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView, type Badge } from './FactoryView.tsx'
import { Icon, type IconName } from './icons.tsx'
import { LevelHeader, PlaybackPanel, Stars, type Stat } from './parts.tsx'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

type PlanGoal = Extract<Goal, { kind: 'output' | 'steady' }>

interface Run {
  plan: Choices
  model: FactoryModel
  result: SimResult
  met: boolean
}

export function PlanTheShift({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'output' | 'steady'>) {
  const { model, levers, seed } = level
  const baseline = useMemo(() => simulate(model, seed), [model, seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const [briefing, setBriefing] = useState(true)
  const [choices, setChoices] = useState<Choices>({})
  const [run, setRun] = useState<Run | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const shown = run ?? { model, result: baseline }
  const snapshot = useMemo(() => snapshotAt(shown.result, playback.t), [shown.result, playback.t])
  const values = goalValues(goal, baseline, run?.result)
  const stars = maxStars(level)
  const ready = levers.every((lever) => choices[lever.id] !== undefined)
  const windows = breakWindows(model)
  const showResult = run !== null && playback.finished && !dismissed
  const popup = run ? feedbackForRun(level, run.met, run.plan) : undefined
  const pileLimit = goal.kind === 'steady' ? goal.pileLimit : 5

  const stats: Stat[] = [{ label: 'Shipped', value: snapshot.shipped }]
  if (goal.kind === 'steady') {
    stats.push({ label: 'Steady', value: `${Math.floor(100 * steadyShare(shown.result, goal.pileLimit, playback.t))}%` })
  }
  stats.push({ label: 'In process', value: snapshot.released - snapshot.shipped })
  if (goal.kind === 'output') stats.push({ label: 'Goal', value: goal.target })

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const runPlan = () => {
    const planModel = applyLevers(model, levers, choices)
    const result = simulate(planModel, seed)
    const met = goalMet(goal, result)
    onRecord({ type: 'ran', levelId: level.id, choices, shipped: result.output, met, stars: met ? stars : 0 })
    if (met) onRecord({ type: 'completed', levelId: level.id })
    setRun({ plan: choices, model: planModel, result, met })
    setDismissed(false)
    playback.restart()
  }

  const replan = () => {
    setRun(null)
    playback.rewind()
  }

  return (
    <div className="screen level-screen">
      <LevelHeader level={level} stats={stats} onExit={onExit} />

      <p className={`viewing${run ? ' mine' : ''}`}>{run ? 'Running your plan' : 'Running the factory as it is today'}</p>
      <div className="floor">
        <FactoryView model={shown.model} snapshot={snapshot} badges={run ? badgesFor(levers, run.plan) : {}} buildingAt={pileLimit} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={playback}
          speed={speed}
          onSpeed={setSpeed}
          horizon={model.horizon}
          windows={windows}
          legend={
            <>
              {windows.length > 0 && (
                <span>
                  <i className="swatch dot resting" /> On break
                </span>
              )}
              {run &&
                levers
                  .filter((l) => l.kind !== 'releasePace')
                  .map((lever) => (
                    <span key={lever.id}>
                      <Icon name={leverIcon(lever)} /> {badgeLegend[lever.kind]}
                    </span>
                  ))}
            </>
          }
        />

        <section className="question card" aria-live="polite">
          {run ? (
            <>
              <p className="prompt">Your plan</p>
              <ul className="plan-summary">
                {levers.map((lever) => (
                  <li key={lever.id}>
                    <Icon name={leverIcon(lever)} /> {lever.label}: <strong>{valueLabel(lever, run.plan[lever.id], model)}</strong>
                  </li>
                ))}
              </ul>
              {playback.finished ? (
                <p className="result">
                  {outcomeText(goal, run.result)} {run.met ? 'Goal met!' : 'Not there yet.'}
                  {stars > 0 && <Stars earned={run.met ? stars : 0} max={stars} />}
                </p>
              ) : (
                <p className="hint">Watch your plan run, or jump to the end of the shift.</p>
              )}
              <div className="actions">
                {run.met && playback.finished && nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={replan}>
                  Change my plan
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">{planningHint(goal, baseline)}</p>
              {levers.map((lever) => (
                <fieldset key={lever.id} className="lever">
                  <legend>
                    <Icon name={leverIcon(lever)} /> {lever.label}
                  </legend>
                  <div className="chips">
                    {leverValues(lever).map((value) => (
                      <button
                        key={value}
                        className={`chip${choices[lever.id] === value ? ' on' : ''}`}
                        aria-pressed={choices[lever.id] === value}
                        onClick={() => setChoices({ ...choices, [lever.id]: value })}
                      >
                        {valueLabel(lever, value, model)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button className="btn primary big" disabled={!ready} onClick={runPlan}>
                Run the shift with my plan <Icon name="play" />
              </button>
            </>
          )}
        </section>
      </div>

      {briefing && (
        <Dialog
          kicker={`Tier ${level.tier}`}
          title={level.title}
          actions={
            <button className="btn primary big" onClick={start}>
              Watch the factory <Icon name="play" />
            </button>
          }
        >
          <p>{fillTemplate(level.briefing, model, snapshotAt(baseline, 0), values)}</p>
        </Dialog>
      )}

      {showResult && (
        <Dialog
          kicker={run.met ? 'Goal met' : 'Not yet'}
          title={popup?.title ?? (run.met ? 'Goal met' : 'Not yet')}
          tone={run.met ? 'good' : 'retry'}
          actions={
            <>
              {run.met && (
                <button className="btn primary big" onClick={nextLevel ? () => onNext(nextLevel) : onExit}>
                  {nextLevel ? 'Next level' : 'Back to levels'} <Icon name="next" />
                </button>
              )}
              <button className={`btn big${run.met ? '' : ' primary'}`} onClick={replan}>
                {run.met ? 'Try another plan' : 'Change my plan'}
              </button>
              <button className="btn big" onClick={() => setDismissed(true)}>
                Look at the factory
              </button>
            </>
          }
        >
          <div className="result-stats">
            {resultStats(goal, run.result, baseline).map((stat) => (
              <div key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.detail && <small>{stat.detail}</small>}
              </div>
            ))}
          </div>
          {stars > 0 && <Stars earned={run.met ? stars : 0} max={stars} />}
          {popup && <p>{fillTemplate(popup.body, run.model, snapshotAt(run.result, model.horizon), values)}</p>}
          {run.met &&
            level.principles.map((p) => (
              <p key={p} className="principle-chip">
                Principle {p}: {principleNames[p]}
              </p>
            ))}
        </Dialog>
      )}
    </div>
  )
}

const badgeLegend: Record<Exclude<Lever['kind'], 'releasePace'>, string> = {
  upgrade: 'Upgraded',
  coverBreak: 'Works through breaks',
  steady: 'Standard work',
}

function leverIcon(lever: Lever): IconName {
  switch (lever.kind) {
    case 'upgrade':
      return 'bolt'
    case 'steady':
      return 'even'
    case 'coverBreak':
    case 'releasePace':
      return 'clock'
  }
}

function badgesFor(levers: Lever[], plan: Choices): Record<string, Badge[]> {
  const badges: Record<string, Badge[]> = {}
  for (const lever of levers) {
    if (lever.kind === 'releasePace') continue
    const station = plan[lever.id]
    const badge: Badge = lever.kind === 'upgrade' ? 'upgraded' : lever.kind === 'coverBreak' ? 'covered' : 'steadied'
    badges[station] = [...(badges[station] ?? []), badge]
  }
  return badges
}

const percent = (share: number) => `${Math.floor(100 * share)}%`

function planningHint(goal: PlanGoal, baseline: SimResult): string {
  if (goal.kind === 'output') return `Today the factory ships ${baseline.output} a shift. The goal is ${goal.target}.`
  return `Today the line is steady ${percent(steadyShare(baseline, goal.pileLimit))} of the shift. The goal: steady at least ${percent(goal.minSteady)} of the shift while shipping at least ${goal.minShipped}.`
}

function outcomeText(goal: PlanGoal, result: SimResult): string {
  if (goal.kind === 'output') return `Shipped ${result.output}, goal ${goal.target}.`
  return `Steady ${percent(steadyShare(result, goal.pileLimit))} of the shift, shipped ${result.output}.`
}

function resultStats(goal: PlanGoal, result: SimResult, baseline: SimResult): Stat[] {
  if (goal.kind === 'output') {
    return [
      { label: 'Shipped', value: result.output },
      { label: 'Before', value: baseline.output },
      { label: 'Goal', value: goal.target },
    ]
  }
  return [
    { label: 'Steady', value: percent(steadyShare(result, goal.pileLimit)) },
    { label: 'Shipped', value: result.output },
    { label: 'Goal', value: percent(goal.minSteady), detail: `and ${goal.minShipped} shipped` },
  ]
}

function breakWindows(model: FactoryModel) {
  const windows = new Map<string, { from: number; to: number }>()
  for (const station of model.stations) {
    for (const b of station.breaks ?? []) windows.set(`${b.from}-${b.to}`, b)
  }
  return [...windows.values()].sort((a, b) => a.from - b.from)
}
