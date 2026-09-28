import type { StoredEvent } from '../progress/store.ts'
import { leverValues } from './levers.ts'
import type { Choices, Level } from './types.ts'

// A plan the player has run on a level, with how it did: the best stars it earned, whether it ever
// met the goal, and how many times it ran (fresh days differ from run to run).
export interface PlanTried {
  plan: Choices
  tries: number
  stars: number
  met: boolean
}

// The plan as the level's levers read it, one choice per lever in order: two runs of the same plan
// share it.
export const planKey = (level: Level, plan: Choices) => level.levers.map((lever) => plan[lever.id]).join('|')

// Every distinct plan the player has run on this level, in the order first tried. Runs saved under an
// older version of the level whose choices no longer fit its levers are left out.
export function plansTried(level: Level, history: readonly StoredEvent[]): PlanTried[] {
  const plans = new Map<string, PlanTried>()
  for (const event of history) {
    if (event.type !== 'ran' || event.levelId !== level.id) continue
    const fits = level.levers.every((lever) => leverValues(lever).includes(event.choices[lever.id]))
    if (!fits) continue
    const key = planKey(level, event.choices)
    const seen = plans.get(key)
    const plan = Object.fromEntries(level.levers.map((lever) => [lever.id, event.choices[lever.id]]))
    plans.set(key, {
      plan: seen?.plan ?? plan,
      tries: (seen?.tries ?? 0) + 1,
      stars: Math.max(seen?.stars ?? 0, event.stars),
      met: (seen?.met ?? false) || event.met,
    })
  }
  return [...plans.values()]
}
