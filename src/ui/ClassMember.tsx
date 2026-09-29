import { useState, type FormEvent } from 'react'
import { NoSuchClass } from '../classroom/backend.ts'
import { cleanCode, formatCode } from '../classroom/code.ts'
import type { ClassMember } from '../classroom/useClassMember.ts'
import type { Level } from '../levels/types.ts'
import { cleanNickname, NICKNAME_MAX } from '../progress/store.ts'
import { Dialog } from './Dialog.tsx'
import { Icon } from './icons.tsx'

interface JoinClassProps {
  // The code from a class's QR code, or '' to type one.
  initialCode: string
  // The player's nickname, or null if they haven't chosen one yet.
  nickname: string | null
  onJoin: (code: string, nickname: string) => Promise<void>
  onCancel: () => void
}

// A student joins with the code on the TV, as the nickname they play under.
export function JoinClassDialog({ initialCode, nickname, onJoin, onCancel }: JoinClassProps) {
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState(nickname ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clean = cleanCode(code)
  const ready = clean !== null && cleanNickname(name) !== '' && !busy

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      await onJoin(clean, cleanNickname(name))
    } catch (failure) {
      setError(
        failure instanceof NoSuchClass
          ? `No class is open with the code ${formatCode(clean)}. Check the code on the screen.`
          : "Couldn't reach the class. Check this device is online, then try again.",
      )
      setBusy(false)
    }
  }

  return (
    <Dialog
      kicker="Class"
      title="Join a class"
      actions={
        <>
          <button className="btn primary big" type="submit" form="join-class" disabled={!ready}>
            {busy ? 'Joining…' : 'Join'} <Icon name="next" />
          </button>
          <button className="btn big" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <form id="join-class" className="join-form" onSubmit={submit}>
        <label>
          <span>Class code</span>
          <input
            className="code-input"
            value={code}
            inputMode="numeric"
            autoComplete="off"
            maxLength={9}
            placeholder="123 456"
            data-autofocus={initialCode === '' ? true : undefined}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {nickname === null ? (
          <label>
            <span>Your nickname</span>
            <input
              value={name}
              maxLength={NICKNAME_MAX}
              autoComplete="off"
              placeholder="Your nickname"
              data-autofocus={initialCode !== '' ? true : undefined}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        ) : (
          <p>
            You'll join as <strong>{nickname}</strong>.
          </p>
        )}
        <p className="hint">Until the class ends, your instructor's screen shows your nickname, the levels you finish, and your answers.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

// On the home screen: the class the player is in, and a way out of it.
export function ClassBar({ code, onLeave }: { code: string; onLeave: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="class-bar">
      <span className="class-icon">
        <Icon name="group" />
      </span>
      <div className="class-text">
        <strong>You're in class {formatCode(code)}</strong>
        <span className="hint">Your instructor's screen shows your nickname, the levels you finish, and your answers.</span>
      </div>
      <button className="btn small" onClick={() => setConfirming(true)}>
        Leave class
      </button>
      {confirming && (
        <Dialog
          kicker="Class"
          title="Leave the class?"
          actions={
            <>
              <button className="btn primary big" onClick={() => setConfirming(false)}>
                Stay in the class
              </button>
              <button
                className="btn big"
                onClick={() => {
                  setConfirming(false)
                  onLeave()
                }}
              >
                Leave
              </button>
            </>
          }
        >
          <p>Your instructor's screen will stop showing your results. Your progress stays on this device.</p>
        </Dialog>
      )}
    </div>
  )
}

interface ClassPromptsProps {
  member: ClassMember
  levels: Level[]
  openLevel: string | null
  onGo: (level: Level) => void
}

// Over any screen: where the instructor sent the class, and word when the class is over.
export function ClassPrompts({ member, levels, openLevel, onGo }: ClassPromptsProps) {
  // The latest send-off the player has answered, or found themselves already at.
  const [seen, setSeen] = useState(0)
  const { meta, notice } = member
  const focus = meta?.focus ? levels.find((level) => level.id === meta.focus) : undefined
  if (meta && focus && openLevel === focus.id && seen < meta.focusAt) setSeen(meta.focusAt)

  if (notice) {
    return (
      <Dialog
        kicker="Class"
        title={notice.kind === 'ended' ? 'The class has ended' : "You're no longer in the class"}
        actions={
          <button className="btn primary big" onClick={member.dismissNotice}>
            OK
          </button>
        }
      >
        <p>
          {notice.kind === 'ended'
            ? 'Thanks for playing along. Your progress stays on this device, so you can keep playing.'
            : `Your instructor took you out of class ${formatCode(notice.code)}. Your progress stays on this device; to join again, tap Join a class.`}
        </p>
      </Dialog>
    )
  }
  if (!meta || !focus || meta.focusAt <= seen || openLevel === focus.id) return null
  return (
    <Dialog
      kicker="Your class"
      title={focus.title}
      actions={
        <>
          <button
            className="btn primary big"
            onClick={() => {
              setSeen(meta.focusAt)
              onGo(focus)
            }}
          >
            Go to this level <Icon name="next" />
          </button>
          <button className="btn big" onClick={() => setSeen(meta.focusAt)}>
            Not now
          </button>
        </>
      }
    >
      <p>
        Your instructor has sent the class to Tier {focus.tier}: {focus.title}.
      </p>
    </Dialog>
  )
}

interface ClassCardsProps {
  // The class this player is in, if any.
  inClass: string | null
  // The class this device hosts, if any.
  hosting: string | null
  onJoin: () => void
  onLeave: () => void
  onHost: () => Promise<void>
  onReturn: () => void
}

// On the home screen: join a class, or be in one; host a class, or get back to the one this device hosts.
export function ClassCards({ inClass, hosting, onJoin, onLeave, onHost, onReturn }: ClassCardsProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const host = async () => {
    setBusy(true)
    setError(null)
    try {
      await onHost()
    } catch {
      setError("Couldn't open a class. Check this device is online, then try again.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="class-cards" aria-label="Class">
      {inClass ? (
        <ClassBar code={inClass} onLeave={onLeave} />
      ) : (
        <button className="level-card class-card" onClick={onJoin}>
          <span className="level-number">
            <Icon name="group" />
          </span>
          <span className="level-text">
            <strong>Join a class</strong>
            <span className="principle">Enter the code on your instructor's screen to play along.</span>
          </span>
          <span className="level-state">
            Join <Icon name="next" />
          </span>
        </button>
      )}
      {hosting && (
        <button className="level-card class-card host-card" onClick={onReturn}>
          <span className="level-number">
            <Icon name="screen" />
          </span>
          <span className="level-text">
            <strong>Your class {formatCode(hosting)} is open</strong>
            <span className="principle">Back to the class screen: who's joined, their progress, and their answers.</span>
          </span>
          <span className="level-state">
            Open <Icon name="next" />
          </span>
        </button>
      )}
      {/* A student in a class has no need to host one. */}
      {!hosting && !inClass && (
        <button className="level-card class-card host-card" onClick={host} disabled={busy}>
          <span className="level-number">
            <Icon name="screen" />
          </span>
          <span className="level-text">
            <strong>Host a class</strong>
            <span className="principle">For instructors: put a class code on the big screen, then follow everyone's progress and answers.</span>
          </span>
          <span className="level-state">
            {busy ? (
              'Opening…'
            ) : (
              <>
                Host <Icon name="next" />
              </>
            )}
          </span>
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
