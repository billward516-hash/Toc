// Questions that test the same idea, in groups. An exam never asks two from one group: the reason shown
// right after the first answer would hand over the answer to the second. Most groups are a true/false
// statement and the multiple choice question it restates; the last two are one claim each, made in three tiers.
//
// Add a group when a new question repeats what an old question's explanation says. Every group costs a
// little room: with 100 questions and up to 55 asked, only so many ideas are left for the extra questions,
// so the last of them (the 14th or 15th, which almost nobody reaches) may repeat one as a last resort.
// The tests check how far that goes.
export const SAME_IDEA: readonly (readonly string[])[] = [
  ['0-1', '0-3', '0-5'],
  ['1-2', '1-3'],
  ['1-5', '1-10'],
  ['1-6', '1-7', '1-8'],
  ['2-1', '2-2', '2-6'],
  ['2-3', '2-4', '2-7'],
  ['2-5', '2-8'],
  ['3-2', '3-11', '3-12'],
  ['3-3', '3-4', '3-5'],
  ['3-7', '3-10'],
  ['3-8', '3-9'],
  ['4-1', '4-6', '4-9'],
  ['4-3', '4-8'],
  ['4-4', '4-5', '4-7'],
  ['5-1', '5-4', '5-8', '5-10'],
  ['5-5', '5-6', '5-9'],
  ['6-1', '6-7'],
  ['6-2', '6-6'],
  ['6-3', '6-8'],
  ['6-4', '6-9'],
  ['7-1', '7-2', '7-8'],
  ['7-4', '7-9'],
  ['7-5', '7-10'],
  ['8-1', '8-6'],
  ['8-4', '8-7'],
  ['8-5', '8-8'],
  ['9-1', '9-6'],
  ['9-2', '9-8'],
  ['9-3', '9-7'],
  ['9-4', '9-5'],
  ['10-2', '10-7'],
  ['10-4', '10-8'],
  ['1-4', '5-10'],
  ['1-8', '4-8', '10-6'],
  ['1-9', '4-9', '7-8'],
]
