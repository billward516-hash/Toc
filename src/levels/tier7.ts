import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel, Station, Supply } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })
const fixed = (minutes: number): Dist => ({ kind: 'fixed', value: minutes })
const between = (min: number, max: number): Dist => ({ kind: 'uniform', min, max })

// The robot factory from Tiers 0-3, running drum-buffer-rope: Paint is the constraint, and a rope keeps
// 8 robots on their way to it.
const factory = (changes: Record<string, Partial<Station>> = {}, extra: Partial<FactoryModel> = {}): FactoryModel => ({
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: about(2.6) },
    { id: 'mold', name: 'Mold', cycleTime: about(2.3) },
    { id: 'paint', name: 'Paint', cycleTime: about(4) },
    { id: 'assemble', name: 'Assemble', cycleTime: about(2.6) },
    { id: 'box', name: 'Box', cycleTime: about(2.6) },
  ].map((station) => ({ ...station, ...changes[station.id] })),
  release: { kind: 'rope', constraint: 'paint', buffer: 8 },
  horizon: SHIFT,
  ...extra,
})

// A surge knocks out Mold and Assemble together, some time in the morning. The one repair crew takes
// 30 minutes per machine, so whichever it fixes second is down 90 minutes.
const surge = (mold: number, assemble: number): Partial<FactoryModel> => ({
  incidents: [
    {
      at: between(60, 180),
      outages: [
        { station: 'mold', lasts: fixed(mold) },
        { station: 'assemble', lasts: fixed(assemble) },
      ],
    },
  ],
})

// A truck brings 30 bags of plastic, two hours' worth, at 2:00, 4:00, and 6:00, each 20 to 110 minutes late.
const plastic = (onHand: number): Supply => ({
  name: 'plastic',
  onHand,
  deliveries: [120, 240, 360].map((due) => ({ due, amount: 30, late: between(20, 110) })),
})

export const tier7: Level[] = [
  {
    id: 'tier7-constraint-down',
    tier: 7,
    title: 'When the constraint breaks',
    principles: [4, 17],
    requires: ['tier3-read'],
    briefing:
      "Back at the robot factory. It runs drum-buffer-rope now: Paint is the constraint, and the rope keeps 8 robots on their way to it, so Paint always has a little work waiting. First, watch a normal day.",
    model: factory(),
    seed: 1,
    goal: {
      kind: 'predict',
      prompt: 'On the next day, Paint breaks down at 2:00 and stays down for 90 minutes. How many robots will the breakdown cost the factory?',
      options: [
        { id: 'none', label: 'None: the other stations catch up afterward' },
        { id: 'some', label: 'About 10: the buffer covers part of it' },
        { id: 'all', label: 'About 20: every minute Paint is down is lost' },
      ],
      answer: 'all',
      compare: { first: 'A normal day', second: 'The breakdown day', change: { stations: { paint: { outages: [{ at: fixed(120), lasts: fixed(90) }] } } } },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'all' },
        title: 'Lost for good',
        body: "The breakdown day shipped {second}, {gap} fewer than the normal day. Paint is the constraint: it has no spare time, so the 90 minutes it spent broken were never made up. Its buffer couldn't help, because Paint itself had stopped, and the stations after it simply waited. An hour lost at the constraint is an hour lost for the whole factory.",
      },
      {
        trigger: { kind: 'predicted', option: 'some' },
        title: "The buffer can't help here",
        body: "The breakdown day shipped {second}, {gap} fewer than the normal day. A buffer protects the constraint from stops upstream, but this time the constraint itself stopped, and the robots waiting in front of Paint just kept waiting. Every one of Paint's 90 minutes was lost for good.",
      },
      {
        trigger: { kind: 'predicted', option: 'none' },
        title: 'Nobody can catch up for Paint',
        body: "The breakdown day shipped {second}, {gap} fewer than the normal day. The other stations have time to spare, but Paint has none, so nobody could make up its 90 lost minutes. An hour lost at the constraint is an hour lost for the whole factory.",
      },
    ],
  },
  {
    id: 'tier7-repair-order',
    tier: 7,
    title: 'One crew, two breakdowns',
    principles: [19, 17],
    requires: ['tier7-constraint-down'],
    briefing:
      "Some mornings a power surge knocks out Mold and Assemble at the same moment. The factory has one repair crew, and a repair takes 30 minutes, so the machine it fixes second stays down for 90. Today the crew always starts with Assemble, the machine nearest its workshop. The factory ships {baseline} on a surge day, and it needs {target}.",
    model: factory({}, surge(90, 30)),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [{ metric: 'shipped', min: 111 }],
      freshDays: 6,
      prompt: 'Which machine should the crew fix first? The surge strikes at a different time each day.',
    },
    levers: [
      {
        id: 'crew',
        kind: 'option',
        label: 'The repair crew fixes first',
        icon: 'wrench',
        options: [
          { id: 'assemble', label: 'Assemble, then Mold', model: surge(90, 30) },
          { id: 'mold', label: 'Mold, then Assemble', model: surge(30, 90) },
          { id: 'split', label: 'Half the crew on each: both back in an hour', model: surge(60, 60) },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { crew: 'mold' } },
        title: 'Fix what starves the constraint',
        body: "Mold feeds Paint; Assemble comes after it. With Mold back in 30 minutes, the robots in Paint's buffer covered the gap and Paint kept going. Assemble stayed down for 90 minutes and robots piled up in front of it, but Assemble has time to spare, so it caught up before the end of the shift: {shipped} shipped. When two things break at once, fix first the one that would starve the constraint.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { crew: 'assemble' } },
        title: 'Paint ran dry',
        body: "Assemble came back quickly, but Mold was down for 90 minutes, far longer than Paint's buffer of 8 robots could last, so Paint sat idle and those minutes were lost for good: {shipped} shipped. Assemble's breakdown would have cost nothing, since it has time to spare after Paint.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { crew: 'split' } },
        title: 'Two slow repairs',
        body: "Splitting the crew kept both machines down for an hour. Assemble's hour cost nothing, but Mold's hour outlasted Paint's buffer, so Paint sat idle: {shipped} shipped. Put the whole crew where the constraint is threatened.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Paint ran dry',
        body: 'The factory shipped {shipped}; it needs {target}. Which breakdown leaves Paint with nothing to work on?',
      },
    ],
  },
  {
    id: 'tier7-late-truck',
    tier: 7,
    title: 'The late truck',
    principles: [36, 17],
    requires: ['tier7-repair-order'],
    briefing:
      "Cut needs a bag of plastic for every robot. A truck brings 30 bags, two hours' worth, at 2:00, 4:00, and 6:00, but this supplier is never on time: each truck is 20 minutes to almost two hours late. The stockroom starts the day with 30 bags, and the factory ships {baseline}; it needs {target}. Every bag on the shelf is money sitting still, so the factory wants to keep as few as it safely can.",
    model: factory({}, { supply: plastic(30) }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'shipped', min: 112 },
        { metric: 'stock', max: 36 },
      ],
      freshDays: 6,
      prompt: 'How much plastic should the stockroom start the day with?',
    },
    levers: [
      {
        id: 'stock',
        kind: 'option',
        label: 'Plastic on hand at the start of the day',
        icon: 'stack',
        options: [
          { id: '30', label: '30 bags: just enough until 2:00', model: { supply: plastic(30) } },
          { id: '40', label: '40 bags: 10 spare', model: { supply: plastic(40) } },
          { id: '60', label: '60 bags: 30 spare', model: { supply: plastic(60) } },
          { id: '80', label: '80 bags: 50 spare', model: { supply: plastic(80) } },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { stock: '60' } },
        title: 'A cushion for the late truck',
        body: "With 30 spare bags, Cut kept going through every late truck, and Paint never ran out of work: {shipped} shipped, with about {stock} bags on the shelf on average. A late delivery stops the line just like a breakdown, so keep enough material to ride out the longest delay you expect, and no more.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { stock: '80' } },
        title: 'Safe, but costly',
        body: '80 bags rode out every late truck, but about {stock} sat on the shelf on average, over the limit of {maxStock}: money sitting still. 30 spare bags would have been enough.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { stock: '30' } },
        title: 'No cushion',
        body: "With just enough plastic until 2:00, every late truck stopped Cut, and once the robots already in Paint's buffer were used up, Paint stopped too: {shipped} shipped.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { stock: '40' } },
        title: 'Not enough cushion',
        body: "10 spare bags ride out a short delay, but not a truck that's more than about an hour late. On those days Paint ran out of work: {shipped} shipped on the day you watched.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Paint ran out of work',
        body: 'The factory shipped {shipped}; it needs {target}. How late can a truck be before Cut runs out of plastic?',
      },
    ],
  },
  {
    id: 'tier7-where-scrap-hurts',
    tier: 7,
    title: 'Where scrap hurts',
    principles: [37],
    requires: ['tier7-late-truck'],
    briefing:
      "Some parts come out bad. On the first day, 1 in 10 of Cut's parts is bad, and Cut spots it right away and throws it out. Watch that day first.",
    model: factory({ cut: { defects: 0.1, inspects: true } }),
    seed: 1,
    goal: {
      kind: 'predict',
      prompt: 'On the second day, 1 in 10 robots goes bad at Assemble instead, and Box finds and throws them out. How many will that day ship?',
      options: [
        { id: 'more', label: 'More than the first day' },
        { id: 'same', label: 'About the same' },
        { id: 'fewer', label: 'About 12 fewer' },
      ],
      answer: 'fewer',
      compare: {
        first: 'Scrap at Cut',
        second: 'Scrap after Paint',
        change: { stations: { cut: { defects: 0, inspects: false }, assemble: { defects: 0.1 }, box: { inspects: true } } },
      },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'fewer' },
        title: 'Scrap after the constraint',
        body: "The second day shipped {second}, {gap} fewer. A bad part at Cut cost only Cut's time and some plastic, and Cut has time to spare: the rope just let in another robot. A robot thrown out at Box had already used Paint's time, and Paint has none to spare, so every one was Paint time lost for good.",
      },
      {
        trigger: { kind: 'predicted', option: 'same' },
        title: 'Same scrap, fewer robots',
        body: "The second day shipped {second}, {gap} fewer. The same share went bad, but when it's found after Paint, Paint has already spent its time on it. Scrap before the constraint costs spare time; scrap after it costs the constraint's time, and the whole factory's output.",
      },
      {
        trigger: { kind: 'predicted', option: 'more' },
        title: 'Fewer, not more',
        body: "The second day shipped {second}, {gap} fewer. Every robot thrown out at Box had already used some of Paint's time, and Paint has none to spare.",
      },
    ],
  },
  {
    id: 'tier7-catch-it-early',
    tier: 7,
    title: 'Catch it before Paint',
    principles: [37],
    requires: ['tier7-where-scrap-hurts'],
    briefing:
      "Mold has a problem: about 1 in 8 of its parts has a hairline crack. Box tests every finished robot and throws out the cracked ones. The factory ships {baseline} a shift, and it needs {target}.",
    model: factory({ mold: { defects: 0.12 }, box: { inspects: true } }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'shipped', min: 113 },
        { metric: 'spend', max: 2000 },
      ],
      freshDays: 6,
      prompt: 'What will you do about the cracks?',
    },
    levers: [
      {
        id: 'check',
        kind: 'option',
        label: 'Cracked parts',
        icon: 'bin',
        options: [
          { id: 'box', label: 'Keep testing at Box' },
          { id: 'mold', label: 'Check each part as it leaves Mold, $1,500', price: 1500, stations: { mold: { inspects: true }, box: { inspects: false } } },
          { id: 'assemble', label: 'Check each robot at Assemble, $1,500', price: 1500, stations: { assemble: { inspects: true }, box: { inspects: false } } },
          { id: 'cooling', label: "Fix Mold's cooling: half the cracks, $8,000", price: 8000, stations: { mold: { defects: 0.06 } } },
          {
            id: 'both',
            label: 'Fix the cooling and check at Mold, $9,500',
            price: 9500,
            stations: { mold: { defects: 0.06, inspects: true }, box: { inspects: false } },
          },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { check: 'mold' } },
        title: 'Catch it before the constraint',
        body: "Checking right after Mold threw out the cracked parts before Paint spent any time on them. Mold and Cut have time to spare, and the rope let in a new robot for every part scrapped, so Paint stayed busy with good robots: {shipped} shipped instead of {baseline}, for $1,500. Scrap after the constraint wastes the constraint's time, so catch defects before it.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { check: 'both' } },
        title: "Caught, but the fix wasn't needed",
        body: "Checking at Mold alone was enough: once cracks are caught before Paint, they cost only Mold's spare time. The cooling fix added $8,000 without adding a robot: {shipped} shipped.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { check: 'assemble' } },
        title: "Too late to save Paint's time",
        body: 'Assemble comes after Paint, so the cracked robots it threw out had already been painted, and that Paint time was wasted: {shipped} shipped. {scrapped} were scrapped.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { check: 'cooling' } },
        title: 'Half the cracks, still after Paint',
        body: "The cooling fix halved the cracks, but the ones left still went through Paint before Box found them: {shipped} shipped, for $8,000. Where you catch a defect matters as much as how many there are.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { check: 'box' } },
        title: 'Painting robots to throw away',
        body: "Every cracked robot Box threw out had already used Paint's time: {scrapped} of them today, and {shipped} shipped.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Still wasting Paint time',
        body: "The factory shipped {shipped}; it needs {target}. Where do the cracked parts use up Paint's time?",
      },
    ],
  },
]
