// The exam's rules in one place. The guides quote these numbers, and the tests hold the bank to them.
export const EXAM = {
  // Questions in every exam.
  length: 40,
  // Percent of the questions answered that must be right to pass: 28 of 40.
  passPercent: 70,
  // The most questions added, one at a time, for someone who finishes close to the line.
  maxExtra: 15,
  // Questions in the bank. Each exam draws its own from them.
  bank: 100,
} as const

// How many questions every exam takes from each tier, so each one covers the whole course in the same
// proportions, whichever questions it draws. They add up to EXAM.length.
export const QUOTA: Readonly<Record<number, number>> = { 0: 3, 1: 4, 2: 3, 3: 5, 4: 4, 5: 4, 6: 4, 7: 4, 8: 3, 9: 3, 10: 3 }
