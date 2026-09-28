import { tier0 } from './tier0.ts'
import { tier1 } from './tier1.ts'
import { tier2 } from './tier2.ts'
import { tier3 } from './tier3.ts'
import { tier5 } from './tier5.ts'
import type { Level } from './types.ts'

export const levels: Level[] = [...tier0, ...tier1, ...tier2, ...tier3, ...tier5]

export const tierNames: Record<number, string> = {
  0: 'Reading the factory',
  1: 'The five focusing steps',
  2: 'Variation and dependent steps',
  3: 'Drum, buffer, rope',
  5: 'More capacity, better rules',
}
