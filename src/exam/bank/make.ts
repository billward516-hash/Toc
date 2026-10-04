import type { ChoiceQuestion, Question, TrueFalseQuestion } from '../types.ts'

type Draft<T> = T extends unknown ? Omit<T, 'tier'> : never

// A multiple choice question: its id, the level that teaches the idea, the question, the right answer,
// three wrong ones, and the reason, which the player reads right after answering.
export const choice = (id: string, level: string, prompt: string, right: string, wrong: [string, string, string], why: string): Draft<ChoiceQuestion> => ({
  id,
  level,
  kind: 'mc',
  prompt,
  right,
  wrong,
  why,
})

// A true/false question: a statement, and whether it holds.
export const truth = (id: string, level: string, prompt: string, answer: boolean, why: string): Draft<TrueFalseQuestion> => ({
  id,
  level,
  kind: 'tf',
  prompt,
  answer,
  why,
})

// A tier's questions. Ids are the tier and a number that is never reused (3-7 is the seventh question
// written for Tier 3), because a player's record of what they have seen refers to them.
export function forTier(tier: number, drafts: Draft<Question>[]): Question[] {
  return drafts.map((draft) => ({ ...draft, tier }) as Question)
}
