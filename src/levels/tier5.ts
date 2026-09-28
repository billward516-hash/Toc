import type { Dist } from '../engine/distributions.ts'
import type { Machine } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })

const smallPress = (name: string): Machine => ({ name, products: ['flyer'], times: { flyer: about(6) } })

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
]
