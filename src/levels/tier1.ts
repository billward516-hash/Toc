import type { Break } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
const lunch: Break[] = [{ from: 240, to: 300 }]
const everyStation = (...ids: string[]) => ids

export const tier1: Level[] = [
  {
    id: 'tier1-one-upgrade',
    tier: 1,
    title: 'Spend the upgrade wisely',
    principles: [5],
    requires: ['tier0-weakest-link'],
    briefing:
      "The owner bought one new tool that makes a station 25% faster. Today the factory ships {baseline} robots a shift; the owner wants {target}. Watch the shift, decide which station gets the tool, then run the shift with your plan.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 2.9, max: 3.5 } },
        { id: 'mold', name: 'Mold', cycleTime: { kind: 'uniform', min: 2.0, max: 2.4 } },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 2.4, max: 2.8 } },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'uniform', min: 3.6, max: 4.4 } },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 } },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 111,
    goal: { kind: 'output', target: 140, prompt: 'Which station should get the new tool?' },
    levers: [
      {
        id: 'tool',
        kind: 'upgrade',
        label: 'New tool, 25% faster',
        stations: everyStation('cut', 'mold', 'paint', 'assemble', 'box'),
        factor: 0.75,
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { tool: 'assemble' } },
        title: 'Right tool, right station',
        body: 'Assemble was the constraint, so speeding it up sped up the whole factory: {shipped} robots instead of {baseline}. And look: the pile in front of Assemble is gone. Now Cut, at about 3.2 minutes a robot, is the slowest step, and every other station waits for it. When you elevate a constraint, another one takes its place.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { tool: 'cut' } },
        title: 'A faster Cut, the same factory',
        body: 'Cut got 25% faster, but the factory still shipped {shipped}. The extra parts just made the pile in front of Assemble bigger. Speeding up a station that is not the constraint is a mirage.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not the constraint',
        body: 'The factory shipped {shipped}, the same as before. An improvement anywhere except the constraint does not change what the whole line ships. Watch again for the station with the growing pile.',
      },
    ],
  },
  {
    id: 'tier1-lunch',
    tier: 1,
    title: 'Who covers lunch?',
    principles: [4],
    requires: ['tier1-one-upgrade'],
    briefing:
      'Everyone takes lunch at the same time, from 4:00 to 5:00 into the shift. A floater can keep one station running through lunch. The factory ships {baseline} robots a shift; the owner wants {target}. Where should the floater go?',
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 }, breaks: lunch },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 4.6, max: 5.4 }, breaks: lunch },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'uniform', min: 2.7, max: 3.3 }, breaks: lunch },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.8, max: 2.2 }, breaks: lunch },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 112,
    goal: { kind: 'output', target: 90, prompt: 'Where should the floater cover lunch?' },
    levers: [
      {
        id: 'floater',
        kind: 'coverBreak',
        label: 'The floater covers lunch at',
        stations: everyStation('cut', 'paint', 'assemble', 'box'),
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { floater: 'paint' } },
        title: 'An hour saved at the constraint',
        body: 'With Paint working through lunch, the factory shipped {shipped} instead of {baseline}. An hour lost at the constraint is an hour lost for the whole factory, and it can never be made up. An hour saved there is an hour gained for everyone.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { floater: 'cut' } },
        title: 'Cut had time to spare',
        body: 'Cut makes parts much faster than Paint can use them, so an hour of lunch at Cut costs the factory nothing. Shipments stayed at {shipped}.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'The pile just waited',
        body: 'That station is faster than Paint, so after lunch it quickly caught up on the parts that waited. Shipments stayed at {shipped}. Only time at the constraint turns into more robots.',
      },
    ],
  },
  {
    id: 'tier1-five-steps',
    tier: 1,
    title: 'The five focusing steps',
    principles: [3],
    requires: ['tier1-lunch'],
    briefing:
      "Put it all together. 1. Identify the constraint. 2. Exploit it: don't waste a minute of its time. 3. Subordinate everything else to it. 4. Elevate it: add capacity. 5. If the constraint moves, go back to step 1. This time you have a new tool (30% faster) and a floater for lunch. The factory ships {baseline} robots; the owner wants {target}.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 3.3, max: 3.9 }, breaks: lunch },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 4.6, max: 5.4 }, breaks: lunch },
        { id: 'assemble', name: 'Assemble', cycleTime: { kind: 'uniform', min: 3.8, max: 4.6 }, breaks: lunch },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 2.1, max: 2.7 }, breaks: lunch },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 113,
    goal: { kind: 'output', target: 103, prompt: 'Where do the tool and the floater go?' },
    levers: [
      {
        id: 'tool',
        kind: 'upgrade',
        label: 'New tool, 30% faster',
        stations: everyStation('cut', 'paint', 'assemble', 'box'),
        factor: 0.7,
      },
      {
        id: 'floater',
        kind: 'coverBreak',
        label: 'The floater covers lunch at',
        stations: everyStation('cut', 'paint', 'assemble', 'box'),
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { tool: 'paint', floater: 'assemble' } },
        title: 'All five steps',
        body: "You elevated Paint with the tool, then saw that the constraint moved: Assemble became the slowest step, so the floater covered Assemble's lunch. {shipped} robots instead of {baseline}. That's step 5: whenever you break a constraint, go back to step 1 and look again.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { tool: 'paint', floater: 'paint' } },
        title: 'The constraint moved',
        body: "The tool made Paint faster, so Paint was no longer the constraint. Assemble was. Covering Paint's lunch protected a station with time to spare, so the factory shipped {shipped}. After you elevate a constraint, go back to step 1 and find the new one.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { tool: 'paint' } },
        title: 'Half the job',
        body: "The tool went to the right station and the factory shipped {shipped}. Now think about step 5: once Paint is faster, which station is the slowest? That's the one whose lunch matters.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { floater: 'paint' } },
        title: 'Protected, but not elevated',
        body: "Covering Paint's lunch was a good step 2, but the tool went to a station that isn't the constraint, so the factory shipped {shipped}.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Start with step 1',
        body: 'The factory shipped {shipped}. Which station holds the line back? Start there, then ask what happens after you speed it up.',
      },
    ],
  },
]
