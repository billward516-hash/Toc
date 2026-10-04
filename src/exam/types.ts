// One question in the bank. A multiple choice question lists its right answer first, then three wrong
// ones; each exam shuffles them, so the order written here never shows. A true/false question is a
// statement and whether it holds.
interface Base {
  // Never renumber or reuse an id: a player's record of the questions they have seen refers to it.
  id: string
  // The tier the question belongs to. It is also the question's topic on the results screen.
  tier: number
  prompt: string
  // Said right after the answer, whether it was right or wrong.
  why: string
  // The level that teaches the idea, for "Taught in 3.2". Taking the exam never needs the level played.
  level: string
}

export interface ChoiceQuestion extends Base {
  kind: 'mc'
  right: string
  wrong: [string, string, string]
}

export interface TrueFalseQuestion extends Base {
  kind: 'tf'
  answer: boolean
}

export type Question = ChoiceQuestion | TrueFalseQuestion

// A question as one exam asks it: the options in the order shown, and which of them is right.
export interface Item {
  id: string
  tier: number
  kind: 'mc' | 'tf'
  prompt: string
  options: string[]
  right: number
  why: string
  level: string
}
