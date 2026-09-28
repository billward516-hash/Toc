import type { Dist } from '../engine/distributions.ts'
import type { Break, FactoryModel, Station } from '../engine/model.ts'
import type { Level } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })
const fixed = (minutes: number): Dist => ({ kind: 'fixed', value: minutes })

// The robot factory, running drum-buffer-rope with Paint as the constraint and a rope of 12 robots, so
// the robots waiting at Paint can keep it busy for most of an hour.
const everyone = ['cut', 'mold', 'paint', 'assemble', 'box']
const factory = (changes: Record<string, Partial<Station>> = {}, extra: Partial<FactoryModel> = {}): FactoryModel => ({
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: about(2.6) },
    { id: 'mold', name: 'Mold', cycleTime: about(2.3) },
    { id: 'paint', name: 'Paint', cycleTime: about(4) },
    { id: 'assemble', name: 'Assemble', cycleTime: about(2.6) },
    { id: 'box', name: 'Box', cycleTime: about(2.6) },
  ].map((station) => ({ ...station, ...changes[station.id] })),
  release: { kind: 'rope', constraint: 'paint', buffer: 12 },
  horizon: SHIFT,
  ...extra,
})

// Paint's operator is out from 1:00 to 3:00, and whichever station lends its operator stands idle then.
const absent: Break = { from: 60, to: 180, reason: 'No operator' }
const covers = (station: string) => ({ stations: { paint: { breaks: [] }, [station]: { breaks: [absent] } } })

// Everyone stops for lunch from 4:00 to 4:45, except whoever is paid to work through it.
const lunch: Break = { from: 240, to: 285 }
const atLunch = (except: string[] = []) => Object.fromEntries(everyone.filter((id) => !except.includes(id)).map((id) => [id, { breaks: [lunch] }]))
const works = (...stations: string[]) => ({ stations: Object.fromEntries(stations.map((id) => [id, { breaks: [] }])) })
const OVERTIME = 150
const dollars = (amount: number) => `$${amount.toLocaleString('en-US')}`

// Paint's service takes 45 minutes, on top of lunch unless it's done at lunch.
const service = (from: number): Break => ({ from, to: from + 45, reason: 'Maintenance' })
const serviced = (from: number) => ({ stations: { paint: { breaks: from === lunch.from ? [service(from)] : [lunch, service(from)] } } })

// The candle workshop from Tier 4, in lots of 10: Melt is the constraint, and Pour's nozzle keeps a
// little of the last scent, so the first candle it pours after a scent change is spoiled.
const workshop: FactoryModel = {
  products: [
    { id: 'orange', name: 'Orange blossom' },
    { id: 'ocean', name: 'Ocean breeze' },
  ],
  mix: ['orange', 'ocean'].flatMap((scent) => Array<string>(10).fill(scent)),
  stations: [
    { id: 'melt', name: 'Melt', cycleTime: about(3), changeover: about(8) },
    { id: 'pour', name: 'Pour', cycleTime: about(2), changeover: about(3), changeoverScrap: 1 },
    { id: 'label', name: 'Label', cycleTime: about(1.8), changeover: about(2) },
    { id: 'pack', name: 'Pack', cycleTime: about(1.6) },
  ],
  release: { kind: 'interval', every: fixed(40), lot: 10 },
  horizon: SHIFT,
}

export const tier10: Level[] = [
  {
    id: 'tier10-power-cut',
    tier: 10,
    title: 'The power cut',
    principles: [4],
    requires: ['tier3-read'],
    briefing:
      'Back at the robot factory, running drum-buffer-rope with Paint as the constraint. The rope is longer now, 12 robots, so there are usually 8 to 10 robots waiting at Paint. First, watch a normal day.',
    model: factory(),
    seed: 1,
    goal: {
      kind: 'predict',
      prompt: 'On the next day, the power goes out at 2:30, and every station stops for 30 minutes. How many robots will the power cut cost the factory?',
      options: [
        { id: 'paint', label: "About 7: Paint's 30 minutes" },
        { id: 'every', label: 'About 35: 30 minutes at each of the 5 stations' },
        { id: 'none', label: 'None: the robots waiting at Paint cover it' },
      ],
      answer: 'paint',
      compare: {
        first: 'A normal day',
        second: 'The power-cut day',
        change: { model: { incidents: [{ name: 'Power cut', at: fixed(150), outages: everyone.map((station) => ({ station, lasts: fixed(30) })) }] } },
      },
    },
    levers: [],
    popups: [
      {
        trigger: { kind: 'predicted', option: 'paint' },
        title: "Only Paint's minutes count",
        body: "The power-cut day shipped {second}, {gap} fewer. Every station lost 30 minutes, but only Paint's cost robots: the others have time to spare, and they caught up once the power came back. Paint is the constraint, so its 30 minutes, about 7 robots' worth, were lost for good. An hour lost at the constraint is an hour lost for the whole factory.",
      },
      {
        trigger: { kind: 'predicted', option: 'every' },
        title: 'Not 35',
        body: "The power-cut day shipped {second}, only {gap} fewer. Every station stopped for 30 minutes, but only Paint's 30 minutes cost robots: the other stations have time to spare, and they caught up after the power came back.",
      },
      {
        trigger: { kind: 'predicted', option: 'none' },
        title: "Waiting robots can't paint themselves",
        body: "The power-cut day shipped {second}, {gap} fewer. The robots waiting at Paint were still there when the power came back, but Paint itself had stopped. A buffer protects the constraint when something before it stops, not when the constraint stops.",
      },
    ],
  },
  {
    id: 'tier10-short-handed',
    tier: 10,
    title: 'Short-handed',
    principles: [4, 17],
    requires: ['tier10-power-cut'],
    briefing:
      "Paint's operator has to be away from 1:00 to 3:00 today. Another operator can cover for them, but then that operator's own station stands idle until 3:00. If nobody covers, Paint stands idle instead, and the factory ships {baseline}.",
    model: factory({ paint: { breaks: [absent] } }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [{ metric: 'shipped', min: 108 }],
      freshDays: 6,
      prompt: "Who should cover for Paint's operator from 1:00 to 3:00?",
    },
    levers: [
      {
        id: 'cover',
        kind: 'option',
        label: "Cover for Paint's operator",
        icon: 'swap',
        options: [
          { id: 'nobody', label: 'Nobody: Paint waits' },
          { id: 'cut', label: "Cut's operator: Cut stands idle", ...covers('cut') },
          { id: 'mold', label: "Mold's operator: Mold stands idle", ...covers('mold') },
          { id: 'box', label: "Box's operator: Box stands idle", ...covers('box') },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { cover: 'box' } },
        title: 'Cover the constraint first',
        body: "With Box's operator painting, Paint never stopped. Box stood idle for two hours and robots piled up in front of it, but Box is faster than Paint, so it caught up before the end of the day: {shipped} shipped. An hour lost at the constraint is lost for the whole factory; an hour lost at a station with time to spare is just a pile that shrinks again.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { cover: 'nobody' } },
        title: 'Two hours of Paint, gone',
        body: "Paint stood idle for two hours, and nothing wins that time back: {shipped} shipped. Paint is the constraint, so two hours there cost about 30 robots.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { cover: 'cut' } },
        title: 'Paint ran dry',
        body: 'With Cut idle, no new robots started, and the ones already on their way kept Paint busy for less than an hour. Then Paint stood idle anyway: {shipped} shipped.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { cover: 'mold' } },
        title: 'Paint ran dry',
        body: 'With Mold idle, the robots already past it kept Paint busy for less than an hour. Then Paint stood idle anyway: {shipped} shipped.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough robots',
        body: '{shipped} shipped; the goal is {target}. Which station can lose two hours without costing Paint any time?',
      },
    ],
  },
  {
    id: 'tier10-overtime',
    tier: 10,
    title: 'Overtime',
    principles: [4, 5],
    requires: ['tier10-short-handed'],
    briefing:
      'Everyone stops for lunch from 4:00 to 4:45, and the factory ships {baseline} a day. A big order means it needs {target} a day this week. The manager can pay an operator to work through lunch, for ${budget} a day each.',
    model: factory(atLunch()),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'shipped', min: 111 },
        { metric: 'spend', max: OVERTIME },
      ],
      freshDays: 6,
      prompt: 'Who should work through lunch?',
    },
    levers: [
      {
        id: 'overtime',
        kind: 'option',
        label: 'Pay to work through lunch',
        icon: 'money',
        options: [
          { id: 'nobody', label: 'Nobody' },
          { id: 'cut', label: `Cut's operator, ${dollars(OVERTIME)}`, price: OVERTIME, ...works('cut') },
          { id: 'paint', label: `Paint's operator, ${dollars(OVERTIME)}`, price: OVERTIME, ...works('paint') },
          { id: 'box', label: `Box's operator, ${dollars(OVERTIME)}`, price: OVERTIME, ...works('box') },
          { id: 'everyone', label: `Everyone, ${dollars(OVERTIME * everyone.length)}`, price: OVERTIME * everyone.length, ...works(...everyone) },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { overtime: 'paint' } },
        title: 'Overtime at the constraint',
        body: 'Paint kept painting through lunch, working through the robots waiting in front of it while everyone else ate: {shipped} shipped, for ${budget} a day. Assemble and Box came back to a pile, but they are faster than Paint and cleared it. Overtime pays only at the constraint.',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { overtime: 'everyone' } },
        title: 'Five times the price',
        body: "Everyone working through lunch shipped {shipped}, about what Paint alone would have, for five times the cost: the other four stations had time to spare anyway.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { overtime: 'cut' } },
        title: 'Paid for nothing',
        body: "Cut kept cutting through lunch, but Paint still stopped for 45 minutes, so the extra parts just waited: {shipped} shipped, the same as with no overtime at all.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { overtime: 'box' } },
        title: 'Paid for nothing',
        body: 'Box worked through lunch, but Paint still stopped for 45 minutes, so Box soon had nothing to box: {shipped} shipped, the same as with no overtime at all.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { overtime: 'nobody' } },
        title: 'Lunch at the constraint',
        body: 'With everyone at lunch, Paint stopped for 45 minutes: {shipped} shipped. Whose overtime would get more robots out?',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough robots',
        body: '{shipped} shipped; the order needs {target} a day.',
      },
    ],
  },
  {
    id: 'tier10-maintenance',
    tier: 10,
    title: 'Service day',
    principles: [4],
    requires: ['tier10-overtime'],
    briefing:
      "Paint is due for its monthly service: 45 minutes with the machine switched off. The crew has booked 2:00, and everyone still stops for lunch from 4:00 to 4:45. Today the factory ships {baseline}.",
    model: factory({ ...atLunch(), ...serviced(120).stations }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [{ metric: 'shipped', min: 101 }],
      freshDays: 6,
      prompt: 'When should the crew service Paint?',
    },
    levers: [
      {
        id: 'service',
        kind: 'option',
        label: 'Service Paint',
        icon: 'wrench',
        options: [
          { id: 'first', label: 'First thing, from 0:00', ...serviced(0) },
          { id: 'morning', label: 'At 2:00, as booked', ...serviced(120) },
          { id: 'lunch', label: 'During lunch, from 4:00', ...serviced(lunch.from) },
          { id: 'evening', label: 'At 6:00', ...serviced(360) },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { service: 'lunch' } },
        title: 'When it would stop anyway',
        body: 'The crew serviced Paint while the whole factory was at lunch, when Paint would have stood still anyway, so the service cost no robots at all: {shipped} shipped. Schedule the constraint\'s maintenance for times it would be idle anyway.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { service: 'first' } },
        title: 'No quiet start',
        body: 'The first robots reach Paint a few minutes into the shift, so servicing it first thing still took 45 minutes from the constraint, on top of lunch: {shipped} shipped.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: '45 minutes of Paint',
        body: 'The service took 45 minutes away from the constraint, on top of the 45 it already loses to lunch: {shipped} shipped. Is there a time when Paint stops anyway?',
      },
    ],
  },
  {
    id: 'tier10-rework',
    tier: 10,
    title: 'Sent back',
    principles: [37],
    requires: ['tier10-maintenance'],
    briefing:
      "About 3 in every 20 robots come out of Mold with rough edges. The inspector at Box catches them and sends them back to Mold to be made again, so each one goes through Paint a second time. Today {sentBack} were sent back, and the factory shipped {baseline}.",
    model: factory({ mold: { defects: 0.15 }, box: { inspects: true, reworkTo: 'mold' } }),
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [{ metric: 'shipped', min: 110 }],
      freshDays: 6,
      prompt: 'Where should the rough edges be caught, and what should happen to those robots?',
    },
    levers: [
      {
        id: 'check',
        kind: 'option',
        label: 'Check for rough edges',
        icon: 'alert',
        options: [
          { id: 'box', label: 'At Box, and send them back to Mold' },
          { id: 'scrap', label: 'At Box, and scrap them', stations: { box: { reworkTo: undefined } } },
          { id: 'mold', label: 'Right at Mold, and make them again there', stations: { mold: { inspects: true, reworkTo: 'mold' }, box: { inspects: false, reworkTo: undefined } } },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { check: 'mold' } },
        title: 'Fix it before the constraint',
        body: 'Checked as they left Mold, rough robots were made again on the spot, before Paint ever saw them: {sentBack} made again, and {shipped} shipped. Mold has time to spare, so the extra work there cost nothing. Rework that goes back through the constraint takes its time twice.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { check: 'box' } },
        title: 'Through Paint twice',
        body: "Every robot sent back went through Paint a second time, {sentBack} of them today: Paint's time, spent twice on the same robots. {shipped} shipped.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { check: 'scrap' } },
        title: "Paint's time, thrown away",
        body: 'Scrapping the rough robots at Box threw away the time Paint had spent on them: {scrapped} scrapped and {shipped} shipped, about as few as sending them back.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough robots',
        body: '{shipped} shipped; the goal is {target}.',
      },
    ],
  },
  {
    id: 'tier10-first-candle',
    tier: 10,
    title: 'The first candle',
    principles: [37, 22],
    requires: ['tier10-rework'],
    unit: 'candles',
    briefing:
      "Back at the candle workshop, in lots of 10. Pour's nozzle keeps a little of the last scent, so the first candle it pours after a scent change smells of both and is thrown out, after Melt, the constraint, has already melted it. Today the workshop throws out {scrapped} and ships {baseline}.",
    model: workshop,
    seed: 1,
    goal: {
      kind: 'bars',
      bars: [
        { metric: 'shipped', min: 112 },
        { metric: 'scrapped', max: 0 },
        { metric: 'leadTime', max: 36 },
      ],
      freshDays: 6,
      prompt: 'How should the workshop stop wasting candles?',
    },
    levers: [
      {
        id: 'nozzle',
        kind: 'option',
        label: "Pour's nozzle",
        icon: 'swap',
        options: [
          { id: 'spoil', label: 'Leave it, and throw out the first candle' },
          { id: 'flush', label: 'Flush it at each scent change: 3 more minutes at Pour', stations: { pour: { changeover: about(6), changeoverScrap: undefined } } },
        ],
      },
      { id: 'lot', kind: 'lotSize', label: 'Candles per order', sizes: [5, 10, 20] },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { nozzle: 'flush', lot: '10' } },
        title: 'Spend the spare minutes',
        body: "Flushing the nozzle cost Pour 3 more minutes at every scent change, but Pour has time to spare, so it cost the workshop nothing, and no candle was spoiled: {shipped} shipped, each out in about {lead} minutes. Every spoiled candle had used Melt's time; spend a non-constraint's spare time to protect the constraint's work.",
      },
      {
        trigger: { kind: 'ran', met: true, choices: { nozzle: 'flush', lot: '20' } },
        title: 'Nothing spoiled, but slow',
        body: 'No candle was spoiled and {shipped} shipped, but in lots of 20 each candle waited for its whole lot: about {lead} minutes from order to shipping, over the {maxLead}-minute goal.',
      },
      {
        trigger: { kind: 'ran', met: true, choices: { nozzle: 'spoil', lot: '20' } },
        title: 'Half the scent changes, still spoiled',
        body: "Lots of 20 halved the scent changes, but Pour still spoiled the first candle of each lot: {scrapped} thrown out, each after Melt had melted it.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { lot: '5' } },
        title: 'Cleaning, not melting',
        body: 'In lots of 5 the scent changed every 5 candles, and Melt spent so long cleaning its pot that it fell behind: {shipped} shipped.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { nozzle: 'spoil', lot: '10' } },
        title: 'Melted, then thrown out',
        body: "Pour spoiled the first candle after every scent change: {scrapped} candles thrown out, each one already melted by Melt, the constraint. {shipped} shipped.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough candles',
        body: '{shipped} shipped; the goal is {target}.',
      },
    ],
  },
]
