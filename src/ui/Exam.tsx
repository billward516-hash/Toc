import { useRef, useState } from 'react'
import { bank, SAME_IDEA } from '../exam/bank/index.ts'
import { formatDate } from '../exam/certificate.ts'
import { EXAM } from '../exam/config.ts'
import { itemsOf, planExam } from '../exam/draw.ts'
import { abandon, begin, cleanRecord, finish, recordAnswer, withCertificate, type CertificateRecord, type ExamRecord } from '../exam/record.ts'
import { correctToPass, fewestForExtra, percentOf } from '../exam/rules.ts'
import type { Item } from '../exam/types.ts'
import { loadExamRecord, saveExamRecord } from '../progress/store.ts'
import { CertificateScreen } from './CertificateScreen.tsx'
import { ExamResults } from './ExamResults.tsx'
import { ExamSitting } from './ExamSitting.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader } from './parts.tsx'

interface ExamProps {
  learnerId: string
  onExit: () => void
  // Opens the Course guide, for someone who wants to study before trying again.
  onStudy: () => void
}

type Result = { correct: number; asked: number; seed: number; at: string }

type Screen =
  | { name: 'intro' }
  | { name: 'sitting' }
  | { name: 'results'; items: Item[]; answers: number[]; passed: boolean; result: Result }
  | { name: 'certificate'; result: Result | null }

// A random seed for an exam, from the browser's own source of randomness.
const freshSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]

// The exam and its certificate. Anyone can take it: it asks nothing of the levels played, and nothing
// here leaves the device. What it keeps (the questions seen, past exams, an exam in progress, and the
// name on a certificate) is kept for each player on this device, like their progress.
export function Exam({ learnerId, onExit, onStudy }: ExamProps) {
  const [record, setRecord] = useState<ExamRecord>(() => {
    const kept = cleanRecord(loadExamRecord(learnerId))
    // An exam saved before the bank changed cannot be rebuilt, so it is dropped.
    return kept.current && !itemsOf(kept.current, bank) ? abandon(kept) : kept
  })
  const [screen, setScreen] = useState<Screen>({ name: 'intro' })
  // The latest record, for handlers that run before the screen has caught up with it.
  const latest = useRef(record)

  const update = (change: (before: ExamRecord) => ExamRecord) => {
    const after = change(latest.current)
    latest.current = after
    setRecord(after)
    saveExamRecord(learnerId, after)
  }

  const start = () => {
    update((before) => begin(before, planExam(bank, freshSeed(), before.seen, SAME_IDEA)))
    setScreen({ name: 'sitting' })
  }

  const finishExam = (items: Item[], answers: number[], passed: boolean) => {
    const correct = answers.filter((choice, i) => choice === items[i].right).length
    const at = new Date().toISOString()
    const seed = latest.current.current?.seed ?? 0
    update((before) => finish(before, { correct, asked: answers.length, passed }, at))
    setScreen({ name: 'results', items: items.slice(0, answers.length), answers, passed, result: { correct, asked: answers.length, seed, at } })
  }

  const saveCertificate = (certificate: CertificateRecord) => update((before) => withCertificate(before, certificate))

  if (screen.name === 'sitting') {
    const current = record.current
    const items = current ? itemsOf(current, bank) : null
    if (current && items) {
      return (
        <ExamSitting
          key={current.seed}
          items={items}
          initial={current.answers}
          onAnswer={(item, choice) => update((before) => recordAnswer(before, item.id, choice))}
          onFinish={(answers, passed) => finishExam(items, answers, passed)}
          onLeave={() => setScreen({ name: 'intro' })}
        />
      )
    }
  }

  if (screen.name === 'results') {
    return (
      <ExamResults
        items={screen.items}
        answers={screen.answers}
        passed={screen.passed}
        onAgain={start}
        onCertificate={() => setScreen({ name: 'certificate', result: screen.result })}
        onStudy={onStudy}
        onExit={onExit}
      />
    )
  }

  if (screen.name === 'certificate') {
    return (
      <CertificateScreen
        key={screen.result?.at ?? 'saved'}
        certificate={record.certificate}
        result={screen.result}
        name={record.name}
        onSave={saveCertificate}
        onBack={() => setScreen({ name: 'intro' })}
      />
    )
  }

  const saved = record.current
  const lastTries = [...record.attempts].reverse().slice(0, 5)

  return (
    <div className="screen exam">
      <ScreenHeader
        chip="Exam"
        title="Exam and certificate"
        stats={[
          { label: 'Questions', value: String(EXAM.length) },
          { label: 'Pass mark', value: `${EXAM.passPercent}%` },
        ]}
        onExit={onExit}
      />
      <div className="guide-columns">
        <section className="card guide-card" aria-labelledby="exam-intro">
          <h2 id="exam-intro">Show what you know</h2>
          <p>
            Pass this exam on the Theory of Constraints and you can download a certificate of completion. You do not need to have played the game or taken the course first.
          </p>
          <ul className="plain-list">
            <li>{EXAM.length} questions, multiple choice and true or false.</li>
            <li>
              Pass with {EXAM.passPercent}%: {correctToPass()} right out of {EXAM.length}.
            </li>
            <li>You see straight away whether each answer was right, and why.</li>
            <li>If you finish just short of the pass mark, up to {EXAM.maxExtra} extra questions follow, one at a time, to help you get there.</li>
            <li>Every exam is different: the questions are drawn at random from a bank of {EXAM.bank}, and the answers are shuffled.</li>
            <li>There is no timer. Take as long as you like.</li>
            <li>Your answers and your name stay on this device. Nothing is sent anywhere.</li>
          </ul>
          <div className="exam-actions">
            {saved ? (
              <>
                <button className="btn primary big" onClick={() => setScreen({ name: 'sitting' })}>
                  Continue my exam ({saved.answers.length} of {EXAM.length} answered)
                </button>
                <button className="btn" onClick={start}>
                  Start a new exam instead
                </button>
              </>
            ) : (
              <button className="btn primary big" onClick={start}>
                Start the exam
              </button>
            )}
            {record.certificate && (
              <button className="btn" onClick={() => setScreen({ name: 'certificate', result: null })}>
                <Icon name="award" /> View my certificate
              </button>
            )}
          </div>
        </section>

        <div className="exam-column">
          <section className="card guide-card" aria-labelledby="exam-after">
            <h2 id="exam-after">What happens after question {EXAM.length}</h2>
            <ul className="exam-rules">
              <li className="pass">
                <strong>{correctToPass()} or more right</strong>
                <span>You pass, and can make your certificate.</span>
              </li>
              <li className="extra">
                <strong>
                  {fewestForExtra()} to {correctToPass() - 1} right
                </strong>
                <span>
                  You are close, so up to {EXAM.maxExtra} extra questions follow, one at a time. You pass the moment your overall score reaches {EXAM.passPercent}%.
                </span>
              </li>
              <li className="short">
                <strong>Fewer than {fewestForExtra()} right</strong>
                <span>
                  Not this time: even {EXAM.maxExtra} more right answers could not reach {EXAM.passPercent}%. You see which topics to look at again, with every missed question explained, and can take a fresh exam.
                </span>
              </li>
            </ul>
          </section>

          {lastTries.length > 0 && (
            <section className="card guide-card" aria-labelledby="exam-history">
              <h2 id="exam-history">Your exams on this device</h2>
              <ul className="plain-list">
                {lastTries.map((attempt) => (
                  <li key={attempt.at}>
                    {formatDate(attempt.at)}: {attempt.correct} of {attempt.asked} right ({percentOf(attempt.correct, attempt.asked)}%), {attempt.passed ? 'passed' : 'not passed'}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
