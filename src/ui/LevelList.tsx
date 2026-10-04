import type { ReactNode } from 'react'
import { levelState, maxStars, tierParents } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import type { Preferences } from '../progress/store.ts'
import { FullScreenButton } from './FullScreen.tsx'
import { Icon } from './icons.tsx'
import { Stars } from './parts.tsx'
import type { Guide } from './types.ts'

interface LevelListProps {
  levels: Level[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
  stars: ReadonlyMap<string, number>
  player: ReactNode
  // Joining or hosting a class, when class mode is set up.
  classCards?: ReactNode
  // The level the player's class was sent to: playable even if not unlocked yet.
  classLevel?: string | null
  preferences: Preferences
  onPreferences: (preferences: Preferences) => void
  onOpen: (level: Level) => void
  onFreePlay: () => void
  // Opens the course guide for learners, the trainer's guide, or the exam.
  onGuide: (guide: Guide) => void
}

// Explanations can be folded away once the player has finished the core lessons (spec §6).
const CORE_DONE = 'tier3-read'

export function LevelList(props: LevelListProps) {
  const { levels, tierNames, completed, stars, player, classCards, classLevel = null, preferences, onPreferences, onOpen, onFreePlay, onGuide } = props
  const tiers = [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b)
  return (
    <div className="screen home">
      <header className="hero">
        <div className="hero-top">
          <h1>TOC Factory</h1>
          <FullScreenButton />
        </div>
        <p>
          Run a toy robot factory, a candle workshop, a print shop, and a bakery with its own shop. Find the step that holds
          everything back, make the whole line flow, and keep it flowing through breakdowns, late trucks, rush orders, and
          forecasts that are always wrong.
        </p>
      </header>
      <nav className="guide-links" aria-label="Guides">
        <button className="btn small" onClick={() => onGuide('course')}>
          <Icon name="book" /> Course guide
        </button>
        <button className="btn small" onClick={() => onGuide('trainer')}>
          <Icon name="clipboard" /> Trainer guide
        </button>
        <button className="btn small" onClick={() => onGuide('exam')}>
          <Icon name="award" /> Exam and certificate
        </button>
      </nav>
      {player}
      {classCards}
      <ProgressMap levels={levels} tierNames={tierNames} completed={completed} stars={stars} />
      <button className="level-card free" onClick={onFreePlay}>
        <span className="level-number">
          <Icon name="build" />
        </span>
        <span className="level-text">
          <strong>Free play</strong>
          <span className="principle">Build your own line and run it: any stations, any speeds. No stars, no scores.</span>
        </span>
        <span className="level-state">
          Play <Icon name="next" />
        </span>
      </button>
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
        <section key={tier} id={`tier-${tier}`} className="tier">
          <h2>
            <span className="tier-chip">Tier {tier}</span> {tierNames[tier]}
          </h2>
          <ol className="level-cards">
            {levels
              .filter((l) => l.tier === tier)
              .map((level, i) => {
                const state = levelState(level, completed)
                const possible = maxStars(level)
                const sent = level.id === classLevel
                const locked = state === 'locked' && !sent
                return (
                  <li key={level.id}>
                    <button className={`level-card ${state}${sent ? ' sent' : ''}`} disabled={locked} onClick={() => onOpen(level)}>
                      <span className="level-number">{i + 1}</span>
                      <span className="level-text">
                        <strong>{level.title}</strong>
                        <span className="principle">{level.principles.map((p) => principleNames[p]).join(' · ')}</span>
                      </span>
                      <span className="level-state">
                        {sent && (
                          <span className="class-tag">
                            <Icon name="group" /> Your class
                          </span>
                        )}
                        {possible > 0 && !locked && <Stars earned={stars.get(level.id) ?? 0} max={possible} />}
                        {state === 'completed' && (
                          <>
                            <Icon name="check" /> Done
                          </>
                        )}
                        {locked && (
                          <>
                            <Icon name="lock" /> Locked
                          </>
                        )}
                        {(state === 'unlocked' || (state === 'locked' && sent)) && (
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

type Progress = Pick<LevelListProps, 'levels' | 'tierNames' | 'completed' | 'stars'>

// The skill tree at a glance (spec §3.2): the tiers that must be played in order, then the ones they
// open up, in any order. Each links to its levels below.
function ProgressMap({ levels, tierNames, completed, stars }: Progress) {
  const parents = tierParents(levels)
  const tiers = [...parents.keys()].sort((a, b) => a - b)
  const children = (tier: number) => tiers.filter((t) => parents.get(t) === tier)
  const spine = tiers.filter((t) => parents.get(t) === null).slice(0, 1)
  while (spine.length > 0 && children(spine[spine.length - 1]).length === 1) spine.push(children(spine[spine.length - 1])[0])
  const branches = spine.length > 0 ? children(spine[spine.length - 1]) : []
  const node = (tier: number) => (
    <li key={tier}>
      <TierNode tier={tier} name={tierNames[tier]} levels={levels.filter((l) => l.tier === tier)} completed={completed} stars={stars} />
    </li>
  )
  return (
    <nav className="map" aria-label="Progress map">
      <p className="map-note">In order:</p>
      <ol className="spine">{spine.map(node)}</ol>
      {branches.length > 0 && (
        <>
          <p className="map-note">Then Tier {spine[spine.length - 1]} opens all of these, in any order:</p>
          <ol className="branches">{branches.map(node)}</ol>
        </>
      )}
    </nav>
  )
}

function TierNode({ tier, name, levels, completed, stars }: { tier: number; name: string; levels: Level[]; completed: ReadonlySet<string>; stars: ReadonlyMap<string, number> }) {
  const done = levels.filter((l) => completed.has(l.id)).length
  const earned = levels.reduce((sum, l) => sum + (stars.get(l.id) ?? 0), 0)
  const possible = levels.reduce((sum, l) => sum + maxStars(l), 0)
  const locked = levels.length > 0 && levelState(levels[0], completed) === 'locked'
  const state = locked ? 'locked' : done === levels.length ? 'completed' : done > 0 ? 'started' : 'open'
  return (
    <a className={`tier-node ${state}`} href={`#tier-${tier}`}>
      <span className="tier-chip">Tier {tier}</span>
      <strong>{name}</strong>
      <span className="node-state">
        {locked ? (
          <>
            <Icon name="lock" /> Locked
          </>
        ) : (
          <>
            <span>
              {state === 'completed' && <Icon name="check" />} {done} of {levels.length} done
            </span>
            {possible > 0 && (
              <span className="node-stars" aria-label={`${earned} of ${possible} stars`}>
                <Icon name="star" /> {earned}/{possible}
              </span>
            )}
          </>
        )}
      </span>
    </a>
  )
}
