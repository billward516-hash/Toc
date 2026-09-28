import { useMemo, useState } from 'react'
import type { FactoryModel } from '../engine/model.ts'
import { simulate, type SimResult } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackForRun, maxStars } from '../levels/graph.ts'
import { applyLevers } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import type { Choices, Lever } from '../levels/types.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView, type Badge } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { LevelHeader, PlaybackPanel, Stars } from './parts.tsx'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

interface Run {
  plan: Choices
  model: FactoryModel
  result: SimResult
  met: boolean
}

export function PlanTheShift({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'output'>) {
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
  const values = { baseline: baseline.output, target: goal.target }
  const stars = maxStars(level)
  const ready = levers.every((lever) => choices[lever.id] !== undefined)
  const windows = breakWindows(model)
  const name = (id: string) => model.stations.find((s) => s.id === id)?.name ?? id
  const showResult = run !== null && playback.finished && !dismissed
  const popup = run ? feedbackForRun(level, run.met, run.plan) : undefined

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const runPlan = () => {
    const planModel = applyLevers(model, levers, choices)
    const result = simulate(planModel, seed)
    const met = result.output >= goal.target
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
      <LevelHeader
        level={level}
        stats={[
          { label: 'Shipped', value: snapshot.shipped },
          { label: 'In process', value: snapshot.released - snapshot.shipped },
          { label: 'Goal', value: goal.target },
        ]}
        onExit={onExit}
      />

      <p className={`viewing${run ? ' mine' : ''}`}>{run ? 'Running your plan' : 'Running the factory as it is today'}</p>
      <div className="floor">
        <FactoryView model={shown.model} snapshot={snapshot} badges={run ? badgesFor(levers, run.plan) : {}} />
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
              {run && levers.some((l) => l.kind === 'upgrade') && (
                <span>
                  <Icon name="bolt" /> Upgraded
                </span>
              )}
              {run && levers.some((l) => l.kind === 'coverBreak') && (
                <span>
                  <Icon name="clock" /> Works through breaks
                </span>
              )}
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
                    <Icon name={lever.kind === 'upgrade' ? 'bolt' : 'clock'} /> {lever.label}: <strong>{name(run.plan[lever.id])}</strong>
                  </li>
                ))}
              </ul>
              {playback.finished ? (
                <p className="result">
                  Shipped {run.result.output}, goal {goal.target}. {run.met ? 'Goal met!' : 'Not there yet.'}
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
              <p className="hint">
                Today the factory ships <strong>{baseline.output}</strong> a shift. The goal is <strong>{goal.target}</strong>.
              </p>
              {levers.map((lever) => (
                <fieldset key={lever.id} className="lever">
                  <legend>
                    <Icon name={lever.kind === 'upgrade' ? 'bolt' : 'clock'} /> {lever.label}
                  </legend>
                  <div className="chips">
                    {lever.stations.map((id) => (
                      <button
                        key={id}
                        className={`chip${choices[lever.id] === id ? ' on' : ''}`}
                        aria-pressed={choices[lever.id] === id}
                        onClick={() => setChoices({ ...choices, [lever.id]: id })}
                      >
                        {name(id)}
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
            <div>
              <span>Shipped</span>
              <strong>{run.result.output}</strong>
            </div>
            <div>
              <span>Before</span>
              <strong>{baseline.output}</strong>
            </div>
            <div>
              <span>Goal</span>
              <strong>{goal.target}</strong>
            </div>
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

function badgesFor(levers: Lever[], plan: Choices): Record<string, Badge[]> {
  const badges: Record<string, Badge[]> = {}
  for (const lever of levers) {
    const station = plan[lever.id]
    badges[station] = [...(badges[station] ?? []), lever.kind === 'upgrade' ? 'upgraded' : 'covered']
  }
  return badges
}

function breakWindows(model: FactoryModel) {
  const windows = new Map<string, { from: number; to: number }>()
  for (const station of model.stations) {
    for (const b of station.breaks ?? []) windows.set(`${b.from}-${b.to}`, b)
  }
  return [...windows.values()].sort((a, b) => a.from - b.from)
}
