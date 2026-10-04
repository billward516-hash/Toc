import type { Question } from '../types.ts'
import { tier0 } from './tier0.ts'
import { tier1 } from './tier1.ts'
import { tier10 } from './tier10.ts'
import { tier2 } from './tier2.ts'
import { tier3 } from './tier3.ts'
import { tier4 } from './tier4.ts'
import { tier5 } from './tier5.ts'
import { tier6 } from './tier6.ts'
import { tier7 } from './tier7.ts'
import { tier8 } from './tier8.ts'
import { tier9 } from './tier9.ts'

// The question bank: 100 questions in all, from which every exam draws its own 40 (and a few extra for
// someone close to the pass mark). Each question can be answered without having played the game or
// taken the course; the stem gives what it needs.
export const bank: readonly Question[] = [...tier0, ...tier1, ...tier2, ...tier3, ...tier4, ...tier5, ...tier6, ...tier7, ...tier8, ...tier9, ...tier10]

export { SAME_IDEA } from './sameIdea.ts'
