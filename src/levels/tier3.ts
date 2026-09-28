import type { Dist } from '../engine/distributions.ts'
import type { Station } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
const U = (min: number, max: number): Dist => ({ kind: 'uniform', min, max })

// Cut and Mold feed Paint quickly, so a rope's robots gather in front of Paint, where they protect it.
const line = (box: Dist = U(1.8, 3.4)): Station[] => [
  { id: 'cut', name: 'Cut', cycleTime: U(2.0, 3.2) },
  { id: 'mold', name: 'Mold', cycleTime: U(1.6, 3.0) },
  { id: 'paint', name: 'Paint', cycleTime: U(3.0, 5.0) },
  { id: 'assemble', name: 'Assemble', cycleTime: U(1.8, 3.4) },
  { id: 'box', name: 'Box', cycleTime: box },
]

const withChanges = (stations: Station[], changes: Record<string, Partial<Station>>) =>
  stations.map((station) => ({ ...station, ...changes[station.id] }))

// A healthy buffer: 2 to 15 robots waiting in front of Paint for at least 90% of the shift.
const band = { drum: 'paint', low: 2, high: 15, minHealthy: 0.9, freshDays: 3 }

export const tier3: Level[] = [
  {
    id: 'tier3-rope',
    tier: 3,
    title: 'Tie the rope',
    principles: [16, 18],
    requires: ['tier2-pace'],
    briefing:
      "Paint is the constraint, so it sets the pace for the whole factory, like a drum. It needs a buffer: a small pile of work in front of it, {low} to {high} robots, so a slow turn upstream never leaves it waiting. Today parts go in as fast as Cut can take them. Watch what happens to Paint's buffer.",
    model: {
      stations: withChanges(line(), { box: { breaks: [{ from: 240, to: 270 }] } }),
      release: { kind: 'saturate' },
      horizon: SHIFT,
    },
    seed: 1,
    goal: {
      kind: 'buffer',
      ...band,
      maxAvgWip: 8,
      prompt: "A rope lets a new robot in only when one finishes at the station it's tied to, with at most 5 on the way. Where should it be tied?",
    },
    levers: [{ id: 'rope', kind: 'ropeTo', label: 'Tie the rope to', stations: ['cut', 'paint', 'box'], length: 5 }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { rope: 'paint' } },
        title: 'Drum, buffer, rope',
        body: "With the rope tied to Paint, a new robot went in only when Paint finished one, so work arrived exactly as fast as Paint could use it. Its buffer was healthy {healthyPct}% of the shift. The factory shipped {shipped} (before: {baseline}) with only {wip} robots on the floor on average, instead of {wipBefore}. The constraint sets the pace; everything else follows it.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { rope: 'cut' } },
        title: 'Tied to the wrong station',
        body: "Tied to Cut, the rope lets a robot in each time Cut finishes one, and Cut is faster than Paint. So work still went in faster than Paint could use it, and the pile in front of Paint flooded: healthy only {healthyPct}% of the shift, with {wip} robots on the floor on average. The rope has to be tied to the drum.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { rope: 'box' } },
        title: 'One out, one in',
        body: "Tied to Box, the rope lets a robot in each time one ships. That sounds fair, but it counts the robots already past Paint, so fewer were left waiting in front of it. And when Box stopped for lunch, nothing shipped, so nothing went in. Paint's buffer ran dry: healthy only {healthyPct}% of the shift, and {shipped} shipped instead of {baseline}. Tie the rope to the constraint, so only its pace decides.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not a healthy buffer',
        body: "Paint's buffer was healthy only {healthyPct}% of the shift. Tie the rope to the station that sets the factory's pace.",
      },
    ],
  },
  {
    id: 'tier3-size',
    tier: 3,
    title: 'Size the buffer',
    principles: [17],
    requires: ['tier3-rope'],
    briefing:
      "The rope is tied to Paint, 5 robots long. But now Mold's machine jams: every two hours or so it stops for 25 to 35 minutes. Watch Paint's buffer during a jam. A longer rope means a bigger buffer, but also more robots on the floor.",
    model: {
      stations: withChanges(line(), { mold: { jams: { every: U(90, 150), lasts: U(25, 35) } } }),
      release: { kind: 'rope', constraint: 'paint', buffer: 5 },
      horizon: SHIFT,
    },
    // Mold jams at 1:33, 3:42 and 5:54.
    seed: 10,
    goal: { kind: 'buffer', ...band, maxAvgWip: 15, prompt: 'How long should the rope be?' },
    levers: [{ id: 'length', kind: 'ropeLength', label: 'Rope length', lengths: [5, 8, 12, 16, 24] }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { length: '12' } },
        title: 'Just enough buffer',
        body: "With a 12-robot rope, Paint had enough work in front of it to keep going through each of Mold's jams, and the buffer refilled before the next one. It was healthy {healthyPct}% of the shift, with {wip} robots on the floor on average, and the factory shipped {shipped} instead of {baseline}. Size the buffer to cover the hiccups upstream, and no bigger.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { length: '16' } },
        title: 'Safe, but heavy',
        body: "16 robots kept Paint going through every jam: healthy {healthyPct}% of the shift. But {wip} robots sat on the floor on average, over the limit of {maxWip}, and the factory shipped {shipped}, no more than a shorter rope would. A bigger buffer than you need is just inventory: cash tied up, space used, and a longer wait for every robot. Try the shortest rope that still covers Mold's jams.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { length: '24' } },
        title: 'Flooded',
        body: "A 24-robot rope is hardly a rope at all. More than {high} robots piled up in front of Paint for most of the shift (healthy only {healthyPct}%), with {wip} on the floor on average. Paint couldn't work any faster, so the extra robots just waited.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { length: '8' } },
        title: 'Not quite enough',
        body: "With 8 robots, Paint worked through the start of each Mold jam, but used up its buffer before Mold was running again, and then it waited. Healthy {healthyPct}% of the shift, {shipped} shipped. The buffer has to last as long as a jam does.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { length: '5' } },
        title: 'Running dry',
        body: "With 5 robots, every Mold jam drained Paint's buffer within minutes, and then Paint sat idle: healthy only {healthyPct}% of the shift, and {shipped} shipped. Every minute the constraint waits is lost to the whole factory.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not a healthy buffer',
        body: "Paint's buffer was healthy only {healthyPct}% of the shift. Watch it during Mold's jams: it needs enough robots to last until Mold is running again.",
      },
    ],
  },
  {
    id: 'tier3-read',
    tier: 3,
    title: 'Read the buffer',
    principles: [19],
    requires: ['tier3-size'],
    briefing:
      "Three machines jam today: Cut, Mold, and Box. Maintenance can fix one of them for good. Watch Paint's buffer: when it runs into the red, see which station is jammed at that moment. Under the shift clock, a list of jams shows what each one did to the buffer.",
    model: {
      stations: withChanges(line(U(1.2, 2.4)), {
        cut: { jams: { every: U(40, 80), lasts: U(4, 8) } },
        mold: { jams: { every: U(80, 120), lasts: U(30, 40) } },
        box: { jams: { every: U(60, 100), lasts: U(25, 35) } },
      }),
      release: { kind: 'rope', constraint: 'paint', buffer: 8 },
      horizon: SHIFT,
    },
    // Box jams first, then Mold, and their jams never overlap, so each red stretch has one cause.
    seed: 27,
    goal: { kind: 'buffer', ...band, maxAvgWip: 12, prompt: 'Where should maintenance go?' },
    levers: [{ id: 'fix', kind: 'maintain', label: 'Send maintenance to', stations: ['cut', 'mold', 'assemble', 'box'] }],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { fix: 'mold' } },
        title: 'The buffer pointed at Mold',
        body: "Each time Paint's buffer ran into the red, Mold was jammed. With Mold fixed, Paint never ran short: healthy {healthyPct}% of the shift, and {shipped} shipped instead of {baseline}. Box still jammed and still built big piles, but they sat after Paint, and Box is fast enough to catch up. The buffer shows which problems cost the factory robots; fix those first.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { fix: 'box' } },
        title: 'A big pile, not a big problem',
        body: "Box's jams built big piles, but after Paint. Paint kept working through them, and Box, much faster than Paint, caught up each time, so fixing it changed almost nothing: {shipped} shipped, against {baseline} before. Mold's jams, meanwhile, still drained Paint's buffer: healthy only {healthyPct}%. Watch the buffer, not the biggest pile.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { fix: 'cut' } },
        title: 'Covered by the buffer',
        body: "Cut's jams were short, and Paint's buffer covered every one. That's exactly what a buffer is for. The long jams at Mold still drained it: healthy only {healthyPct}% of the shift.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { fix: 'assemble' } },
        title: 'Nothing to fix',
        body: 'Assemble never jammed today, so maintenance had nothing to do there. Watch for the moments Paint\'s buffer runs into the red, and check which station is jammed right then.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not a healthy buffer',
        body: "Paint's buffer was healthy only {healthyPct}% of the shift. Watch for the moments it runs into the red, and check which station is jammed right then.",
      },
    ],
  },
]
