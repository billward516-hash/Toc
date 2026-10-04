import { useEffect, useRef, useState } from 'react'
import { EXAM } from '../exam/config.ts'
import { correctInARow, correctToPass, next, percentOf, risk } from '../exam/rules.ts'
import { riskLine, topics, weakest } from '../exam/summary.ts'
import type { Item } from '../exam/types.ts'
import { tierNames } from '../levels/index.ts'
import { Dialog } from './Dialog.tsx'
import { RiskChip, Taught } from './examParts.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader } from './parts.tsx'
import { reveal } from './scroll.ts'

interface SittingProps {
  // Every question of this exam in the order they are asked: the main ones, then the reserve of extra ones.
  items: Item[]
  // The answers given so far, when an exam is picked up where it was left.
  initial: number[]
  onAnswer: (item: Item, choice: number) => void
  onFinish: (answers: number[], passed: boolean) => void
  // Leaves for now. The exam stays saved on this device, to carry on later.
  onLeave: () => void
}

type View = 'asking' | 'feedback' | 'notice'

// An exam in progress: one question at a time, with the answer and the reason shown the moment it is
// given, and a running count of where the player stands.
export function ExamSitting({ items, initial, onAnswer, onFinish, onLeave }: SittingProps) {
  const [answers, setAnswers] = useState(initial)
  // Picking up an exam shows the last answer's feedback again, so nothing is skipped.
  const [view, setView] = useState<View>(initial.length === 0 ? 'asking' : 'feedback')
  const [leaving, setLeaving] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // Set the moment an answer is given, so a double tap cannot give two.
  const given = useRef(false)

  const asked = answers.length
  const correct = answers.filter((choice, i) => choice === items[i].right).length
  const index = view === 'asking' ? asked : asked - 1
  const item = items[Math.max(0, index)]
  const chosen = view === 'feedback' ? answers[index] : null
  const extra = index >= EXAM.length
  const standing = risk(asked, correct)
  const following = next(asked, correct)

  useEffect(() => {
    if (view === 'feedback') {
      nextRef.current?.focus({ preventScroll: true })
      reveal(feedbackRef.current)
    } else {
      given.current = false
      window.scrollTo({ top: 0 })
      headingRef.current?.focus({ preventScroll: true })
    }
  }, [view, asked])

  const choose = (choice: number) => {
    if (view !== 'asking' || given.current) return
    given.current = true
    setAnswers([...answers, choice])
    onAnswer(item, choice)
    setView('feedback')
  }

  const proceed = () => {
    if (following.kind === 'done') onFinish(answers, following.passed)
    else setView(following.kind === 'extend' && following.starting ? 'notice' : 'asking')
  }

  // The squares for the extra questions appear once they are on offer: at the notice, and from then on.
  const extended = asked > EXAM.length || (asked === EXAM.length && view !== 'feedback')
  const slots = extended ? EXAM.length + EXAM.maxExtra : EXAM.length
  const nextLabel = following.kind === 'done' ? 'See my results' : following.kind === 'extend' && following.starting ? 'Continue' : 'Next question'
  const weak = weakest(topics(items, answers))
  const inARow = correctInARow(asked, correct)

  return (
    <div className="screen exam">
      <ScreenHeader
        chip="Exam"
        title="TOC Factory exam"
        stats={[
          { label: extra ? 'Extra' : 'Question', value: extra ? String(index - EXAM.length + 1) : `${index + 1} of ${EXAM.length}` },
          { label: 'Right', value: String(correct) },
          { label: 'Pass mark', value: `${EXAM.passPercent}%` },
        ]}
        onExit={() => setLeaving(true)}
      />

      <section className="card exam-status" aria-label="How you are doing">
        <div className="exam-status-top">
          <p className="exam-tally">
            <strong>{correct}</strong> right · <strong>{asked - correct}</strong> missed · <span>{correctToPass()} right needed in {EXAM.length}</span>
          </p>
          <RiskChip risk={standing} />
        </div>
        <ol className="exam-dots" aria-hidden="true">
          {Array.from({ length: slots }, (_, i) => {
            const state = i < asked ? (answers[i] === items[i].right ? 'right' : 'missed') : i === asked && view === 'asking' ? 'here' : ''
            return <li key={i} className={`${state}${i >= EXAM.length ? ' extra' : ''}`} />
          })}
        </ol>
        <p className="exam-risk-line">{riskLine(asked, correct)}</p>
      </section>

      {view === 'notice' ? (
        <section className="card guide-card exam-notice" aria-labelledby="exam-notice">
          <h2 id="exam-notice" tabIndex={-1} ref={headingRef}>
            You are close to the pass mark
          </h2>
          <p>
            You answered {correct} of {asked} right, which is {percentOf(correct, asked)}%. The pass mark is {EXAM.passPercent}%.
          </p>
          <p>
            You can still get there. Up to {EXAM.maxExtra} extra questions follow, one at a time, and you pass the moment your overall score reaches {EXAM.passPercent}%. Right now,{' '}
            {inARow} more right {inARow === 1 ? 'answer' : 'answers'} in a row would do it.
          </p>
          {weak.length > 0 && <p>Worth another look as you go: {weak.map((t) => tierNames[t.tier]).join(', ')}.</p>}
          <div className="exam-actions">
            <button className="btn primary big" onClick={() => setView('asking')}>
              Continue with extra questions
            </button>
            <button className="btn" onClick={() => onFinish(answers, false)}>
              Stop and see my results
            </button>
          </div>
        </section>
      ) : (
        <section className="card exam-card" aria-labelledby="exam-question">
          <p className="exam-kicker">
            {extra ? `Extra question ${index - EXAM.length + 1} of up to ${EXAM.maxExtra}` : `Question ${index + 1} of ${EXAM.length}`} ·{' '}
            {item.kind === 'tf' ? 'True or false' : 'Choose one answer'}
          </p>
          <h2 id="exam-question" className="exam-question" tabIndex={-1} ref={headingRef}>
            {item.prompt}
          </h2>
          <div className={`exam-options${item.kind === 'tf' ? ' two' : ''}`}>
            {item.options.map((option, i) => {
              const state = chosen === null ? '' : i === item.right ? ' right' : i === chosen ? ' wrong' : ' dim'
              return (
                <button key={`${item.id}-${i}`} className={`exam-option${state}`} disabled={chosen !== null} onClick={() => choose(i)}>
                  <span className="exam-letter" aria-hidden="true">
                    {item.kind === 'tf' ? option[0] : 'ABCD'[i]}
                  </span>
                  <span className="exam-option-text">{option}</span>
                  <span className="exam-option-mark">
                    {state === ' right' && (
                      <>
                        <Icon name="check" /> Correct answer
                      </>
                    )}
                    {state === ' wrong' && (
                      <>
                        <Icon name="cross" /> Your answer
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <div aria-live="polite">
            {chosen !== null && (
              <div ref={feedbackRef} className={`exam-feedback ${chosen === item.right ? 'good' : 'miss'}`}>
                <h3>{chosen === item.right ? 'Correct!' : 'Not quite.'}</h3>
                <p>{item.why}</p>
                <Taught levelId={item.level} />
                <button ref={nextRef} className="btn primary big" onClick={proceed}>
                  {nextLabel} <Icon name="next" />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {leaving && (
        <Dialog
          kicker="Leave the exam?"
          title="Your answers so far are saved"
          actions={
            <>
              <button className="btn primary" onClick={() => setLeaving(false)}>
                Keep going
              </button>
              <button className="btn" onClick={onLeave}>
                Leave for now
              </button>
            </>
          }
        >
          <p>You can come back and carry on where you left off. It stays on this device.</p>
        </Dialog>
      )}
    </div>
  )
}
