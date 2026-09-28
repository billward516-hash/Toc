import { describe, expect, it } from 'vitest'
import { mean } from '../engine/distributions.ts'
import { simulate } from '../engine/simulate.ts'
import { snapshotAt } from '../engine/timeline.ts'
import { validateLevels } from './graph.ts'
import { levels } from './index.ts'
import { principleNames } from './principles.ts'
import { fillTemplate } from './template.ts'

const seeds = (level: { seed: number }) => [level.seed, ...Array.from({ length: 30 }, (_, i) => i + 1)]

describe('level content', () => {
  it('is structurally valid', () => {
    expect(validateLevels(levels)).toEqual([])
  })

  it('names every principle it teaches', () => {
    for (const level of levels) {
      for (const p of level.principles) expect(principleNames[p], `${level.id} principle ${p}`).toBeDefined()
    }
  })

  for (const level of levels) {
    describe(level.id, () => {
      const answer = level.model.stations.findIndex((s) => s.id === level.goal.answer)

      it('makes the answer the slowest station on average', () => {
        const pace = level.model.stations.map((s) => mean(s.cycleTime) / (s.servers ?? 1))
        expect(pace.indexOf(Math.max(...pace))).toBe(answer)
      })

      it('grows the biggest pile in front of the answer by the end of the shift, whatever the seed', () => {
        for (const seed of seeds(level)) {
          const end = snapshotAt(simulate(level.model, seed), level.model.horizon)
          expect(end.queues.indexOf(Math.max(...end.queues)), `seed ${seed}`).toBe(answer)
        }
      })

      it('fills every number its pop-ups quote', () => {
        const early = snapshotAt(simulate(level.model, level.seed), level.goal.watchMinutes)
        for (const popup of level.popups) {
          expect(fillTemplate(popup.body, level.model, early)).not.toMatch(/[{}]/)
        }
      })
    })
  }

  it('makes Cut look like the star in the busy level: far more parts made than robots shipped', () => {
    const busy = levels.find((l) => l.id === 'tier0-busy')!
    for (const seed of seeds(busy)) {
      const result = simulate(busy.model, seed)
      expect(result.stations[0].completed).toBeGreaterThan(2 * result.output)
    }
  })
})

describe('fillTemplate', () => {
  const level = levels[0]
  const snap = snapshotAt(simulate(level.model, level.seed), 100)

  it('quotes the run', () => {
    const paint = level.model.stations.findIndex((s) => s.id === 'paint')
    expect(fillTemplate('{shipped} shipped, {made:cut} cut, {waiting:paint} waiting', level.model, snap)).toBe(
      `${snap.shipped} shipped, ${snap.completed[0]} cut, ${snap.queues[paint]} waiting`,
    )
  })

  it('leaves unknown stations visible so content tests catch them', () => {
    expect(fillTemplate('{made:glue}', level.model, snap)).toBe('{made:glue}')
  })
})
