import type { ReactNode } from 'react'
import { levelState, maxStars } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import type { Preferences } from '../progress/store.ts'
import { Icon } from './icons.tsx'
import { Stars } from './parts.tsx'

interface LevelListProps {
  levels: Level[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
  stars: ReadonlyMap<string, number>
  player: ReactNode
  preferences: Preferences
  onPreferences: (preferences: Preferences) => void
  onOpen: (level: Level) => void
}

// Explanations can be folded away once the player has finished the core lessons (spec §6).
const CORE_DONE = 'tier3-read'

export function LevelList({ levels, tierNames, completed, stars, player, preferences, onPreferences, onOpen }: LevelListProps) {
  const tiers = [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b)
  return (
    <div className="screen home">
      <header className="hero">
        <h1>TOC Factory</h1>
        <p>
          Run a toy robot factory, a candle workshop, a print shop, and a bakery with its own shop. Find the step that holds
          everything back, make the whole line flow, and keep it flowing through breakdowns, late trucks, rush orders, and
          forecasts that are always wrong.
        </p>
      </header>
      {player}
      {completed.has(CORE_DONE) && (
        <fieldset className="lever settings">
          <legend>
            <Icon name="rule" /> Explanations after each run
          </legend>
          <div className="chips">
            {[
              { brief: false, label: 'Show them in full' },
              { brief: true, label: 'Brief: tap "Why?" to read more' },
            ].map((option) => (
              <button
                key={option.label}
                className={`chip${preferences.brief === option.brief ? ' on' : ''}`}
                aria-pressed={preferences.brief === option.brief}
                onClick={() => onPreferences({ ...preferences, brief: option.brief })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {tiers.map((tier) => (
        <section key={tier} className="tier">
          <h2>
            <span className="tier-chip">Tier {tier}</span> {tierNames[tier]}
          </h2>
          <ol className="level-cards">
            {levels
              .filter((l) => l.tier === tier)
              .map((level, i) => {
                const state = levelState(level, completed)
                const possible = maxStars(level)
                return (
                  <li key={level.id}>
                    <button className={`level-card ${state}`} disabled={state === 'locked'} onClick={() => onOpen(level)}>
                      <span className="level-number">{i + 1}</span>
                      <span className="level-text">
                        <strong>{level.title}</strong>
                        <span className="principle">{level.principles.map((p) => principleNames[p]).join(' · ')}</span>
                      </span>
                      <span className="level-state">
                        {possible > 0 && state !== 'locked' && <Stars earned={stars.get(level.id) ?? 0} max={possible} />}
                        {state === 'completed' && (
                          <>
                            <Icon name="check" /> Done
                          </>
                        )}
                        {state === 'locked' && (
                          <>
                            <Icon name="lock" /> Locked
                          </>
                        )}
                        {state === 'unlocked' && (
                          <>
                            Play <Icon name="next" />
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
          </ol>
        </section>
      ))}
    </div>
  )
}
