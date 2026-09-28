import { tier0 } from './tier0.ts'
import { tier1 } from './tier1.ts'
import { tier2 } from './tier2.ts'
import { tier3 } from './tier3.ts'
import { tier4 } from './tier4.ts'
import { tier5 } from './tier5.ts'
import { tier6 } from './tier6.ts'
import { tier7 } from './tier7.ts'
import type { Level } from './types.ts'

export const levels: Level[] = [...tier0, ...tier1, ...tier2, ...tier3, ...tier4, ...tier5, ...tier6, ...tier7]

export const tierNames: Record<number, string> = {
  0: 'Reading the factory',
  1: 'The five focusing steps',
  2: 'Variation and dependent steps',
  3: 'Drum, buffer, rope',
  4: 'Batches and flow',
  5: 'More capacity, better rules',
  6: 'Product mix and profit',
  7: 'When things break',
}
