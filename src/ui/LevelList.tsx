import { levelState, maxStars } from '../levels/graph.ts'
import { principleNames } from '../levels/principles.ts'
import type { Level } from '../levels/types.ts'
import { Icon } from './icons.tsx'
import { Stars } from './parts.tsx'

interface LevelListProps {
  levels: Level[]
  tierNames: Record<number, string>
  completed: ReadonlySet<string>
  stars: ReadonlyMap<string, number>
  onOpen: (level: Level) => void
}

export function LevelList({ levels, tierNames, completed, stars, onOpen }: LevelListProps) {
  const tiers = [...new Set(levels.map((l) => l.tier))].sort((a, b) => a - b)
  return (
    <div className="screen home">
      <header className="hero">
        <h1>TOC Factory</h1>
        <p>Run a toy robot factory. Find the step that holds everything back, then make the whole line flow.</p>
      </header>
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
      <p className="more">More tiers are on the way.</p>
    </div>
  )
}
