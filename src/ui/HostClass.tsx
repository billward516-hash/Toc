import { useMemo, useState } from 'react'
import type { ClassBackend } from '../classroom/backend.ts'
import { boardTiers, levelAnswers, progressBoard, studentLabels, type Cell } from '../classroom/board.ts'
import { formatCode, joinLink } from '../classroom/code.ts'
import { classBackend, withTimeout } from '../classroom/load.ts'
import type { ClassRoom } from '../classroom/room.ts'
import { useHostedClass } from '../classroom/useHostedClass.ts'
import { maxStars } from '../levels/graph.ts'
import type { Choices, Level } from '../levels/types.ts'
import { ClassAnswers, ClassReplay } from './ClassAnswers.tsx'
import { Dialog } from './Dialog.tsx'
import { Icon } from './icons.tsx'
import { QrCode } from './QrCode.tsx'

type View = 'join' | 'progress' | 'answers'

const VIEWS: { id: View; label: string }[] = [
  { id: 'join', label: 'Join' },
  { id: 'progress', label: 'Progress' },
  { id: 'answers', label: 'Answers' },
]

interface HostClassProps {
  code: string
  levels: Level[]
  tierNames: Record<number, string>
  // Back to the game on this device, leaving the class open.
  onBack: () => void
  // The class is over: ended here, or no longer there to open.
  onClosed: () => void
}

type Confirming = { kind: 'end' } | { kind: 'remove'; id: string; label: string }

// The instructor's screen, made for the TV: how to join, everyone's progress, and everyone's answers on
// any level, with a way to send the whole class to one level and to play any plan for all to see.
export function HostClass({ code, levels, tierNames, onBack, onClosed }: HostClassProps) {
  const [attempt, setAttempt] = useState(0)
  const hosted = useHostedClass(code, attempt)
  const [view, setView] = useState<View>('join')
  const [showNames, setShowNames] = useState(true)
  const [picked, setPicked] = useState<string | null>(null)
  const [watching, setWatching] = useState<{ plan: Choices | null } | null>(null)
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const act = async (action: (backend: ClassBackend) => Promise<void>) => {
    setProblem(null)
    try {
      await withTimeout(classBackend().then(action))
      return true
    } catch {
      setProblem("That didn't reach the class. Check this device is online, then try again.")
      return false
    }
  }

  if (hosted.status === 'loading') {
    return (
      <div className="screen host">
        <p className="hint">Opening class {formatCode(code)}…</p>
      </div>
    )
  }
  if (hosted.status !== 'open') {
    return <ClassGone code={code} failed={hosted.status === 'failed'} onRetry={() => setAttempt(attempt + 1)} onBack={onClosed} />
  }

  const { room } = hosted
  const focus = room.meta.focus
  const level = levels.find((l) => l.id === (picked ?? focus ?? busiest(room))) ?? levels[0]
  const online = room.players.filter((player) => player.online).length
  const open = (next: View) => {
    setView(next)
    setWatching(null)
  }

  return (
    <div className="screen host">
      <header className="level-header host-header">
        <div className="header-buttons">
          <button className="btn small" onClick={onBack}>
            <Icon name="back" /> Game
          </button>
        </div>
        <div className="level-title">
          <span className="tier-chip">Class {formatCode(code)}</span>
          <h1>Your class</h1>
        </div>
        <dl className="dashboard">
          <div className="stat">
            <dt>Students</dt>
            <dd>{room.players.length}</dd>
          </div>
          <div className="stat">
            <dt>Online</dt>
            <dd>{online}</dd>
          </div>
        </dl>
      </header>

      <div className="host-bar">
        <div className="host-tabs" role="tablist" aria-label="Class screens">
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              id={`class-tab-${id}`}
              role="tab"
              aria-selected={view === id}
              aria-controls="class-panel"
              className={`host-tab${view === id ? ' on' : ''}`}
              onClick={() => open(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="host-tools">
          <button className={`chip${showNames ? ' on' : ''}`} aria-pressed={showNames} onClick={() => setShowNames(!showNames)}>
            Show names
          </button>
          <button className="btn small" onClick={() => setConfirming({ kind: 'end' })}>
            End class
          </button>
        </div>
      </div>

      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}

      <div id="class-panel" role="tabpanel" aria-labelledby={`class-tab-${view}`} className="host-panel">
        {view === 'join' && <JoinPanel code={code} room={room} showNames={showNames} onRemove={(id, label) => setConfirming({ kind: 'remove', id, label })} />}
        {view === 'progress' && (
          <ProgressPanel
            room={room}
            levels={levels}
            tierNames={tierNames}
            showNames={showNames}
            onPick={(id) => {
              setPicked(id)
              open('answers')
            }}
          />
        )}
        {view === 'answers' && watching && <ClassReplay key={`${level.id}:${JSON.stringify(watching.plan)}`} level={level} plan={watching.plan} onBack={() => setWatching(null)} />}
        {view === 'answers' && !watching && (
          <AnswersPanel
            room={room}
            level={level}
            levels={levels}
            tierNames={tierNames}
            showNames={showNames}
            focus={focus}
            onPick={setPicked}
            onFocus={(levelId) => void act((backend) => backend.setFocus(code, levelId))}
            onWatch={(plan) => setWatching({ plan })}
          />
        )}
      </div>

      {confirming?.kind === 'end' && (
        <Dialog
          kicker={`Class ${formatCode(code)}`}
          title="End the class?"
          actions={
            <>
              <button className="btn primary big" onClick={() => setConfirming(null)}>
                Keep it open
              </button>
              <button
                className="btn big"
                onClick={async () => {
                  setConfirming(null)
                  if (await act((backend) => backend.endClass(code))) onClosed()
                }}
              >
                End the class
              </button>
            </>
          }
        >
          <p>Ending the class deletes everything in it from the class service: names, progress, and answers. Students keep their own progress on their devices.</p>
        </Dialog>
      )}
      {confirming?.kind === 'remove' && (
        <Dialog
          kicker={`Class ${formatCode(code)}`}
          title={`Remove ${confirming.label}?`}
          actions={
            <>
              <button className="btn primary big" onClick={() => setConfirming(null)}>
                Keep them
              </button>
              <button
                className="btn big"
                onClick={() => {
                  const { id } = confirming
                  setConfirming(null)
                  void act((backend) => backend.removePlayer(code, id))
                }}
              >
                Remove
              </button>
            </>
          }
        >
          <p>Their results leave your screen. They can join again with the class code.</p>
        </Dialog>
      )}
    </div>
  )
}

// The level to talk about when the instructor hasn't picked one: where most students are right now,
// or failing that, the level of the latest result.
function busiest(room: ClassRoom): string | null {
  const here = new Map<string, number>()
  for (const player of room.players) if (player.now) here.set(player.now, (here.get(player.now) ?? 0) + 1)
  const [top] = [...here.entries()].sort((a, b) => b[1] - a[1])
  if (top) return top[0]
  const latest = room.players.flatMap((player) => player.events).sort((a, b) => b.at - a.at)[0]
  return latest?.levelId ?? null
}

function JoinPanel({ code, room, showNames, onRemove }: { code: string; room: ClassRoom; showNames: boolean; onRemove: (id: string, label: string) => void }) {
  const link = joinLink(window.location.href, code)
  const address = `${window.location.host}${window.location.pathname}`.replace(/\/$/, '')
  const labels = studentLabels(room, showNames)
  return (
    <div className="join-panel">
      <section className="card join-card">
        <QrCode text={link} label={`QR code that joins class ${formatCode(code)}`} />
        <div className="join-steps">
          <h2>Join on your phone</h2>
          <p>
            Scan this with your phone's camera. Or open <strong>{address}</strong>, tap <strong>Join a class</strong>, and enter:
          </p>
          <p className="big-code" aria-label={`Class code ${code.split('').join(' ')}`}>
            {formatCode(code)}
          </p>
        </div>
      </section>
      <section className="card roster" aria-live="polite">
        <h2>
          In the class <span className="roster-count">{room.players.length}</span>
        </h2>
        {room.players.length === 0 ? (
          <p className="hint">Nobody yet. Names appear here as students join.</p>
        ) : (
          <ul className="roster-list">
            {room.players.map((player) => {
              const label = labels.get(player.id) ?? player.name
              return (
                <li key={player.id}>
                  <Presence online={player.online} />
                  <span className="roster-name">{label}</span>
                  <button className="icon-btn" aria-label={`Remove ${label}`} onClick={() => onRemove(player.id, label)}>
                    <Icon name="cross" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Presence({ online }: { online: boolean }) {
  return <span className={`presence${online ? ' on' : ''}`} role="img" aria-label={online ? 'online' : 'offline'} />
}

interface ProgressPanelProps {
  room: ClassRoom
  levels: Level[]
  tierNames: Record<number, string>
  showNames: boolean
  onPick: (levelId: string) => void
}

// Students down the side, levels across the top: what each has finished, tried, and has open now.
function ProgressPanel({ room, levels, tierNames, showNames, onPick }: ProgressPanelProps) {
  const rows = useMemo(() => progressBoard(room, levels, showNames), [room, levels, showNames])
  const tiers = useMemo(() => boardTiers(room, levels), [room, levels])
  const shown = levels.filter((level) => tiers.includes(level.tier))
  const numberInTier = (level: Level) => levels.filter((l) => l.tier === level.tier).indexOf(level) + 1
  // A line down the board where each tier starts.
  const starts = new Set(shown.filter((level, i) => i === 0 || shown[i - 1].tier !== level.tier).map((level) => level.id))
  if (rows.length === 0) {
    return (
      <section className="card">
        <p className="hint">Nobody has joined yet. Open Join to show the class code.</p>
      </section>
    )
  }
  return (
    <section className="card board-panel">
      <div className="table-scroll">
        <table className="data-table class-board">
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Student
              </th>
              <th scope="col" rowSpan={2} className="now-col">
                Playing now
              </th>
              <th scope="col" rowSpan={2}>
                Done
              </th>
              {tiers.map((tier) => (
                <th key={tier} scope="colgroup" colSpan={levels.filter((l) => l.tier === tier).length} className="tier-head tier-start" title={tierNames[tier]}>
                  Tier {tier}
                </th>
              ))}
            </tr>
            <tr>
              {shown.map((level) => (
                <th key={level.id} scope="col" className={`level-head${starts.has(level.id) ? ' tier-start' : ''}`}>
                  <button
                    className="level-link"
                    title={`${level.title}: see everyone's answers`}
                    aria-label={`Tier ${level.tier}, level ${numberInTier(level)}: ${level.title}`}
                    onClick={() => onPick(level.id)}
                  >
                    {numberInTier(level)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Presence online={row.online} /> {row.label}
                </th>
                <td className="now-col">
                  {row.now ? (
                    <button className="level-link wide" onClick={() => onPick(row.now!.id)}>
                      {row.now.title}
                    </button>
                  ) : (
                    '–'
                  )}
                </td>
                <td>
                  {row.done}
                  {row.stars > 0 && (
                    <small>
                      <Icon name="star" /> {row.stars}
                    </small>
                  )}
                </td>
                {shown.map((level) => (
                  <BoardCell key={level.id} cell={row.cells.get(level.id)!} possible={maxStars(level)} start={starts.has(level.id)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="hint board-key" aria-label="Key">
        <li>
          <span className="cell-key done">
            <Icon name="check" />
          </span>
          finished, with stars earned
        </li>
        <li>
          <span className="cell-key tried" /> tried in class
        </li>
        <li>
          <span className="cell-key here" /> playing now
        </li>
      </ul>
      <p className="hint">Tap a level's number to see everyone's answers on it.</p>
    </section>
  )
}

function BoardCell({ cell, possible, start }: { cell: Cell; possible: number; start: boolean }) {
  const said = [cell.done ? (possible > 0 ? `finished, ${cell.stars} of ${possible} stars` : 'finished') : cell.tried ? 'tried' : '', cell.here ? 'playing now' : '']
    .filter(Boolean)
    .join(', ')
  return (
    <td className={`cell${cell.done ? ' done' : cell.tried ? ' tried' : ''}${cell.here ? ' here' : ''}${start ? ' tier-start' : ''}`}>
      {cell.done && <Icon name="check" />}
      {cell.done && possible > 0 && <span className="cell-stars">{cell.stars}</span>}
      <span className="visually-hidden">{said || 'not started'}</span>
    </td>
  )
}

interface AnswersPanelProps {
  room: ClassRoom
  level: Level
  levels: Level[]
  tierNames: Record<number, string>
  showNames: boolean
  focus: string | null
  onPick: (levelId: string) => void
  onFocus: (levelId: string | null) => void
  onWatch: (plan: Choices | null) => void
}

function AnswersPanel({ room, level, levels, tierNames, showNames, focus, onPick, onFocus, onWatch }: AnswersPanelProps) {
  const answers = useMemo(() => levelAnswers(level, room, showNames), [level, room, showNames])
  const tiers = [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b)
  return (
    <section className="card answers-panel">
      <div className="answers-top">
        <label className="level-picker">
          <span>Level</span>
          <select value={level.id} onChange={(event) => onPick(event.target.value)}>
            {tiers.map((tier) => (
              <optgroup key={tier} label={`Tier ${tier}: ${tierNames[tier]}`}>
                {levels
                  .filter((l) => l.tier === tier)
                  .map((l, i) => (
                    <option key={l.id} value={l.id}>
                      {tier}.{i + 1} {l.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {focus === level.id ? (
          <div className="sent">
            <span className="sent-tag">
              <Icon name="group" /> Everyone was sent here
            </span>
            <button className="btn" onClick={() => onFocus(null)}>
              Let them play any level
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={() => onFocus(level.id)}>
            Send everyone here <Icon name="next" />
          </button>
        )}
      </div>
      <p className="answer-counts">
        <strong>{answers.answered}</strong> of {answers.total} {answers.total === 1 ? 'student has' : 'students have'} answered
        {answers.here > 0 && (
          <>
            {' '}
            · <strong>{answers.here}</strong> on this level now
          </>
        )}
      </p>
      <ClassAnswers level={level} answers={answers} showNames={showNames} onWatch={onWatch} />
    </section>
  )
}

function ClassGone({ code, failed, onRetry, onBack }: { code: string; failed: boolean; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="screen host">
      <section className="card class-gone">
        <h1>{failed ? "Can't open this class" : 'This class has ended'}</h1>
        <p>
          {failed
            ? `This device couldn't open class ${formatCode(code)}. It may have ended, or the class service can't be reached right now.`
            : `Class ${formatCode(code)} is over, and everything in it has been deleted.`}
        </p>
        <div className="actions">
          {failed && (
            <button className="btn primary big" onClick={onRetry}>
              Try again
            </button>
          )}
          <button className={`btn big${failed ? '' : ' primary'}`} onClick={onBack}>
            Back to the game
          </button>
        </div>
      </section>
    </div>
  )
}
