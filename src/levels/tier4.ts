import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })

// The candle workshop. Orders come in lots of one scent, about one candle every 4 minutes. Melt is the
// constraint, and switching scents costs it about 8 minutes to clean the pot; Pour and Label switch faster.
const workshop = (lot: number, transfer?: number): FactoryModel => ({
  products: [
    { id: 'orange', name: 'Orange blossom' },
    { id: 'ocean', name: 'Ocean breeze' },
  ],
  mix: ['orange', 'ocean'].flatMap((scent) => Array<string>(lot).fill(scent)),
  stations: [
    { id: 'melt', name: 'Melt', cycleTime: about(3), changeover: about(8), transfer },
    { id: 'pour', name: 'Pour', cycleTime: about(2), changeover: about(3), transfer },
    { id: 'label', name: 'Label', cycleTime: about(1.8), changeover: about(2), transfer },
    { id: 'pack', name: 'Pack', cycleTime: about(1.6) },
  ],
  release: { kind: 'interval', every: { kind: 'fixed', value: 4 * lot }, lot },
  horizon: SHIFT,
})

// Every Tier 4 level asks for the same thing: enough candles, shipped quickly, on 5 more days too.
const goal = (prompt: string) => ({ kind: 'flow' as const, target: 112, maxLeadTime: 36, freshDays: 5, prompt })

export const tier4: Level[] = [
  {
    id: 'tier4-lots',
    tier: 4,
    title: 'Fewer changeovers',
    principles: [22, 23],
    requires: ['tier3-read'],
    briefing:
      "Welcome to the candle workshop. Orders come in one candle at a time, switching scents every time: an Orange blossom, then an Ocean breeze, about every 4 minutes. Melt is the slowest step, and every time it switches scents it spends about 8 minutes cleaning the pot. Today the workshop ships {baseline} candles a shift: its throughput, as TOC calls what a business ships and sells. Watch Melt.",
    model: workshop(1),
    seed: 1,
    goal: goal('How many candles of one scent should come in together?'),
    levers: [{ id: 'lot', kind: 'lotSize', label: 'Candles per order', sizes: [1, 2, 5, 10, 20] }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { lot: '10' } },
        title: 'Big enough, small enough',
        body: 'With lots of 10, Melt cleaned its pot once every 10 candles instead of before almost every one, so it kept up: {shipped} shipped instead of {baseline}, each about {lead} minutes from order to shipping. At the constraint, every changeover is time the whole workshop loses, so bigger lots there pay off, up to a point.',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { lot: '20' } },
        title: 'Enough candles, too much waiting',
        body: 'Lots of 20 cut changeovers even further, and the workshop shipped {shipped}. But every candle waited for the 19 others in its lot: about {lead} minutes from order to shipping, over the {maxLead}-minute goal. A bigger lot than the constraint needs only adds waiting and inventory.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { lot: '1' } },
        title: 'Cleaning, not melting',
        body: "Switching scents after every candle meant Melt cleaned its pot before almost every one: {changeover} minutes of changeovers across the line, and only {shipped} shipped. The constraint's time went to cleaning instead of candles.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Still too many changeovers',
        body: 'Melt still spent too much of the shift cleaning its pot ({changeover} minutes of changeovers across the line), so it fell behind: {shipped} shipped, and the goal is {target}. Try bigger lots.',
      },
    ],
  },
  {
    id: 'tier4-quick-change',
    tier: 4,
    title: 'Quick changeovers',
    principles: [22, 5],
    requires: ['tier4-lots'],
    briefing:
      "Orders now come in lots of 5 candles of one scent. That's still more changeovers than Melt can afford: the workshop ships {baseline} a shift. A quick-change crew can cut one station's changeovers to a quarter of the time by heating the next pot early and laying out the tools. Where should they work?",
    model: workshop(5),
    seed: 1,
    goal: goal('Where should the quick-change crew work?'),
    levers: [{ id: 'crew', kind: 'quickChange', label: 'Quick-change crew', stations: ['melt', 'pour', 'label'], factor: 0.25 }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { crew: 'melt' } },
        title: 'Changeovers at the constraint',
        body: "Melt's changeovers dropped from about 8 minutes to 2, so it kept up even with lots of 5: {shipped} shipped instead of {baseline}, each about {lead} minutes from order to shipping. Time saved at the constraint is time gained by the whole workshop, and quicker changeovers there make smaller lots affordable.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { crew: 'pour' } },
        title: 'Quicker, but not where it counts',
        body: "Pour's changeovers got faster, but Pour already had time to spare, so the workshop still shipped only {shipped}. Melt kept losing time to changeovers. Time saved at a station that isn't the constraint is a mirage.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not the constraint',
        body: 'The workshop shipped {shipped}; the goal is {target}. Changeovers only cost output at the station that sets the pace. Watch which station is always busy, and which ones wait.',
      },
    ],
  },
  {
    id: 'tier4-carts',
    tier: 4,
    title: 'Move in small loads',
    principles: [20, 23, 21],
    requires: ['tier4-quick-change'],
    briefing:
      'Orders now come in lots of 10, so Melt keeps up. But every station waits until a whole lot of 10 is done before carrying it to the next one. The workshop ships {baseline} a shift, and a candle takes about {leadBefore} minutes from order to shipping. Watch the carts.',
    model: workshop(10, 10),
    seed: 1,
    goal: goal('How many candles should go to the next station at a time?'),
    levers: [{ id: 'cart', kind: 'transferSize', label: 'Candles per trip', sizes: [10, 5, 1] }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { cart: '1' } },
        title: 'Make ten, move one',
        body: "Melt still melts 10 of a scent in a row, so changeovers stay rare, but each candle now moves on as soon as it's done. Pour starts on the first candle while Melt works on the second: about {lead} minutes from order to shipping instead of {leadBefore}, and {shipped} shipped. The batch you move doesn't have to be the batch you make. The extra trips cost nothing, because the stations after Melt have time to spare.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { cart: '10' } },
        title: 'Waiting for the whole lot',
        body: 'Every candle waited for its whole lot at every station: about {lead} minutes from order to shipping, and the last lots were still sitting in carts when the shift ended, so only {shipped} shipped.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { cart: '5' } },
        title: 'Halfway there',
        body: 'Carts of 5 cut the wait to about {lead} minutes, and {shipped} shipped: better, but candles still sit in carts while their neighbors are finished. Smaller loads move faster.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Still waiting in carts',
        body: 'Candles took about {lead} minutes from order to shipping, and {shipped} shipped. Try moving them in smaller loads.',
      },
    ],
  },
]
