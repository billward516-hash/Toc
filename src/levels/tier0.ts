import type { Level } from './types.ts'

const SHIFT = 480

export const tier0: Level[] = [
  {
    id: 'tier0-pileup',
    tier: 0,
    title: 'Where does the work pile up?',
    principles: [1],
    requires: [],
    briefing:
      "Welcome to the robot toy factory! Every robot moves left to right through four stations. The blocks stacked above a station are parts waiting for it. A green light means a station is working; gray means it's waiting for parts. Watch the shift and look for the station that holds the whole line back.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 } },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 4.6, max: 5.4 } },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'uniform', min: 2.7, max: 3.3 } },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 } },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 101,
    goal: {
      kind: 'identifyBottleneck',
      answer: 'paint',
      prompt: 'Which station holds the whole line back?',
      watchMinutes: 60,
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'answered', correct: true },
        title: 'Yes: Paint sets the pace',
        body: "Parts pile up in front of Paint because it's the slowest step: about 5 minutes per robot, while Cut needs only 2. Assemble and Box can only go as fast as Paint feeds them, so their lights keep going gray. Paint is this line's constraint. Every system has one, and finding it is always the first step. Right now {waiting:paint} parts are waiting for Paint.",
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'cut' },
        title: 'Cut is busy, not the problem',
        body: "Cut works nonstop, but follow its parts: they pile up in front of Paint and wait. Cut isn't holding anyone back. It makes parts faster than the next station can use them.",
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'assemble' },
        title: 'Assemble is waiting, not slowing',
        body: "Watch Assemble's light keep going gray while it waits for parts. A station that waits for work can't be what's holding the line back. Something before it is starving it.",
      },
      {
        trigger: { kind: 'answered', correct: false },
        title: 'Not quite',
        body: 'Look for the station with the biggest pile of parts in front of it, and notice which stations keep waiting for work.',
      },
    ],
  },
  {
    id: 'tier0-busy',
    tier: 0,
    title: 'Busy is not the same as productive',
    principles: [6],
    requires: ['tier0-pileup'],
    briefing:
      "The manager loves the Cut station. It's always busy and makes more parts than anyone, so the manager wants to give Cut the Star Station award. Watch the shift, and keep an eye on each station's Made count and on how many robots actually ship.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 1.3, max: 1.7 } },
        { id: 'mold', name: 'Mold', cycleTime: { kind: 'uniform', min: 1.0, max: 1.4 } },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 0.9, max: 1.3 } },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'uniform', min: 3.6, max: 4.4 } },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 } },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 202,
    goal: {
      kind: 'identifyBottleneck',
      answer: 'assemble',
      prompt: 'Which station really decides how many robots the factory ships?',
      watchMinutes: 60,
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'answered', correct: true },
        title: 'Right: Assemble decides',
        body: "Cut has made {made:cut} parts, but only {shipped} robots have shipped. Most of the rest are sitting in the pile in front of Assemble ({waiting:assemble} right now). Keeping Cut busy didn't ship a single extra robot; it only built a bigger pile. A station can look great on its own and still do nothing for the whole factory. What counts is what the whole line ships.",
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'cut' },
        title: 'Busy, but not productive',
        body: 'Cut has made {made:cut} parts, more than any other station, yet only {shipped} robots have shipped. Where did the rest go? {waiting:assemble} of them are waiting in front of Assemble. Busy is not the same as productive.',
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'mold' },
        title: 'Mold keeps up easily',
        body: "Mold is faster than Cut, so its light often goes gray while it waits for parts. A station that waits can't be the one setting the pace.",
      },
      {
        trigger: { kind: 'answered', correct: false },
        title: 'Not quite',
        body: 'Follow the parts: where do they pile up, and which stations wait? The station that decides output is the one everything after it ends up waiting on.',
      },
    ],
  },
  {
    id: 'tier0-weakest-link',
    tier: 0,
    title: 'The weakest link',
    principles: [2],
    requires: ['tier0-busy'],
    briefing:
      "This line is less predictable. Every station's speed varies from robot to robot, so small piles come and go. Watch longer this time: one station is the weakest link in the chain.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'triangular', min: 1.4, mode: 2.4, max: 5.2 } },
        { id: 'mold', name: 'Mold', cycleTime: { kind: 'triangular', min: 1.0, mode: 2.2, max: 5.4 } },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'triangular', min: 2.8, mode: 4.0, max: 6.4 } },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'triangular', min: 1.6, mode: 3.0, max: 6.6 } },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.5, max: 3.3 } },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    // Chosen because Mold briefly builds a real pile early on before Paint pulls away.
    seed: 326,
    goal: {
      kind: 'identifyBottleneck',
      answer: 'paint',
      prompt: 'Which station is the weakest link, the one that limits the whole factory?',
      watchMinutes: 120,
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'answered', correct: true },
        title: 'You found the weakest link',
        body: 'Paint averages about 4.4 minutes per robot, the slowest of the five. Small piles came and went at Mold and Assemble as speeds varied, but the pile in front of Paint kept growing ({waiting:paint} now). A chain is only as strong as its weakest link: this factory can never ship faster than Paint works, no matter how fast the other stations are.',
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'mold' },
        title: 'A pile that comes and goes',
        body: 'Mold builds a small pile when a few slow parts come in a row, but then it catches up. Look for the pile that keeps growing across the whole shift.',
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'assemble' },
        title: 'Assemble catches up',
        body: 'Assemble gets a small pile now and then, but it clears it. The weakest link is the station whose pile never goes away.',
      },
      {
        trigger: { kind: 'answered', correct: false },
        title: 'Not quite',
        body: 'When speeds vary, piles come and go. Watch which pile keeps growing across the whole shift.',
      },
    ],
  },
]
