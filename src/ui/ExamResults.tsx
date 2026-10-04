import { useEffect, useRef, useState } from 'react'
import { EXAM } from '../exam/config.ts'
import { correctToPass, percentOf } from '../exam/rules.ts'
import { answered, topics } from '../exam/summary.ts'
import type { Item } from '../exam/types.ts'
import { tierNames } from '../levels/index.ts'
import { Taught } from './examParts.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader } from './parts.tsx'

interface ResultsProps {
  // The questions that were asked, in order, and the answer given to each.
  items: Item[]
  answers: number[]
  passed: boolean
  onAgain: () => void
  onCertificate: () => void
  // Opens the Course guide, for someone who wants to study before trying again.
  onStudy: () => void
  onExit: () => void
}

// How an exam went: pass or not, the score by topic, and every question missed, with the right answer
// and the reason.
export function ExamResults({ items, answers, passed, onAgain, onCertificate, onStudy, onExit }: ResultsProps) {
  const [showAll, setShowAll] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const asked = answers.length
  const rows = answered(items, answers)
  const correct = rows.filter((row) => row.right).length
  const percent = percentOf(correct, asked)
  const list = topics(items, answers)
  const reviewed = rows.filter((row) => showAll || !row.right)
  const extra = asked - EXAM.length

  return (
    <div className="screen exam">
      <ScreenHeader
        chip="Exam"
        title={passed ? 'You passed' : 'Not this time'}
        stats={[
          { label: 'Score', value: `${percent}%` },
          { label: 'Right', value: `${correct} of ${asked}` },
          { label: 'Pass mark', value: `${EXAM.passPercent}%` },
        ]}
        onExit={onExit}
      />
      <div className="guide-columns">
        <div className="exam-column">
          <section className={`card exam-result ${passed ? 'pass' : 'fail'}`} aria-labelledby="exam-result-title">
            <p className="exam-kicker">{passed ? 'Goal met' : 'Not yet'}</p>
            <h2 id="exam-result-title" tabIndex={-1} ref={headingRef}>
              {passed ? `You passed with ${percent}%` : `You scored ${percent}%`}
            </h2>
            <p className="exam-score">
              {correct} of {asked} right
            </p>
            <p>
              {passed
                ? extra > 0
                  ? `The extra questions got you over the ${EXAM.passPercent}% pass mark. Your certificate is ready for your name.`
                  : `You answered more than the ${EXAM.passPercent}% pass mark (${correctToPass()} of ${EXAM.length}). Your certificate is ready for your name.`
                : `You needed ${EXAM.passPercent}%. Look at the topics below, read the questions you missed, and try again. Every new exam is drawn fresh from the bank of ${EXAM.bank}, favoring questions you have not met.`}
            </p>
            <div className="exam-actions">
              {passed ? (
                <>
                  <button className="btn primary big" onClick={onCertificate}>
                    <Icon name="award" /> Get my certificate
                  </button>
                  <button className="btn" onClick={onAgain}>
                    Take the exam again
                  </button>
                </>
              ) : (
                <>
                  <button className="btn primary big" onClick={onAgain}>
                    Take a new exam
                  </button>
                  <button className="btn" onClick={onStudy}>
                    <Icon name="book" /> Study with the Course guide
                  </button>
                </>
              )}
              <button className="btn" onClick={onExit}>
                Back to levels
              </button>
            </div>
          </section>

          <section className="card guide-card" aria-labelledby="exam-topics">
            <h2 id="exam-topics">How you did by topic</h2>
            <ul className="exam-topics">
              {list.map((topic) => {
                const weak = topic.correct * 100 < EXAM.passPercent * topic.asked
                return (
                  <li key={topic.tier} className={weak ? 'weak' : ''}>
                    <span className="exam-topic-name">
                      <span className="tier-chip">Tier {topic.tier}</span> {tierNames[topic.tier]}
                    </span>
                    <span className="exam-topic-score">
                      {topic.correct} of {topic.asked}
                      {weak && <small> · look again</small>}
                    </span>
                    <span className="bar" aria-hidden="true">
                      <i style={{ width: `${(100 * topic.correct) / topic.asked}%` }} />
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="card guide-card" aria-labelledby="exam-review">
          <div className="notes-top">
            <h2 id="exam-review">{showAll ? 'All your answers' : 'What you missed'}</h2>
            <button className="btn small" onClick={() => setShowAll(!showAll)} aria-pressed={showAll}>
              {showAll ? 'Show only what I missed' : 'Show every answer'}
            </button>
          </div>
          {reviewed.length === 0 && <p className="hint">You got every question right.</p>}
          <div className="exam-review">
            {reviewed.map(({ item, chosen, right }) => (
              <article key={item.id} className={`exam-review-item ${right ? 'good' : 'miss'}`}>
                <h3>{item.prompt}</h3>
                <p>
                  <span className="exam-review-label">Your answer</span> {item.options[chosen]} <Icon name={right ? 'check' : 'cross'} />
                  <span className="visually-hidden">{right ? ' (correct)' : ' (not correct)'}</span>
                </p>
                {!right && (
                  <p>
                    <span className="exam-review-label">Right answer</span> {item.options[item.right]}
                  </p>
                )}
                <p className="exam-why">{item.why}</p>
                <Taught levelId={item.level} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
