import { EXAM } from './config.ts'

// The pass mark and the extra questions, as pure functions of how many questions have been answered and
// how many of those were right. All whole-number arithmetic, so 70% is exact: 28 of 40 passes and 27 of
// 40 does not, and no rounding ever decides a result.

const longest = EXAM.length + EXAM.maxExtra

// Whether this many right out of this many answered is a pass.
export const passes = (correct: number, asked: number): boolean => asked > 0 && correct * 100 >= EXAM.passPercent * asked

// The most wrong answers that still leave a pass when `asked` questions have been answered.
export const mostWrongAllowed = (asked: number): number => Math.floor((asked * (100 - EXAM.passPercent)) / 100)

// A whole percent for showing. It rounds down, so a score that misses the pass mark never shows as 70%.
export const percentOf = (correct: number, asked: number): number => (asked === 0 ? 0 : Math.floor((100 * correct) / asked))

// How many more questions could still be added.
export const extraLeft = (asked: number): number => Math.max(0, longest - asked)

// How many right answers in a row would lift the score up to the pass mark, and 0 if it is there already.
export function correctInARow(asked: number, correct: number): number {
  // (correct + k) * 100 >= passPercent * (asked + k), solved for k.
  const short = EXAM.passPercent * asked - 100 * correct
  return short <= 0 ? 0 : Math.ceil(short / (100 - EXAM.passPercent))
}

// Whether a pass is still within reach, answering every remaining question right, extra ones included.
export const canStillPass = (asked: number, correct: number): boolean => correctInARow(asked, correct) <= extraLeft(asked)

export type Next =
  // More of the main questions to go.
  | { kind: 'ask' }
  // Below the pass mark but within reach: one more question. `starting` is true for the first of them.
  | { kind: 'extend'; starting: boolean }
  | { kind: 'done'; passed: boolean }

// What happens after an answer. The exam is EXAM.length questions. Someone at or above the pass mark
// after them has passed. Someone below it, but still able to get there, is asked up to EXAM.maxExtra
// more questions, one at a time, and passes the moment their overall score reaches the pass mark.
// Extra questions that could not change the result are never asked.
export function next(asked: number, correct: number): Next {
  if (asked < EXAM.length) return { kind: 'ask' }
  if (passes(correct, asked)) return { kind: 'done', passed: true }
  if (asked >= longest || !canStillPass(asked, correct)) return { kind: 'done', passed: false }
  return { kind: 'extend', starting: asked === EXAM.length }
}

export type Risk = 'safe' | 'close' | 'at-risk' | 'out-of-reach'

// How the exam is going, for the status shown after every answer.
//   safe          a pass is on track
//   close         at most two more mistakes before the pass mark slips out of reach in the main questions
//   at-risk       below the pass mark, but extra questions could still get there
//   out-of-reach  too many wrong answers to reach the pass mark, even with every extra question
export function risk(asked: number, correct: number): Risk {
  if (!canStillPass(asked, correct)) return 'out-of-reach'
  if (asked >= EXAM.length) return passes(correct, asked) ? 'safe' : 'at-risk'
  const spare = mostWrongAllowed(EXAM.length) - (asked - correct)
  if (spare < 0) return 'at-risk'
  return spare <= 2 ? 'close' : 'safe'
}

// Mistakes still allowed in the main questions before a pass needs extra ones (never below 0).
export const mistakesToSpare = (asked: number, correct: number): number => Math.max(0, mostWrongAllowed(EXAM.length) - (asked - correct))

// Right answers needed, out of the questions in the exam, to pass.
export const correctToPass = (): number => Math.ceil((EXAM.passPercent * EXAM.length) / 100)

// The fewest right answers out of the main questions with which the extra ones could still lift the score
// to the pass mark. Below this, the exam ends after the main questions.
export function fewestForExtra(): number {
  let correct = 0
  while (correct < EXAM.length && !canStillPass(EXAM.length, correct)) correct++
  return correct
}
