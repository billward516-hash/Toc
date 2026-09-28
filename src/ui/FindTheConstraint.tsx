import { useMemo, useState } from 'react'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { feedbackFor } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import { fillTemplate } from '../levels/template.ts'
import { Dialog } from './Dialog.tsx'
import { FactoryView } from './FactoryView.tsx'
import { Icon } from './icons.tsx'
import { Explanation, LevelHeader, PlaybackPanel } from './parts.tsx'
import { productColor } from './products.ts'
import { ShiftLog } from './ShiftLog.tsx'
import { hasDisruptions, shiftLog } from './shiftEvents.ts'
import { SimulationLog } from './SimLog.tsx'
import type { LevelFlowProps } from './types.ts'
import { MINUTES_PER_SECOND, usePlayback } from './usePlayback.ts'

interface Feedback {
  correct: boolean
  title: string
  body: string
}

export function FindTheConstraint({ level, goal, nextLevel, onRecord, onExit, onNext, preferences }: LevelFlowProps<'identifyBottleneck'>) {
  const { model } = level
  const result = useMemo(() => simulate(model, level.seed), [model, level.seed])
  const [speed, setSpeed] = useState(1)
  const playback = usePlayback(model.horizon, MINUTES_PER_SECOND * speed)
  const snapshot = useMemo(() => snapshotAt(result, playback.t), [result, playback.t])
  const [briefing, setBriefing] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const stationName = (id: string | null) => model.stations.find((s) => s.id === id)?.name
  const watched = playback.t >= goal.watchMinutes

  const start = () => {
    setBriefing(false)
    onRecord({ type: 'started', levelId: level.id })
    playback.play()
  }

  const lockIn = () => {
    if (!selected) return
    const correct = selected === goal.answer
    onRecord({ type: 'answered', levelId: level.id, answer: selected, correct })
    if (correct) {
      setSolved(true)
      onRecord({ type: 'completed', levelId: level.id })
    }
    playback.pause()
    const popup = feedbackFor(level, selected)
    setFeedback({
      correct,
      title: popup?.title ?? (correct ? 'Correct' : 'Not quite'),
      body: popup ? fillTemplate(popup.body, model, snapshot) : '',
    })
  }

  const resume = () => {
    setFeedback(null)
    if (!playback.finished) playback.play()
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

      <div className="floor">
        <FactoryView
          model={model}
          snapshot={snapshot}
          selected={selected}
          constraint={solved ? goal.answer : null}
          jobProducts={result.products}
          unit={level.unit}
          onSelect={solved ? undefined : setSelected}
          glide={playback.gliding ? speed : 0}
        />
      </div>
      <p className="rotate-hint">Turn your phone sideways to see the whole line.</p>

      <div className="dock">
        <PlaybackPanel
          playback={playback}
          speed={speed}
          onSpeed={setSpeed}
          horizon={model.horizon}
          parts={model.products?.map((product) => (
            <span key={product.id}>
              <i className="swatch" style={{ background: productColor(model, product.id) }} /> {product.name}
            </span>
          ))}
        >
          {hasDisruptions(model) && <ShiftLog entries={shiftLog(model, result, playback.t, level.unit ?? 'robots')} />}
          {level.tier >= 2 && <SimulationLog model={model} result={result} t={playback.t} unit={level.unit ?? 'robots'} />}
        </PlaybackPanel>

        <section className="question card" aria-live="polite">
          {solved ? (
            <>
              <p className="prompt">Solved: {stationName(goal.answer)} is the constraint.</p>
              <div className="actions">
                {nextLevel && (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                )}
                <button className="btn big" onClick={onExit}>
                  Back to levels
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="prompt">{goal.prompt}</p>
              <p className="hint">
                {selected ? (
                  <>
                    Your pick: <strong>{stationName(selected)}</strong>. Tap another station to change it.
                  </>
                ) : (
                  'Tap a station to pick it.'
                )}
              </p>
              <button className="btn primary big" disabled={!selected || !watched} onClick={lockIn}>
                Lock in my answer
              </button>
              {!watched && <p className="hint">Watch at least {duration(goal.watchMinutes)} of the shift first.</p>}
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
              Start the shift <Icon name="play" />
            </button>
          }
        >
          <p>{level.briefing}</p>
        </Dialog>
      )}

      {feedback && (
        <Dialog
          kicker={feedback.correct ? 'Correct' : 'Not quite'}
          title={feedback.title}
          tone={feedback.correct ? 'good' : 'retry'}
          actions={
            feedback.correct ? (
              <>
                {nextLevel ? (
                  <button className="btn primary big" onClick={() => onNext(nextLevel)}>
                    Next level <Icon name="next" />
                  </button>
                ) : (
                  <button className="btn primary big" onClick={onExit}>
                    Back to levels
                  </button>
                )}
                {!playback.finished && (
                  <button className="btn big" onClick={resume}>
                    Watch the rest
                  </button>
                )}
              </>
            ) : (
              <button className="btn primary big" onClick={resume}>
                Keep watching
              </button>
            )
          }
        >
          {/* A wrong answer's hint stays in full: it's what the player needs to try again. */}
          {feedback.correct ? <Explanation brief={preferences.brief}>{feedback.body}</Explanation> : <p>{feedback.body}</p>}
          {feedback.correct &&
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

function duration(minutes: number) {
  if (minutes % 60 !== 0) return `${minutes} minutes`
  return minutes === 60 ? 'an hour' : `${minutes / 60} hours`
}
