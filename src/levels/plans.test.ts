import { describe, expect, it } from 'vitest'
import type { ProgressEvent, StoredEvent } from '../progress/store.ts'
import { levels } from './index.ts'
import { planKey, plansTried } from './plans.ts'
import type { Level } from './types.ts'

const upgrade = levels.find((l) => l.id === 'tier1-one-upgrade')!
const stamp = (event: ProgressEvent, minute: number): StoredEvent => ({ ...event, learnerId: 'sam', at: `2026-09-28T01:${String(minute).padStart(2, '0')}:00Z` })
const ran = (level: Level, choices: Record<string, string>, stars: number, minute: number): StoredEvent =>
  stamp({ type: 'ran', levelId: level.id, choices, shipped: 100, met: stars > 0, stars }, minute)

describe('plans the player has tried', () => {
  it('lists each plan once, in the order first tried, with its best result', () => {
    const history = [
      ran(upgrade, { tool: 'cut' }, 0, 1),
      ran(upgrade, { tool: 'assemble' }, 1, 2),
      ran(upgrade, { tool: 'cut' }, 0, 3),
      ran(upgrade, { tool: 'paint' }, 0, 4),
    ]
    expect(plansTried(upgrade, history)).toEqual([
      { plan: { tool: 'cut' }, tries: 2, stars: 0, met: false },
      { plan: { tool: 'assemble' }, tries: 1, stars: 1, met: true },
      { plan: { tool: 'paint' }, tries: 1, stars: 0, met: false },
    ])
  })

  it('keeps the best stars and any success across tries of the same plan', () => {
    const history = [ran(upgrade, { tool: 'assemble' }, 1, 1), ran(upgrade, { tool: 'assemble' }, 0, 2)]
    expect(plansTried(upgrade, history)).toEqual([{ plan: { tool: 'assemble' }, tries: 2, stars: 1, met: true }])
  })

  it("ignores other levels, other events, and plans that no longer fit the level's levers", () => {
    const other = levels.find((l) => l.id === 'tier1-lunch')!
    const history = [
      stamp({ type: 'started', levelId: upgrade.id }, 1),
      stamp({ type: 'completed', levelId: upgrade.id }, 2),
      ran(other, { [other.levers[0].id]: 'paint' }, 1, 3),
      ran(upgrade, { tool: 'oven' }, 1, 4),
      ran(upgrade, {}, 1, 5),
      ran(upgrade, { tool: 'box', old: 'lever' }, 0, 6),
    ]
    expect(plansTried(upgrade, history)).toEqual([{ plan: { tool: 'box' }, tries: 1, stars: 0, met: false }])
  })

  it('reads a plan by its levers in order', () => {
    const two: Level = { ...upgrade, levers: [upgrade.levers[0], { ...upgrade.levers[0], id: 'second' }] }
    expect(planKey(two, { second: 'cut', tool: 'box' })).toBe('box|cut')
    expect(planKey(two, { tool: 'box', second: 'cut' })).toBe('box|cut')
  })
})
