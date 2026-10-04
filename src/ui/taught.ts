import { levelNumber } from '../course/numbering.ts'
import { levels } from '../levels/index.ts'

// Where the idea in a question is taught, for example "3.2 Size the buffer", or nothing if the level is gone.
export function taughtIn(levelId: string): string {
  const level = levels.find((l) => l.id === levelId)
  return level ? `${levelNumber(level)} ${level.title}` : ''
}
