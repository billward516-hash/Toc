import { levels } from '../levels/index.ts'
import type { Level } from '../levels/types.ts'

// A level's number, as the class screen's level picker shows it: its tier, then its place in the
// tier, so "Where does the work pile up?" is 0.1.
const numbers = new Map<string, string>()
const counts = new Map<number, number>()
for (const level of levels) {
  const place = (counts.get(level.tier) ?? 0) + 1
  counts.set(level.tier, place)
  numbers.set(level.id, `${level.tier}.${place}`)
}

export const levelNumber = (level: Level): string => numbers.get(level.id) ?? String(level.tier)
