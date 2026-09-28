import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel, Station } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })
const repeat = (product: string, count: number) => Array<string>(count).fill(product)

const models = [
  { id: 'classic', name: 'Classic robot' },
  { id: 'deluxe', name: 'Deluxe robot' },
]

// The robot factory from Tier 7, running drum-buffer-rope with the rope tied to Paint.
const factory = (changes: Record<string, Partial<Station>>, extra: Partial<FactoryModel>): FactoryModel => ({
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

// Today's 40 Deluxe robots, in three orders: at the end of the day, at the start, or 3 in every 8.
const deluxeLast = [...repeat('classic', 80), ...repeat('deluxe', 40), ...repeat('classic', 60)]
const deluxeFirst = [...repeat('deluxe', 40), ...repeat('classic', 160)]
const deluxeSpread = ['classic', 'deluxe', 'classic', 'classic', 'deluxe', 'classic', 'classic', 'deluxe']

// On the hot-list day, the sales office flips which color is hot every half hour.
const hotList = Array.from({ length: 15 }, (_, k) => ({ at: 30 * (k + 1), order: [k % 2 === 0 ? 'blue' : 'orange'] }))

export const tier8: Level[] = [
  {
    id: 'tier8-mix-shifts',
    tier: 8,
    title: 'The mix shifts',
    principles: [38],
    requires: ['tier3-read'],
    briefing:
      'The robot factory makes a second model now, the Deluxe robot. It has more parts to fit, so it takes Assemble about 6 minutes instead of 2.6; every other step takes the same time for both. The day starts with Classic robots, and at 2:00 a big order for Deluxe robots starts. Watch the shift.',
    model: factory({ assemble: { times: { deluxe: about(6) } } }, { products: models, mix: ['classic'], mixChanges: [{ at: 120, mix: ['deluxe'] }] }),
    seed: 1,
    goal: {
      kind: 'identifyBottleneck',
      answer: 'assemble',
      prompt: 'Which station holds the factory back now?',
      watchMinutes: 300,
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'answered', correct: true },
        title: 'The constraint moved',
        body: "Until 2:00, Paint set the pace. Deluxe robots take Assemble more than twice as long, so once they started, Assemble fell behind: {waiting:assemble} are waiting for it now, while Paint keeps up. A change in the product mix can move the constraint. The station that was fine at the start of the day can be the one holding everyone back later.",
      },
      {
        trigger: { kind: 'answered', correct: false, station: 'paint' },
        title: 'That was the constraint earlier',
        body: 'Before 2:00, work waited for Paint. Look again now: {waiting:paint} waiting for Paint, and {waiting:assemble} for Assemble. Deluxe robots take Assemble more than twice as long, so the constraint moved when the orders changed.',
      },
      {
        trigger: { kind: 'answered', correct: false },
        title: 'Not quite',
        body: "Look for the station with the biggest pile in front of it since the Deluxe orders started, and for the stations whose lights keep going gray.",
      },
    ],
  },
  {
    id: 'tier8-new-rope',
    tier: 8,
    title: 'A new mix, a new rope',
    principles: [38, 18],
    requires: ['tier8-mix-shifts'],
    briefing:
      "From today, every other order is a Deluxe robot, which takes Assemble about 6 minutes. The rope is still tied to Paint, 8 robots long, the way it has been for months. The factory ships {baseline} a shift, but an order now takes about {leadBefore} minutes from release to shipping.",
    model: factory({ assemble: { times: { deluxe: about(6) } } }, { products: models, mix: ['classic', 'deluxe'] }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'leadTime', max: 45 },
        { metric: 'shipped', min: 104 },
      ],
      freshDays: 6,
      prompt: 'Where should the rope be tied now?',
    },
    levers: [{ id: 'rope', kind: 'ropeTo', label: 'Tie the rope to', stations: ['cut', 'paint', 'assemble'], length: 8 }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { rope: 'assemble' } },
        title: 'Tie the rope to the new constraint',
        body: "With every other robot a Deluxe, Assemble needs about 4.3 minutes a robot on average and Paint only 4, so Assemble is the constraint now. Tied to Paint, the rope let work in faster than Assemble could finish it, and the pile in front of Assemble grew all day. Tied to Assemble, work goes in only as fast as Assemble finishes it: about {lead} minutes from release to shipping instead of {leadBefore}, and {shipped} shipped. When the mix moves the constraint, the rope has to move with it.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { rope: 'paint' } },
        title: "Tied to last month's constraint",
        body: 'Paint keeps up easily now, so the rope tied to it let in work faster than Assemble could finish it: {waiting:assemble} robots were waiting at Assemble at the end of the shift, and each order took about {lead} minutes.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { rope: 'cut' } },
        title: 'A flood',
        body: 'Tied to Cut, the first station, the rope let in work as fast as Cut could take it, so orders piled up in front of the slowest step: about {lead} minutes from release to shipping.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Orders are waiting too long',
        body: 'Each order took about {lead} minutes from release to shipping; the goal is {maxLead}. Where is the constraint now?',
      },
    ],
  },
  {
    id: 'tier8-spread-deluxe',
    tier: 8,
    title: 'Spread out the Deluxe orders',
    principles: [38],
    requires: ['tier8-new-rope'],
    briefing:
      "A big customer changed today's order: 40 of the robots must be Deluxe, and each takes Assemble about 6 minutes instead of 2.6. The planner put all 40 at the end of the day, after the Classic robots. The factory ships {baseline}, but only {shippedOfBefore} of them are Deluxe.",
    model: factory({ assemble: { times: { deluxe: about(6) } } }, { products: models, mix: deluxeLast }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'shippedOf', product: 'deluxe', min: 40 },
        { metric: 'shipped', min: 112 },
        { metric: 'leadTime', max: 50 },
      ],
      freshDays: 6,
      prompt: 'When should the 40 Deluxe robots be made?',
    },
    levers: [
      {
        id: 'order',
        kind: 'option',
        label: 'Make the Deluxe robots',
        icon: 'sort',
        options: [
          { id: 'last', label: 'Last, after the Classic robots', model: { mix: deluxeLast } },
          { id: 'first', label: 'First thing in the morning', model: { mix: deluxeFirst } },
          { id: 'spread', label: 'Spread through the day: 3 in every 8', model: { mix: deluxeSpread } },
          { id: 'alternate', label: 'Every other robot', model: { mix: ['classic', 'deluxe'] } },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { order: 'spread' } },
        title: 'Share the load',
        body: "Spread through the day, the Deluxe robots never piled up at Assemble: each one cleared before the next arrived, and Paint stayed the constraint. {shippedOf} Deluxe robots and {shipped} in all, each out in about {lead} minutes. A change in the mix can move the constraint; spreading the new work out keeps the constraint where your plan expects it.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { order: 'first' } },
        title: 'All 40, but slowly',
        body: 'All 40 Deluxe robots shipped, but while they were being made, Assemble was the constraint and orders piled up in front of it: about {lead} minutes from release to shipping, over the goal of {maxLead}.',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { order: 'alternate' } },
        title: 'More Deluxe than anyone ordered',
        body: 'Every other robot Deluxe made Assemble the constraint all day: {shippedOf} Deluxe robots, more than the customer needs, but only {shipped} robots in all.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { order: 'last' } },
        title: 'Out of time',
        body: "Saved for last, the Deluxe robots all reached Assemble at once, and it couldn't finish them before the shift ended: only {shippedOf} Deluxe robots shipped.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not all 40',
        body: '{shippedOf} Deluxe robots shipped; the customer needs {minOf}. When do they reach Assemble?',
      },
    ],
  },
  {
    id: 'tier8-hot-list',
    tier: 8,
    title: 'The hot list',
    principles: [39],
    requires: ['tier8-spread-deluxe'],
    briefing:
      "The factory makes orange robots and blue robots. Switching colors means cleaning Paint's spray gun, about 8 minutes, so Paint keeps painting one color while any robots of that color are waiting, and only then switches. The rope is 12 robots long. Watch a normal day.",
    model: factory(
      { paint: { changeover: about(8), keepProduct: true } },
      {
        products: [
          { id: 'orange', name: 'Orange robot' },
          { id: 'blue', name: 'Blue robot' },
        ],
        mix: ['orange', 'blue'],
        release: { kind: 'rope', constraint: 'paint', buffer: 12 },
      },
    ),
    seed: 1,
    goal: {
      kind: 'predict',
      prompt:
        'On the next day, the sales office calls Paint every half hour: "Blue is hot!", then "Orange is hot!", and Paint switches colors at every call. How many robots will that day ship?',
      options: [
        { id: 'more', label: 'More: the hot robots go out faster' },
        { id: 'same', label: 'About the same' },
        { id: 'fewer', label: 'About 20 fewer' },
      ],
      answer: 'fewer',
      compare: { first: 'A normal day', second: 'The hot-list day', change: { stations: { paint: { priorityChanges: hotList } } } },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'fewer' },
        title: 'Every call cost a cleaning',
        body: "The hot-list day shipped {second}, {gap} fewer. Every call made Paint switch colors, and every switch meant 8 minutes cleaning the gun instead of painting. Paint is the constraint, so those minutes were lost for the whole factory. Constant priority changes at the constraint cost output: set the order once, in the plan and the rope, and let Paint keep painting.",
      },
      {
        trigger: { kind: 'predicted', option: 'same' },
        title: 'Fewer, not the same',
        body: "The hot-list day shipped {second}, {gap} fewer. Each call looked harmless, but each one made Paint clean its gun, 8 minutes the constraint wasn't painting, over and over all day.",
      },
      {
        trigger: { kind: 'predicted', option: 'more' },
        title: 'Faster for a few, slower for all',
        body: 'The hot-list day shipped {second}, {gap} fewer. A hot robot did jump ahead, but every jump cost Paint a color change, and the constraint has no time to spare.',
      },
    ],
  },
  {
    id: 'tier8-rush-order',
    tier: 8,
    title: 'The rush order',
    principles: [16],
    requires: ['tier8-hot-list'],
    briefing: 'Back to one kind of robot, with the rope tied to Paint, 8 robots long. Watch a normal day.',
    model: factory({}, {}),
    seed: 1,
    goal: {
      kind: 'predict',
      prompt:
        'On the next day, a customer calls at 2:00 with a rush order: 12 more robots, needed by 5:00. They start at once, on top of the rope, and jump the queue at every station. How many robots will that day ship in all?',
      options: [
        { id: 'more', label: 'About 12 more' },
        { id: 'same', label: 'About the same' },
        { id: 'fewer', label: 'Fewer: the rush throws the factory off' },
      ],
      answer: 'same',
      compare: {
        first: 'A normal day',
        second: 'The rush-order day',
        change: {
          stations: Object.fromEntries(['cut', 'mold', 'paint', 'assemble', 'box'].map((id) => [id, { expedite: true }])),
          model: { rush: [{ at: 120, count: 12 }] },
        },
      },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'same' },
        title: 'Rushed, not extra',
        body: "The rush-order day shipped {second}, exactly as many as the normal day. The 12 rush robots jumped the queue and were all out by about 3:00, but Paint was already busy every minute, so they took the places of 12 robots that would have shipped today and will ship tomorrow instead. Rushing changes the order work goes out in, not how much goes out: only more time at the constraint does that.",
      },
      {
        trigger: { kind: 'predicted', option: 'more' },
        title: 'Not 12 more',
        body: 'The rush-order day shipped {second}, exactly as many as the normal day. The rush robots went first, but Paint could only paint as fast as it always does, so 12 other robots will ship tomorrow instead.',
      },
      {
        trigger: { kind: 'predicted', option: 'fewer' },
        title: 'Not fewer either',
        body: "The rush-order day shipped {second}, exactly as many as the normal day. Jumping the queue cost nothing here, because no station had to switch anything to let the rush robots through; it only changed which robots went first.",
      },
    ],
  },
]
