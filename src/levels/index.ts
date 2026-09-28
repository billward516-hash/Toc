import { tier0 } from './tier0.ts'
import type { Level } from './types.ts'

export const levels: Level[] = [...tier0]

export const tierNames: Record<number, string> = {
  0: 'Reading the factory',
}
