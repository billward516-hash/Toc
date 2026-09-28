import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel, Jams, Machine } from '../engine/model.ts'
import type { Lever, Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })

const smallPress = (name: string): Machine => ({ name, products: ['flyer'], times: { flyer: about(6) } })

// The print shop in levels 2 and 3: one machine at every station, minutes per order at each, and
// room to buy a second of any of them.
type Paces = Record<'design' | 'print' | 'trim' | 'pack', number>
const shop = (pace: Paces, every: number, jams?: Jams): FactoryModel => ({
  stations: [
    { id: 'design', name: 'Design', cycleTime: about(pace.design), machines: [{ name: 'Computer' }], jams },
    { id: 'print', name: 'Print', cycleTime: about(pace.print), machines: [{ name: 'Press' }] },
    { id: 'trim', name: 'Trim', cycleTime: about(pace.trim), machines: [{ name: 'Trimmer' }], jams },
    { id: 'pack', name: 'Pack', cycleTime: about(pace.pack), machines: [{ name: 'Packing table' }], jams },
  ],
  release: { kind: 'interval', every: { kind: 'fixed', value: every } },
  horizon: SHIFT,
})

const buy = (id: string, label: string, station: string, machine: string, price: number): Lever => ({
  id,
  kind: 'buy',
  label,
  options: [{ id, label: `A second ${machine.toLowerCase()}, $${price.toLocaleString('en-US')}`, station, machine: { name: `New ${machine.toLowerCase()}` }, price }],
})
const purchases: Lever[] = [
  buy('computer', 'Design', 'design', 'Computer', 6000),
  buy('press', 'Print', 'print', 'Press', 20000),
  buy('trimmer', 'Trim', 'trim', 'Trimmer', 8000),
  buy('table', 'Pack', 'pack', 'Packing table', 4000),
]

export const tier5: Level[] = [
  {
    id: 'tier5-house-rules',
    tier: 5,
    title: 'House rules',
    principles: [27, 26],
    requires: ['tier3-read'],
    briefing:
      "Welcome to the print shop. An order comes in every 3 minutes: a poster, then two flyers, and again. Posters only fit on the big press, and the small press prints flyers slowly. A house rule older than anyone remembers says the big press prints posters only. The shop prints {baseline} orders a shift; it needs {target}. Watch where the orders pile up.",
    model: {
      products: [
        { id: 'poster', name: 'Poster' },
        { id: 'flyer', name: 'Flyer' },
      ],
      mix: ['poster', 'flyer', 'flyer'],
      stations: [
        { id: 'design', name: 'Design', cycleTime: about(2) },
        {
          id: 'print',
          name: 'Print',
          cycleTime: about(5),
          // The small press comes first, so it gets the flyers when both presses are free.
          machines: [smallPress('Small press'), { name: 'Big press', products: ['poster'], times: { poster: about(5), flyer: about(3) } }],
        },
        { id: 'trim', name: 'Trim', cycleTime: about(2) },
        { id: 'pack', name: 'Pack', cycleTime: about(1.8) },
      ],
      release: { kind: 'interval', every: { kind: 'fixed', value: 3 } },
      horizon: SHIFT,
    },
    seed: 1,
    goal: {
      kind: 'elevate',
      target: 150,
      pileLimit: 5,
      minSteady: 0.9,
      minGainPer1000: 2,
      freshDays: 6,
      prompt: 'The shop needs {target} orders a shift. What will you change?',
    },
    levers: [
      {
        id: 'rule',
        kind: 'machineRule',
        label: 'The big press may print',
        station: 'print',
        machine: 'Big press',
        options: [
          { id: 'posters', label: 'Posters only (house rule)', products: ['poster'] },
          { id: 'both', label: 'Posters and flyers' },
        ],
      },
      {
        id: 'press',
        kind: 'buy',
        label: 'Buy a press',
        options: [{ id: 'small', label: 'Another small press, $20,000', station: 'print', machine: smallPress('New press'), price: 20000 }],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { rule: 'both', press: 'none' } },
        title: 'The rule was the constraint',
        body: "The big press had time to spare: it sat idle between posters while flyers piled up. Letting it print flyers cost nothing, and the shop printed {shipped} instead of {baseline}, keeping up with every order. Some constraints aren't machines at all; they're rules. And now that the shop keeps up, the constraint has moved outside it: to how many orders come in.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { rule: 'posters', press: 'small' } },
        title: 'It worked, for $20,000',
        body: "A second small press kept up with the flyers: {shipped} printed instead of {baseline}. But the big press still sits idle between posters, and lifting the house rule would have done the same for free. Before buying capacity, make sure the capacity you already have isn't held back by a rule: exploit before you elevate.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { rule: 'both', press: 'small' } },
        title: 'Right idea, extra cost',
        body: 'Lifting the house rule was enough on its own. The new press added $20,000 of capacity the shop doesn\'t need yet: it printed {shipped}, no more than the rule change alone would. Spend money only on a constraint you still have.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { rule: 'posters', press: 'none' } },
        title: 'Same rule, same pile',
        body: 'Nothing changed, so flyers kept piling up in front of the small press ({waiting:print} waiting at the end of the shift) while the big press sat idle between posters. The shop printed {shipped}; it needs {target}.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not there yet',
        body: 'The shop printed {shipped}; it needs {target}. Look at the print station: which press is busy all day, and which one isn\'t?',
      },
    ],
  },
  {
    id: 'tier5-next-constraint',
    tier: 5,
    title: 'The next constraint',
    principles: [31, 3],
    requires: ['tier5-house-rules'],
    briefing:
      'Business is booming: an order now comes in every 2.4 minutes, 200 a shift. With one machine at every station, the shop prints {baseline}, and it needs {target}. You have $30,000 to buy a second machine for any station, or two. Watch where the orders pile up.',
    model: shop({ design: 1.6, print: 3, trim: 2.6, pack: 2 }, 2.4),
    seed: 1,
    goal: {
      kind: 'elevate',
      target: 190,
      pileLimit: 5,
      minSteady: 0.9,
      minGainPer1000: 1,
      freshDays: 6,
      budget: 30000,
      prompt: 'The shop needs {target} orders a shift. What will you buy?',
    },
    levers: purchases,
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { press: 'press', trimmer: 'trimmer' } },
        title: 'There is always a next constraint',
        body: 'A second press cleared the pile at Print, but Trim was nearly as slow, so on its own the press would only have moved the pile to Trim. With a second trimmer too, the shop printed {shipped} instead of {baseline}: every order that came in. Now the constraint is outside the shop again, in how many orders come in. Each time you break a constraint, go back to step 1 and find the next one.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { press: 'press', trimmer: 'none' } },
        title: 'The pile moved',
        body: 'The new press did its job: Print keeps up now. But the pile moved to Trim, with {waiting:trim} orders waiting there at the end of the shift, so the shop printed only {shipped}. Breaking one constraint revealed the next. Back to step 1: where does the work pile up now?',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { press: 'none' } },
        title: 'Print is still the constraint',
        body: 'Every order goes through Print, and it still has one press: {waiting:print} orders were waiting there at the end of the shift. More machines anywhere else can\'t help until Print keeps up. The shop printed {shipped}; it needs {target}.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not there yet',
        body: 'The shop printed {shipped}; it needs {target}. Watch where the orders pile up.',
      },
    ],
  },
  {
    id: 'tier5-balance-flow',
    tier: 5,
    title: 'Balance flow, not capacity',
    principles: [33, 15],
    requires: ['tier5-next-constraint'],
    briefing:
      "A consultant visited last month. Design, Trim, and Pack each had a second machine that sat idle half the day, so the consultant sold them. Now every station works at the press's pace, about 20 orders an hour, and every machine is busy all day. Orders still come in every 3.1 minutes, about 155 a shift, but the shop prints only {baseline}, and it needs {target}. You have $20,000.",
    // Design, Trim, and Pack jam about every 50 minutes, for about 10.
    model: shop({ design: 3, print: 3, trim: 3, pack: 3 }, 3.1, {
      every: { kind: 'uniform', min: 35, max: 65 },
      lasts: { kind: 'uniform', min: 7, max: 13 },
    }),
    seed: 1,
    goal: {
      kind: 'elevate',
      target: 140,
      pileLimit: 5,
      minSteady: 0.9,
      minGainPer1000: 1,
      freshDays: 6,
      budget: 20000,
      prompt: 'The shop needs {target} orders a shift. What will you buy?',
    },
    levers: purchases,
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { computer: 'computer', trimmer: 'trimmer', table: 'table' } },
        title: 'Time to spare is not waste',
        body: "The consultant counted idle time as waste. But Design, Trim, and Pack jam now and then, and at exactly the press's pace they could never catch up afterward, so every jam cost orders for good. With their second machines back, they catch up after every jam and only the press sets the pace: {shipped} printed instead of {baseline}. Don't balance capacity. Balance the flow with what customers order, and keep time to spare everywhere but the constraint.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { press: 'press' } },
        title: 'The press was keeping up',
        body: "A second press can't print orders that haven't reached it. Design, Trim, and Pack still have one machine each, working at exactly the pace of the orders, so every jam there still cost orders for good: {shipped} printed, {baseline} before. The most expensive machine isn't always the one holding the shop back.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { computer: 'none', press: 'none', trimmer: 'none', table: 'none' } },
        title: 'Busy, but behind',
        body: 'Nothing changed, so every station was still busy all day, and still behind: each jam at Design, Trim, or Pack cost orders the shop never made up. It printed {shipped}; it needs {target}.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'One station still has no time to spare',
        body: 'The shop printed {shipped}; it needs {target}. A station that jams needs time to spare to catch up afterward. Which stations still work at exactly the press\'s pace?',
      },
    ],
  },
]
