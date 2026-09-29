import { useEffect, useMemo, useState } from 'react'
import { levels } from '../levels/index.ts'
import { scriptMarkdown } from '../course/markdown.ts'
import { branches, formats, overview } from '../course/overview.ts'
import { clockAt, resolvedSession, type ResolvedPlay, type ResolvedSegment, type ResolvedSession } from '../course/resolve.ts'
import { sessions } from '../course/sessions/index.ts'
import { duration, formatMinutes } from '../course/summary.ts'
import { Blocks, GuideTabs, Steps } from './GuideParts.tsx'
import { Icon } from './icons.tsx'
import { ScreenHeader } from './parts.tsx'
import { copyText, downloadText } from './share.ts'

type Tab = 'start' | 'sessions' | 'answers' | 'all'

const TABS: { id: Tab; label: string }[] = [
  { id: 'start', label: 'Start here' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'answers', label: 'Answer key' },
  { id: 'all', label: 'Whole script' },
]

// The trainer's guide to the course: how to run it, a script for each session with the answers and the
// wrong turns to expect, and the whole thing in one piece to print or save.
export function TrainerGuide({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('start')
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab, open])

  const choose = (next: Tab) => {
    setTab(next)
    setOpen(null)
  }

  return (
    <div className="screen guide trainer">
      <ScreenHeader
        chip="Trainer"
        title="Trainer guide"
        stats={[
          { label: 'Sessions', value: sessions.length },
          { label: 'Levels', value: levels.length },
        ]}
        onExit={onExit}
      />
      <p className="guide-warning">
        <Icon name="eye" /> This guide has the answers. Keep it on your own device or on paper, not on the class screen.
      </p>
      <div className="guide-bar">
        <GuideTabs label="Trainer guide" tabs={TABS} value={tab} onChange={choose} panel="trainer-panel" />
        <button className="btn small print-hide" onClick={() => window.print()}>
          Print this page
        </button>
      </div>
      <div id="trainer-panel" role="tabpanel" aria-labelledby={`trainer-panel-tab-${tab}`} className="guide-panel">
        {tab === 'start' && <StartHere />}
        {tab === 'sessions' && (open === null ? <SessionList onOpen={setOpen} /> : <SessionPage tier={open} onOpen={setOpen} onBack={() => setOpen(null)} />)}
        {tab === 'answers' && <AnswerKey />}
        {tab === 'all' && <WholeScript />}
      </div>
    </div>
  )
}

function StartHere() {
  return (
    <div className="guide-columns">
      {overview.map((section) => (
        <section key={section.id} className="card guide-card">
          <h2>{section.title}</h2>
          <Blocks blocks={section.blocks} />
          {section.id === 'about' && <Formats />}
        </section>
      ))}
    </div>
  )
}

// Ways to run the course, with their lengths worked out from the sessions, and which branch suits whom.
function Formats() {
  return (
    <>
      <h3>Ways to run it</h3>
      <div className="table-scroll">
        <table className="data-table formats">
          <thead>
            <tr>
              <th scope="col">Format</th>
              <th scope="col">Length</th>
              <th scope="col">What it is</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((format) => (
              <tr key={format.name}>
                <th scope="row">{format.name}</th>
                <td>{duration(formatMinutes(format))}</td>
                <td>{format.who}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Which branch after Tier 3</h3>
      <p>Tiers 4 to 10 stand alone once Tier 3 is done, so pick by audience.</p>
      <ul className="plain-list">
        {branches.map((branch) => (
          <li key={branch.audience}>
            <strong>{branch.audience}:</strong> {branch.tiers}
          </li>
        ))}
      </ul>
    </>
  )
}

function SessionList({ onOpen }: { onOpen: (tier: number) => void }) {
  return (
    <ol className="level-cards session-list">
      {sessions.map((session) => {
        const resolved = resolvedSession(session)
        const { core, optional } = resolved.minutes
        const count = resolved.segments.filter((segment) => segment.kind === 'play').length
        return (
          <li key={session.tier}>
            <button className="level-card unlocked" onClick={() => onOpen(session.tier)}>
              <span className="level-number">{session.tier}</span>
              <span className="level-text">
                <strong>{resolved.name}</strong>
                <span className="principle">{session.summary}</span>
              </span>
              <span className="level-state">
                {duration(core)}
                <small>
                  {count} {count === 1 ? 'level' : 'levels'}
                  {optional > 0 ? `, ${optional} min optional` : ''}
                </small>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function SessionPage({ tier, onOpen, onBack }: { tier: number; onOpen: (tier: number) => void; onBack: () => void }) {
  const index = sessions.findIndex((s) => s.tier === tier)
  const resolved = useMemo(() => resolvedSession(sessions[index]), [index])
  const before = sessions[index - 1]
  const after = sessions[index + 1]
  const nav = (
    <div className="session-nav print-hide">
      <button className="btn small" onClick={onBack}>
        <Icon name="back" /> All sessions
      </button>
      <div className="session-steps">
        <button className="btn small" disabled={!before} onClick={() => before && onOpen(before.tier)}>
          <Icon name="back" /> {before ? `Session ${before.tier}` : 'First'}
        </button>
        <button className="btn small" disabled={!after} onClick={() => after && onOpen(after.tier)}>
          {after ? `Session ${after.tier}` : 'Last'} <Icon name="next" />
        </button>
      </div>
    </div>
  )
  return (
    <>
      {nav}
      <SessionBody resolved={resolved} />
      {nav}
    </>
  )
}

function SessionBody({ resolved }: { resolved: ResolvedSession }) {
  const { core, optional } = resolved.minutes
  return (
    <article className="session">
      <header className="session-head">
        <span className="tier-chip">Session {resolved.tier}</span>
        <h2>{resolved.name}</h2>
        <p className="session-length">
          About {duration(core)}
          {optional > 0 && `, plus ${optional} minutes if you run the optional part`}
        </p>
      </header>
      <p className="session-summary">{resolved.summary}</p>
      <div className="session-columns">
        <section className="card guide-card">
          <h3>By the end, learners can</h3>
          <ul className="plain-list">
            {resolved.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
        <section className="card guide-card">
          <h3>Before the session</h3>
          <ul className="plain-list">
            {resolved.before.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card guide-card">
        <h3>Run of show</h3>
        <div className="table-scroll">
          <table className="data-table run-of-show">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Segment</th>
                <th scope="col">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {resolved.segments.map((segment, i) => (
                <tr key={i}>
                  <td>{resolved.starts[i] === null ? 'any time' : clockAt(resolved.starts[i]!)}</td>
                  <th scope="row">
                    {segment.kind === 'play' ? `${segment.number} ${segment.title}` : segment.title}
                    {segment.kind === 'talk' && segment.optional && <small> optional</small>}
                  </th>
                  <td>{segment.minutes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {resolved.segments.map((segment, i) => (
        <Segment key={i} segment={segment} start={resolved.starts[i]} />
      ))}
      <div className="session-columns">
        <section className="card guide-card">
          <h3>If you are short of time</h3>
          <ul className="plain-list">
            {resolved.short.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="card guide-card">
          <h3>If you have time to spare</h3>
          <ul className="plain-list">
            {resolved.extend.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}

const timing = (start: number | null, minutes: number, optional = false) =>
  `${start === null ? 'Any time' : clockAt(start)} · ${minutes} min${optional ? ' · optional' : ''}`

function Segment({ segment, start }: { segment: ResolvedSegment; start: number | null }) {
  if (segment.kind === 'talk') {
    return (
      <section className="card segment talk">
        <header className="segment-head">
          <h3>{segment.title}</h3>
          <span className="segment-time">{timing(start, segment.minutes, segment.optional)}</span>
        </header>
        <Steps steps={segment.steps} />
      </section>
    )
  }
  return <PlayBlock segment={segment} start={start} />
}

function PlayBlock({ segment, start }: { segment: ResolvedPlay; start: number | null }) {
  return (
    <section className="card segment play">
      <header className="segment-head">
        <span className="level-num">{segment.number}</span>
        <h3>{segment.title}</h3>
        <span className="segment-time">{timing(start, segment.minutes)}</span>
      </header>
      <p className="principles-line">{segment.principles.join(' · ')}</p>
      <p className="idea">
        <strong>Key idea:</strong> {segment.idea}
      </p>
      <div className="answer-box">
        <h4>Answer</h4>
        <ul className="plain-list">
          {segment.answer.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <h4>Set up</h4>
      <Steps steps={segment.setup} />
      <h4>While they play</h4>
      <Steps steps={segment.during} />
      <ul className="plain-list watch-list">
        {segment.watch.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h4>Debrief</h4>
      <Steps steps={segment.debrief} />
      <h4>Common wrong turns</h4>
      <ul className="plain-list">
        {segment.mistakes.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

// Every level's answer on one page, for a quick look while teaching.
function AnswerKey() {
  const all = useMemo(() => sessions.map(resolvedSession), [])
  return (
    <div className="guide-columns">
      {all.map((resolved) => (
        <section key={resolved.tier} className="card guide-card">
          <h2>
            <span className="tier-chip">Tier {resolved.tier}</span> {resolved.name}
          </h2>
          <div className="table-scroll">
            <table className="data-table answer-table">
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Answer</th>
                  <th scope="col">Key idea</th>
                </tr>
              </thead>
              <tbody>
                {resolved.segments.filter((segment): segment is ResolvedPlay => segment.kind === 'play').map((segment) => (
                  <tr key={segment.number}>
                    <th scope="row">
                      <span className="level-num">{segment.number}</span> {segment.title}
                    </th>
                    <td>
                      {segment.answer.map((line) => (
                        <span key={line} className="answer-line">
                          {line}
                        </span>
                      ))}
                    </td>
                    <td>{segment.idea}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

// The whole guide and every session in one long page, to print, and as text to save or copy.
function WholeScript() {
  const [note, setNote] = useState<string | null>(null)
  const all = useMemo(() => sessions.map(resolvedSession), [])
  return (
    <>
      <section className="card guide-card print-hide">
        <h2>The whole script</h2>
        <p>Every session in one long page. Print it, save it as a text file, or copy it to paste into a document.</p>
        <div className="actions">
          <button className="btn primary" onClick={() => window.print()}>
            Print everything
          </button>
          <button className="btn" onClick={() => downloadText('TOC-Factory-trainer-script.md', scriptMarkdown())}>
            Save as a text file
          </button>
          <button
            className="btn"
            onClick={async () => setNote((await copyText(scriptMarkdown())) ? 'Copied. Paste it into a document.' : "Couldn't copy from here. Use Save as a text file instead.")}
          >
            Copy as text
          </button>
        </div>
        {note && (
          <p className="hint" role="status">
            {note}
          </p>
        )}
      </section>
      <StartHere />
      {all.map((resolved) => (
        <div key={resolved.tier} className="whole-session">
          <SessionBody resolved={resolved} />
        </div>
      ))}
    </>
  )
}
