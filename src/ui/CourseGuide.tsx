import { useMemo, useState } from 'react'
import { glossary } from '../course/glossary.ts'
import { gettingStarted } from '../course/learner.ts'
import { levelNumber } from '../course/numbering.ts'
import { tierInfoFor } from '../course/tiers.ts'
import { levelState, maxStars } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import type { Notes } from '../progress/store.ts'
import { Blocks, GuideTabs } from './GuideParts.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader, Stars } from './parts.tsx'

type Tab = 'start' | 'map' | 'principles' | 'terms' | 'notes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'start', label: 'Get started' },
  { id: 'map', label: 'Course map' },
  { id: 'principles', label: 'Principles' },
  { id: 'terms', label: 'Key terms' },
  { id: 'notes', label: 'My notes' },
]

interface CourseGuideProps {
  levels: Level[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
  stars: ReadonlyMap<string, number>
  // This player's notes from before, and where to keep them as they write.
  initialNotes: Notes
  onSaveNotes: (notes: Notes) => void
  onOpen: (level: Level) => void
  onExit: () => void
}

// The learner's guide to the course: how to play, what each tier teaches and how far along they are,
// the principles they have found, the key words, and a place for their own notes.
export function CourseGuide(props: CourseGuideProps) {
  const { levels, tierNames, completed, stars, initialNotes, onSaveNotes, onOpen, onExit } = props
  const [tab, setTab] = useState<Tab>('start')
  const tiers = useMemo(() => [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b), [levels])

  return (
    <div className="screen guide">
      <ScreenHeader chip="Guide" title="Course guide" stats={[{ label: 'Done', value: `${completed.size} of ${levels.length}` }]} onExit={onExit} />
      <GuideTabs label="Course guide" tabs={TABS} value={tab} onChange={setTab} panel="course-panel" />
      <div id="course-panel" role="tabpanel" aria-labelledby={`course-panel-tab-${tab}`} className="guide-panel">
        {tab === 'start' && <GetStarted />}
        {tab === 'map' && <CourseMap levels={levels} tiers={tiers} tierNames={tierNames} completed={completed} stars={stars} onOpen={onOpen} />}
        {tab === 'principles' && <Principles levels={levels} completed={completed} />}
        {tab === 'terms' && <KeyTerms levels={levels} tiers={tiers} tierNames={tierNames} completed={completed} />}
        {tab === 'notes' && <MyNotes tiers={tiers} tierNames={tierNames} initial={initialNotes} onSave={onSaveNotes} />}
      </div>
    </div>
  )
}

function GetStarted() {
  return (
    <div className="guide-columns">
      {gettingStarted.map((section) => (
        <section key={section.id} className="card guide-card">
          <h2>{section.title}</h2>
          <Blocks blocks={section.blocks} />
        </section>
      ))}
    </div>
  )
}

interface MapProps {
  levels: Level[]
  tiers: number[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
  stars: ReadonlyMap<string, number>
  onOpen: (level: Level) => void
}

// Each tier as a session of the course: what it teaches, and how far along the learner is.
function CourseMap({ levels, tiers, tierNames, completed, stars, onOpen }: MapProps) {
  return (
    <ol className="course-tiers">
      {tiers.map((tier) => {
        const inTier = levels.filter((l) => l.tier === tier)
        const done = inTier.filter((l) => completed.has(l.id)).length
        const earned = inTier.reduce((sum, l) => sum + (stars.get(l.id) ?? 0), 0)
        const possible = inTier.reduce((sum, l) => sum + maxStars(l), 0)
        const info = tierInfoFor(tier)
        return (
          <li key={tier} className="card course-tier">
            <header>
              <span className="tier-chip">Tier {tier}</span>
              <h2>{tierNames[tier]}</h2>
              <span className="tier-progress">
                {done === inTier.length && <Icon name="check" />} {done} of {inTier.length} done
                {possible > 0 && (
                  <>
                    {' · '}
                    <Icon name="star" /> {earned}/{possible}
                  </>
                )}
              </span>
            </header>
            <p className="objectives-title">By the end you can:</p>
            <ul className="plain-list">
              {info.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
            <ol className="course-levels">
              {inTier.map((level) => {
                const state = levelState(level, completed)
                const possibleStars = maxStars(level)
                return (
                  <li key={level.id} className={state}>
                    <span className="level-num">{levelNumber(level)}</span>
                    <span className="level-name">{level.title}</span>
                    {possibleStars > 0 && state !== 'locked' && <Stars earned={stars.get(level.id) ?? 0} max={possibleStars} />}
                    <button className="btn small" disabled={state === 'locked'} onClick={() => onOpen(level)}>
                      {state === 'locked' ? (
                        <>
                          <Icon name="lock" /> Locked
                        </>
                      ) : state === 'completed' ? (
                        'Replay'
                      ) : (
                        'Play'
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          </li>
        )
      })}
    </ol>
  )
}

// Every principle the course teaches. The ones not found yet keep their wording secret, so finding
// them is still a discovery.
function Principles({ levels, completed }: { levels: Level[]; completed: ReadonlySet<string> }) {
  const numbers = useMemo(() => Object.keys(principleNames).map(Number).sort((a, b) => a - b), [])
  // The first level, in course order, that teaches each principle.
  const taughtBy = useMemo(() => {
    const first = new Map<number, Level>()
    for (const level of levels) for (const p of level.principles) if (!first.has(p)) first.set(p, level)
    return first
  }, [levels])
  const learned = useMemo(() => new Set(levels.filter((l) => completed.has(l.id)).flatMap((l) => l.principles)), [levels, completed])
  const found = numbers.filter((p) => learned.has(p)).length
  return (
    <section className="card guide-card">
      <h2>
        Principles you have found: {found} of {numbers.length}
      </h2>
      <p className="hint">Finish a level to find what it teaches. The ones still ahead say only where you will find them.</p>
      <ul className="principles">
        {numbers.map((p) => {
          const level = taughtBy.get(p)
          const where = level ? `${levelNumber(level)} ${level.title}` : ''
          return learned.has(p) ? (
            <li key={p} className="found">
              <Icon name="check" />
              <div>
                <strong>{principleNames[p]}</strong>
                <small>Found in {where}</small>
              </div>
            </li>
          ) : (
            <li key={p} className="ahead">
              <Icon name="lock" />
              <div>
                <strong>Still to find</strong>
                <small>Look for it in {where}</small>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface TermsProps {
  levels: Level[]
  tiers: number[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
}

// The key words, in the order the game brings them up. Words from tiers not reached yet are marked, not hidden.
function KeyTerms({ levels, tiers, tierNames, completed }: TermsProps) {
  return (
    <div className="guide-columns">
      {tiers.map((tier) => {
        const terms = glossary.filter((entry) => entry.tier === tier)
        const first = levels.find((l) => l.tier === tier)
        const ahead = first ? levelState(first, completed) === 'locked' : false
        if (terms.length === 0) return null
        return (
          <section key={tier} className={`card guide-card${ahead ? ' ahead' : ''}`}>
            <h2>
              <span className="tier-chip">Tier {tier}</span> {tierNames[tier]}
              {ahead && <small className="later-tag">Later in the course</small>}
            </h2>
            <dl className="terms">
              {terms.map((entry) => (
                <div key={entry.term}>
                  <dt>{entry.term}</dt>
                  <dd>{entry.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}

interface NotesProps {
  tiers: number[]
  tierNames: Record<number, string>
  initial: Notes
  onSave: (notes: Notes) => void
}

// A place to answer each tier's questions in the learner's own words. It stays on the device.
function MyNotes({ tiers, tierNames, initial, onSave }: NotesProps) {
  const [notes, setNotes] = useState<Notes>(initial)
  const write = (tier: number, text: string) => {
    const next = { ...notes, [tier]: text }
    setNotes(next)
    onSave(next)
  }
  return (
    <section className="card guide-card notes">
      <div className="notes-top">
        <h2>My notes</h2>
        <button className="btn small print-hide" onClick={() => window.print()}>
          Print my notes
        </button>
      </div>
      <p className="hint">Your notes are saved on this device. Only you can see them. Your instructor's screen never shows them.</p>
      {tiers.map((tier) => {
        const info = tierInfoFor(tier)
        const text = notes[tier] ?? ''
        return (
          <div key={tier} className="note">
            <label htmlFor={`note-${tier}`}>
              <span className="tier-chip">Tier {tier}</span> <strong>{tierNames[tier]}</strong>
              {info.reflect.map((prompt) => (
                <span key={prompt} className="prompt-line">
                  {prompt}
                </span>
              ))}
            </label>
            <textarea id={`note-${tier}`} className="print-hide" rows={4} value={text} placeholder="Write your thoughts here" onChange={(event) => write(tier, event.target.value)} />
            <p className="print-only note-print">{text || ' '}</p>
          </div>
        )
      })}
    </section>
  )
}
