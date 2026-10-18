import { fillCourse } from './summary.ts'
import type { OverviewSection, Step, Term } from './types.ts'

// The loading lab in the course guides: its words for the learner's key terms, the "get started" page
// for it, and the filler that writes the lab's own numbers into the guide's text.

export const LAB_NAME = 'The loading lab'

// The lab's texts quote its own numbers as {lab90}, {fleetOne}, {labDays}, and so on, and the course's as
// {levels}. All are filled in by fillCourse.
export const fillLab = fillCourse

export const fillLabStep = (step: Step): Step => ({ ...step, text: fillLab(step.text), ...(step.note ? { note: fillLab(step.note) } : {}) })

// Key terms the lab brings up. They are not tied to a tier.
export const labTerms: Omit<Term, 'tier'>[] = [
  {
    term: 'Loading',
    meaning:
      'How busy you keep a step, as a share of what it can do. The bottleneck at 100% never gets a break. In the lab it is the orders you send in each hour, against what the bottleneck can make.',
  },
  {
    term: 'Cycle time',
    meaning:
      'How long one order takes from the day it starts to the day it ships: the minutes it is being worked on plus the minutes it waits in piles. The game calls the wait from release to shipping the lead time.',
  },
  {
    term: 'The knee',
    meaning:
      'The bend in the curve of cycle time against loading. Before it, a little more work costs almost no time. After it, every extra order makes everyone wait. In the lab it falls around 90% to 95% of what the bottleneck can make.',
  },
  {
    term: 'Sweet spot',
    meaning: 'The load just before the knee: the bottleneck is nearly full, so output is nearly as high as it goes, and cycle time is still short.',
  },
  {
    term: 'Near-equal bottlenecks',
    meaning:
      'Stations about as slow as the slowest. Each is another place for work to queue, and none has the spare time to clear a pile, so the knee comes sooner than with one clear bottleneck.',
  },
  {
    term: 'Order (lot)',
    meaning:
      'A customer\'s demand, in the lab\'s fab rounds. Its size is not yours to change, it must ship full, and it ships only when all of it is done, so a part finished early cannot go.',
  },
  {
    term: 'Whole fleet',
    meaning:
      'Running a workgroup with all its tools dedicated to one order at a time, so orders never mix. It is how most workgroups run. Some can be divided into single tools instead.',
  },
  {
    term: 'Top-up',
    meaning:
      'A short extra run for an order whose yield came out below what it was started for. The order waits for it before it can ship. Starting for the worst yield avoids top-ups at the cost of spare wafers.',
  },
  {
    term: 'Hot order',
    meaning: 'An order promised sooner than the rest. A promise like that is kept by running hot orders first, but nothing interrupts the order already running.',
  },
]

// The Course guide's page on the lab.
export const labGettingStarted: OverviewSection[] = [
  {
    id: 'lab',
    title: 'The loading lab',
    blocks: [
      {
        kind: 'p',
        text: 'The loading lab is a short game outside the levels. You load a line with more and fewer orders and watch what happens to cycle time. It has five rounds of a few minutes each, and nothing in it is scored.',
      },
      {
        kind: 'list',
        items: [
          'Open it from the home screen: the Loading lab card, above Free play.',
          'Each round gives a mission. Slide the load, tap Run the day, and read what happened. Every run in a round is the same day with the same luck, so only your choices change the result.',
          'The chart marks each of your runs as a numbered dot. Tap Show the average of {labDays} days to see the curve many days average to.',
          'The first three rounds use the toy robot line. Rounds 4 and 5 move to a fab, where an order is a lot of wafers that must ship full.',
          'Your instructor\'s class screen does not show the lab. Tell them what you found.',
        ],
      },
    ],
  },
]
