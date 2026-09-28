import { useMemo, useState } from 'react'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackForPrediction } from '../levels/graph.ts'
import { applyChange, steadyTwin } from '../levels/levers.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import { goalValues } from '../levels/values.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { LevelHeader, PlaybackPanel } from './parts.tsx'
import { ShiftLog } from './ShiftLog.tsx'
import { breaksDown, hasDisruptions, shiftLog } from './shiftEvents.ts'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

// Watch one day, predict another, then watch it: a perfect-day twin and the real line by default, or
// the line and the same line after a change, such as a breakdown.
export function PredictTheRun({ level, goal, nextLevel, onRecord, onExit, onNext }: LevelFlowProps<'predict'>) {
  const { model, seed } = level
  const { compare } = goal
  const twinModel = useMemo(() => (compare ? model : steadyTwin(model)), [model, compare])
  const realModel = useMemo(() => (compare ? applyChange(model, compare.change) : model), [model, compare])
  const twin = useMemo(() => simulate(twinModel, seed), [twinModel, seed])
  const real = useMemo(() => simulate(realModel, seed), [realModel, seed])
  const days = compare ?? { first: 'The perfect day', second: 'The real day' }
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const [briefing, setBriefing] = useState(true)
  const [choice, setChoice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const shown = locked ? { model: realModel, result: real } : { model: twinModel, result: twin }
  const snapshot = useMemo(() => snapshotAt(shown.result, playback.t), [shown.result, playback.t])
  const values = goalValues(goal, twin, real)
  const fill = (text: string) => fillTemplate(text, realModel, snapshotAt(real, model.horizon), values)
  const popup = choice ? feedbackForPrediction(level, choice) : undefined
  const showResult = locked && playback.finished && !dismissed

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const lockIn = () => {
    if (!choice) return
    onRecord({ type: 'predicted', levelId: level.id, option: choice, correct: choice === goal.answer })
    onRecord({ type: 'completed', levelId: level.id })
    setLocked(true)
    playback.restart()
  }

  return (
    <div className="screen level-screen">
      <LevelHeader
        level={level}
        stats={[
          { label: 'Shipped', value: snapshot.shipped },
          { label: 'In process', value: snapshot.released - snapshot.shipped },
        ]}
        onExit={onExit}
      />

      <p className={`viewing${locked ? ' mine' : ''}`}>
        {compare ? (locked ? compare.second : compare.first) : locked ? 'A real day: every robot rolls the dice' : 'A perfect day: every station takes exactly its average'}
      </p>
      <div className="floor">
        <FactoryView model={shown.model} snapshot={snapshot} unit={level.unit} rushJobs={shown.result.rush} jobProducts={shown.result.products} />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={playback}
          speed={speed}
          onSpeed={setSpeed}
          horizon={model.horizon}
          legend={
            (breaksDown(shown.model) || shown.model.stations.some((s) => s.jams)) && (
              <span>
                <i className="swatch dot jammed" /> Broken down or jammed
              </span>
            )
          }
        >
          {hasDisruptions(shown.model) && <ShiftLog entries={shiftLog(shown.model, shown.result, playback.t, level.unit ?? 'robots')} />}
        </PlaybackPanel>

        <section className="question card" aria-live="polite">
          {locked ? (
            <>
              <p className="prompt">Your prediction: {fill(goal.options.find((o) => o.id === choice)?.label ?? '')}</p>
              {playback.finished ? (
                <p className="result">
                  {days.first} shipped {twin.output}. {days.second} shipped {real.output}.
                </p>
              ) : (
                <p className="hint">Watch {lowerFirst(days.second)}, or jump to the end of the shift.</p>
              )}
              <div className="actions">
                {playback.finished && nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={onExit}>
                  Back to levels
                </button>
              </div>
            </>
          ) : playback.finished ? (
            <>
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">
                {days.first} shipped {twin.output}.
              </p>
              <div className="chips">
                {goal.options.map((option) => (
                  <button
                    key={option.id}
                    className={`chip${choice === option.id ? ' on' : ''}`}
                    aria-pressed={choice === option.id}
                    onClick={() => setChoice(option.id)}
                  >
                    {fill(option.label)}
                  </button>
                ))}
              </div>
              <button className="btn primary big" disabled={!choice} onClick={lockIn}>
                Watch {lowerFirst(days.second)} <Icon name="play" />
              </button>
            </>
          ) : (
            <>
              <p className="prompt">Watch {lowerFirst(days.first)}.</p>
              <p className="hint">
                {compare
                  ? `When the shift ends, you'll predict ${lowerFirst(compare.second)}.`
                  : "Every station takes exactly its average time. When the shift ends, you'll predict what a real day looks like."}
              </p>
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
              Watch {lowerFirst(days.first)} <Icon name="play" />
            </button>
          }
        >
          <p>{level.briefing}</p>
        </Dialog>
      )}

      {showResult && (
        <Dialog
          kicker={choice === goal.answer ? 'Good prediction' : 'Surprise'}
          title={popup?.title ?? 'The real day'}
          tone={choice === goal.answer ? 'good' : 'retry'}
          actions={
            <>
              <button className="btn primary big" onClick={nextLevel ? () => onNext(nextLevel) : onExit}>
                {nextLevel ? 'Next level' : 'Back to levels'} <Icon name="next" />
              </button>
              <button className="btn big" onClick={() => setDismissed(true)}>
                Look at the factory
              </button>
            </>
          }
        >
          <div className="result-stats two">
            <div>
              <span>{shortDay(days.first)}</span>
              <strong>{twin.output}</strong>
            </div>
            <div>
              <span>{shortDay(days.second)}</span>
              <strong>{real.output}</strong>
            </div>
          </div>
          {popup && <p>{fill(popup.body)}</p>}
          {level.principles.map((p) => (
            <p key={p} className="principle-chip">
              Principle {p}: {principleNames[p]}
            </p>
          ))}
        </Dialog>
      )}
    </div>
  )
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

// "The breakdown day" as a stat label: "Breakdown day".
function shortDay(text: string): string {
  const words = text.replace(/^(the|a|an) /i, '')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
