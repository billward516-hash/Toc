import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel, Market, Release } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })
const between = (min: number, max: number): Dist => ({ kind: 'uniform', min, max })

// The shop opens at 2:00 and closes at the end of the shift; cupcakes left at closing are thrown out.
const hours = { opens: 120, closes: SHIFT }

// The bakery's cupcake line, with its shop counter at the end. The oven bakes about one a minute,
// faster than customers ever come in except in a rush.
const cupcakes = (release: Release, market: Partial<Market> = {}, extra: Partial<FactoryModel> = {}): FactoryModel => ({
  stations: [
    { id: 'mix', name: 'Mix', cycleTime: about(0.9) },
    { id: 'bake', name: 'Bake', cycleTime: about(1) },
    { id: 'frost', name: 'Frost', cycleTime: about(0.7) },
  ],
  release,
  horizon: SHIFT,
  // Last month, 120 customers came in on an average day, but anywhere from 70 to 170.
  market: { customers: between(70, 170), ...hours, ...market },
  ...extra,
})
const bake = (quantity: number): Release => ({ kind: 'plan', quantity })
const replace = (target: number): Release => ({ kind: 'replenish', target })

// On the frosting day, the number of customers hardly changes, but each flavor's share swings from
// day to day.
const flavors = [
  { id: 'vanilla', name: 'Vanilla' },
  { id: 'chocolate', name: 'Chocolate' },
  { id: 'strawberry', name: 'Strawberry' },
]
const steadyCrowd = between(110, 130)
const wants = { vanilla: between(1, 3), chocolate: between(1, 3), strawberry: between(1, 3) }
const frosted = (release: Release, mix: string[]) => cupcakes(release, { customers: steadyCrowd, wants }, { products: flavors, mix })
const eachFlavor = ['vanilla', 'chocolate', 'strawberry']
// Last week's sales: 3 vanilla, 2 chocolate, and 1 strawberry in every 6.
const lastWeek = ['vanilla', 'chocolate', 'vanilla', 'strawberry', 'vanilla', 'chocolate']

export const tier9: Level[] = [
  {
    id: 'tier9-forecast',
    tier: 9,
    title: 'The forecast',
    principles: [40],
    requires: ['tier3-read'],
    unit: 'cupcakes',
    briefing:
      'The bakery has opened a shop. It opens at 2:00, and customers come in until the end of the shift at 8:00, each wanting one cupcake. Cupcakes are only fresh for a day, so whatever is left at closing is thrown out. Last month, 120 customers came in on an average day, so every morning the bakery bakes 120: the forecast. Watch today.',
    model: cupcakes(bake(120)),
    seed: 73,
    goal: {
      kind: 'predict',
      prompt:
        'Today the forecast was spot on. Over the next 10 days, the bakery bakes 120 every day, and about 1,200 customers come in, just as the forecast says. What will happen?',
      options: [
        { id: 'fine', label: 'It sells about 1,200 and throws out hardly any' },
        { id: 'waste', label: 'It throws some out on slow days, but never runs out' },
        { id: 'both', label: 'It throws some out on slow days, and turns customers away on busy days' },
      ],
      answer: 'both',
      compare: { first: 'Today', second: 'The next 10 days', change: {}, days: 10 },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'both' },
        title: 'Right on average, wrong every day',
        body: "Over the 10 days, {customers} customers came in, about what the forecast said. But the shop sold only {sold} cupcakes: on {slowDays} slow days it threw out {thrownOut} in all, and on {busyDays} busy days it turned {turnedAway} customers away. A cupcake left over on a slow day can't be sold on a busy one. A forecast is always wrong about any one day, so a plan that just follows it loses both ways.",
      },
      {
        trigger: { kind: 'predicted', option: 'fine' },
        title: "It didn't even out",
        body: "{customers} customers came in over the 10 days, about what the forecast said, but the shop sold only {sold}. It threw out {thrownOut} cupcakes on slow days and turned {turnedAway} customers away on busy ones. A cupcake left over on a slow day can't be sold on a busy one, so the misses never cancel out.",
      },
      {
        trigger: { kind: 'predicted', option: 'waste' },
        title: 'It ran out too',
        body: 'On {busyDays} of the 10 days, more than 120 customers came in, and once the 120 cupcakes were gone, the rest left with nothing: {turnedAway} customers in all. It threw out {thrownOut} on the slow days as well. The forecast was right on average and wrong every single day.',
      },
    ],
  },
  {
    id: 'tier9-bake-what-sells',
    tier: 9,
    title: 'Bake what sells',
    principles: [41, 40],
    requires: ['tier9-forecast'],
    unit: 'cupcakes',
    briefing:
      "Anywhere from 70 to 170 customers come into the shop each day, and nobody knows how many until the day is over. The bakery bakes 120 every morning, the forecast. Today {customers} customers came in: the shop sold out and turned {turnedAway} of them away. The oven bakes about a cupcake a minute, and customers come in more slowly than that, even on the busiest day.",
    model: cupcakes(bake(120)),
    seed: 2,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'lost', max: 0 },
        { metric: 'waste', max: 15 },
      ],
      freshDays: 9,
      prompt: 'How should the bakery decide how many cupcakes to bake?',
    },
    levers: [
      {
        id: 'plan',
        kind: 'option',
        label: 'Each day, the bakery will',
        icon: 'tag',
        options: [
          { id: 'forecast', label: 'Bake 120, the forecast', model: { release: bake(120) } },
          { id: 'busiest', label: 'Bake 170, enough for the busiest day', model: { release: bake(170) } },
          { id: 'fewer', label: 'Bake 80, so hardly any are thrown out', model: { release: bake(80) } },
          { id: 'replace', label: 'Keep 10 on the shelf, and bake one more for each one sold', model: { release: replace(10) } },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { plan: 'replace' } },
        title: 'Bake what sells',
        body: "Baking one cupcake for each one sold kept 10 on the shelf all day. Every customer got a cupcake, {sold} today, and only the {thrownOut} left at closing were thrown out. The oven bakes faster than customers come in, so the bakery didn't need to guess how busy the day would be: it followed what customers actually bought. Make what customers take, not what the forecast says.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { plan: 'busiest' } },
        title: 'Enough for everyone, and far too many',
        body: "Baking 170 served every customer, but today it threw out {thrownOut}. Enough for the busiest day is too many for every other day. Is there a way to serve every customer without guessing?",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { plan: 'forecast' } },
        title: 'Wrong every day',
        body: 'The forecast of 120 ran out today and turned {turnedAway} customers away. On busy days it runs out, and on slow days it throws cupcakes out: whatever the day brings, a fixed number is wrong one way or the other.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { plan: 'fewer' } },
        title: 'Out of cupcakes',
        body: 'Baking 80 kept the waste down, but {turnedAway} customers left without a cupcake today.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Customers turned away',
        body: '{turnedAway} customers left without a cupcake today. How could the bakery follow what customers actually buy?',
      },
    ],
  },
  {
    id: 'tier9-lunch-rush',
    tier: 9,
    title: 'The lunch rush',
    principles: [41, 17],
    requires: ['tier9-bake-what-sells'],
    unit: 'cupcakes',
    briefing:
      "The shop keeps 10 cupcakes on the shelf and bakes one more for each one sold. Now a lunch crowd has found it: between 5:00 and 6:00, 4 of every 10 of the day's customers come in, faster than the oven's cupcake a minute on a busy day. Today {customers} customers came in: the shop sold {sold}, turned {turnedAway} away, and threw out {thrownOut}.",
    model: cupcakes(replace(10), { rush: { from: 300, to: 360, share: 0.4 } }),
    seed: 5,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'lost', max: 0 },
        { metric: 'waste', max: 45 },
      ],
      freshDays: 9,
      prompt: 'How many cupcakes should the shop keep on the shelf?',
    },
    levers: [
      {
        id: 'shelf',
        kind: 'option',
        label: 'Keep on the shelf',
        icon: 'stack',
        options: [
          { id: 'ten', label: '10 cupcakes', model: { release: replace(10) } },
          { id: 'forty', label: '40 cupcakes', model: { release: replace(40) } },
          { id: 'hundred', label: '100 cupcakes', model: { release: replace(100) } },
          { id: 'morning', label: 'No shelf: bake 170 in the morning', model: { release: bake(170) } },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { shelf: 'forty' } },
        title: 'A shelf for the rush',
        body: 'At lunch, customers come in faster than the oven can bake. The 40 on the shelf carried the shop through the rush while the oven caught up, so nobody was turned away, and {thrownOut} were left at closing. Size the shelf for the busiest stretch of the day, and no bigger: it protects the sales the way a buffer protects the constraint.',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { shelf: 'hundred' } },
        title: 'Safe, but wasteful',
        body: '100 on the shelf never ran out, but all {thrownOut} left at closing were thrown out. How much does the rush really need?',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { shelf: 'morning' } },
        title: 'Back to guessing',
        body: 'Baking 170 in the morning covered the rush, and on a day as busy as today it threw out only {thrownOut}. On a slow day it throws out far more: 170 is still a guess.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { shelf: 'ten' } },
        title: 'Out at lunch',
        body: 'The 10 on the shelf were plenty until the lunch rush. Then customers came in faster than the oven could bake, the shelf ran dry, and {turnedAway} customers left without a cupcake.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Customers turned away',
        body: '{turnedAway} customers left without a cupcake. When does the shelf run out?',
      },
    ],
  },
  {
    id: 'tier9-frost-to-order',
    tier: 9,
    title: 'Frost to order',
    principles: [42],
    requires: ['tier9-lunch-rush'],
    unit: 'cupcakes',
    briefing:
      'The shop sells three flavors now: vanilla, chocolate, and strawberry. The number of customers hardly changes, 110 to 130 a day, but what they want swings: some days nearly everyone wants chocolate, other days strawberry. Each morning the bakery bakes 120 and frosts 40 of each flavor. Today {customers} customers came in: the shop threw out {thrownOut} and turned {turnedAway} away.',
    model: frosted(bake(120), eachFlavor),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'waste', max: 10 },
        { metric: 'lost', max: 10 },
      ],
      freshDays: 9,
      prompt: 'How should the bakery frost its cupcakes?',
    },
    levers: [
      {
        id: 'frosting',
        kind: 'option',
        label: 'Frost the cupcakes',
        icon: 'tag',
        options: [
          { id: 'forecast', label: '40 of each flavor in the morning', model: { release: bake(120), mix: eachFlavor } },
          { id: 'extra', label: '50 of each flavor, just in case', model: { release: bake(150), mix: eachFlavor } },
          { id: 'favorites', label: "By last week's sales: 60 vanilla, 40 chocolate, 20 strawberry", model: { release: bake(120), mix: lastWeek } },
          { id: 'replace', label: 'Keep 10 of each on the shelf, and replace each one sold', model: { release: replace(10), mix: eachFlavor } },
          {
            id: 'counter',
            label: 'At the counter: bake 120 plain, and frost each one the way its customer asks',
            stations: { frost: { name: 'Cool' } },
            model: { release: bake(120), products: undefined, mix: undefined, market: { customers: steadyCrowd, ...hours } },
          },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { frosting: 'counter' } },
        title: 'Forecast the total, frost to order',
        body: 'The number of customers hardly changes from day to day, but which flavor they want swings a lot. Baked plain, every cupcake could become whatever flavor its customer asked for, so the bakery only had to forecast the total: {thrownOut} thrown out and {turnedAway} turned away today. Forecast the total, and decide the details as late as you can.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { frosting: 'forecast' } },
        title: 'The right number, the wrong flavors',
        body: 'The bakery baked about as many as customers wanted, but not in the flavors they wanted: it threw out {thrownOut} and turned {turnedAway} customers away today. Each flavor swings far more than the total does.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { frosting: 'extra' } },
        title: 'More of every flavor',
        body: '50 of each flavor threw out {thrownOut} today. More of every flavor means more left over, and on a day when nearly everyone wants the same flavor, it still runs out.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { frosting: 'favorites' } },
        title: "Last week isn't this week",
        body: "Last week's favorites weren't today's: {thrownOut} thrown out and {turnedAway} customers turned away.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { frosting: 'replace' } },
        title: 'Three shelves to keep full',
        body: 'Replacing what sold kept every flavor in stock, but 10 of each flavor on the shelf left {thrownOut} at closing to throw out. Could the bakery keep one shelf instead of three?',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Too many thrown out',
        body: '{thrownOut} thrown out and {turnedAway} customers turned away today. How could the bakery stop guessing flavors?',
      },
    ],
  },
]
