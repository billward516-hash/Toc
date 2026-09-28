import type { Dist } from '../engine/distributions.ts'
import type { Level } from './types.ts'

const SHIFT = 480
const die: Dist = { kind: 'uniform', min: 1, max: 7 }

export const tier2: Level[] = [
  {
    id: 'tier2-dice',
    tier: 2,
    title: 'Same average, fewer robots',
    principles: [15, 13],
    requires: ['tier1-five-steps'],
    briefing:
      "The planner's math is simple: every station takes 4 minutes a robot on average, so an 8-hour shift should ship about 120 robots. First, watch the line on a perfect day, when every station takes exactly 4 minutes.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: die },
        { id: 'mold', name: 'Mold', cycleTime: die },
        { id: 'paint', name: 'Paint', cycleTime: die },
        { id: 'assemble', name: 'Assemble', cycleTime: die },
        { id: 'box', name: 'Box', cycleTime: die },
      ],
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 8,
    goal: {
      kind: 'predict',
      prompt:
        'On a real day each robot takes anywhere from 1 to 7 minutes at every station, like rolling a die, still 4 minutes on average. How many robots will the real line ship?',
      options: [
        { id: 'more', label: 'More than {steady}' },
        { id: 'same', label: 'About {steady}' },
        { id: 'fewer', label: 'Fewer than {steady}' },
      ],
      answer: 'fewer',
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'fewer' },
        title: 'Right: fewer',
        body: "The real line shipped {shipped}, {gap} fewer than the perfect day, even though every station still averages 4 minutes. A station's fast turns are often wasted: it has nothing to work on because the station before it was slow. Its slow turns are never wasted: everyone after it waits. The ups don't cancel the downs; the downs pass along the line and add up.",
      },
      {
        trigger: { kind: 'predicted', option: 'same' },
        title: 'Fewer, not the same',
        body: "The real line shipped {shipped}, {gap} fewer than the perfect day. The averages match, but the stations depend on each other. A fast turn is wasted when the station before it was slow and there's nothing to work on, while a slow turn makes everyone after it wait. The downs pass along the line and add up.",
      },
      {
        trigger: { kind: 'predicted', option: 'more' },
        title: 'Fewer, not more',
        body: "The real line shipped {shipped}, {gap} fewer than the perfect day. Fast turns can't make up for slow ones, because a fast station often has nothing to work on, while every slow turn holds up everyone after it. In a line of dependent steps, variation only takes robots away.",
      },
    ],
  },
  {
    id: 'tier2-pace',
    tier: 2,
    title: 'Pace the orders',
    principles: [14],
    requires: ['tier2-dice'],
    briefing:
      "Orders now arrive on a schedule. Today the planner releases one every 3 minutes, and the line is swamped. Paint is the constraint at about 3.8 minutes a robot on average, but some robots take it under 2 minutes and others over 6. Pick a schedule that keeps the line steady (no station with {limit} or more parts waiting, for at least {minSteadyPct}% of the shift) and still ships at least {minShipped}.",
    model: {
      stations: [
        { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 1.8, max: 3.2 } },
        { id: 'mold', name: 'Mold', cycleTime: { kind: 'uniform', min: 1.6, max: 3.2 } },
        { id: 'paint', name: 'Paint', cycleTime: { kind: 'uniform', min: 1.4, max: 6.2 } },
        { id: 'box', name: 'Box', cycleTime: { kind: 'uniform', min: 1.8, max: 3.0 } },
      ],
      release: { kind: 'interval', every: { kind: 'fixed', value: 3 } },
      horizon: SHIFT,
    },
    // A day on which releasing at exactly Paint's average pace doesn't get lucky.
    seed: 11,
    goal: { kind: 'steady', pileLimit: 5, minSteady: 0.95, minShipped: 105, prompt: 'How often should a new order be released?' },
    levers: [{ id: 'pace', kind: 'releasePace', label: 'Release a new order', every: [3, 3.4, 3.8, 4.2, 5] }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { pace: '4.2' } },
        title: 'Steady, with room to breathe',
        body: "Releasing an order every 4.2 minutes, a little slower than Paint's 3.8-minute average, left Paint room to catch up after its slow turns. The line was steady {steadyPct}% of the shift and shipped {shipped}. With variation, the constraint needs some slack, or every slow streak leaves a pile behind.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { pace: '3.8' } },
        title: 'A gamble on the average',
        body: "Every 3.8 minutes matches Paint's average exactly, so Paint has no slack. After each slow streak it falls behind and never catches up, and the pile grows: steady only {steadyPct}% of the shift. On a lucky day this can hold; today wasn't one. Variation piles up at the constraint.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { pace: '5' } },
        title: 'Calm, but too slow',
        body: 'Every 5 minutes kept things calm, but Paint often sat waiting for work and the factory shipped only {shipped}. Some slack protects the constraint; too much wastes it.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Faster than Paint can go',
        body: "Orders arrived faster than Paint can work on average, so the pile in front of Paint grew all shift and the line was steady only {steadyPct}% of the time. Releasing more work doesn't ship more robots; it only builds inventory.",
      },
    ],
  },
]
