import { useState, type FormEvent } from 'react'
import { cleanNickname, NICKNAME_MAX, type Learner } from '../progress/store.ts'

interface PlayerBarProps {
  learner: Learner
  players: Learner[]
  onChoose: (nickname: string) => void
}

// Who's playing on this device. Nicknames and progress never leave it (spec §8.3).
export function PlayerBar({ learner, players, onChoose }: PlayerBarProps) {
  const [switching, setSwitching] = useState(false)
  const [draft, setDraft] = useState('')
  const naming = learner.nickname === null
  const others = players.filter((p) => p.id !== learner.id)

  const choose = (nickname: string) => {
    onChoose(nickname)
    setDraft('')
    setSwitching(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (cleanNickname(draft)) choose(draft)
  }

  if (!naming && !switching) {
    return (
      <div className="player-bar">
        <span>
          Playing as <strong>{learner.nickname}</strong>
        </span>
        <button className="btn small" onClick={() => setSwitching(true)}>
          Switch player
        </button>
      </div>
    )
  }

  return (
    <form className="player-form card" onSubmit={submit}>
      <label htmlFor="nickname">{naming ? 'What should we call you?' : "Who's playing?"}</label>
      {others.length > 0 && (
        <div className="chips" role="group" aria-label="Players on this device">
          {others.map((player) => (
            <button key={player.id} type="button" className="chip" onClick={() => choose(player.nickname!)}>
              {player.nickname}
            </button>
          ))}
        </div>
      )}
      <div className="player-input">
        <input
          id="nickname"
          value={draft}
          maxLength={NICKNAME_MAX}
          autoComplete="off"
          placeholder={naming ? 'Your nickname' : 'New nickname'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="btn primary" type="submit" disabled={!cleanNickname(draft)}>
          {naming ? 'Save' : 'Switch'}
        </button>
        {switching && (
          <button className="btn" type="button" onClick={() => setSwitching(false)}>
            Cancel
          </button>
        )}
      </div>
      <p className="hint">
        {naming
          ? 'Your nickname and progress stay on this device.'
          : 'A new nickname starts fresh. A nickname already played on this device picks up where it left off.'}
      </p>
    </form>
  )
}
