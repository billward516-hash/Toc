import { describe, expect, it } from 'vitest'
import type { FactoryModel } from '../engine/model.ts'
import { allPlans, applyChange, applyLevers, leverValues, overBudget, planCost, valueLabel } from './levers.ts'
import type { Lever } from './types.ts'

const lunch = [{ from: 240, to: 300 }]
const model: FactoryModel = {
  stations: [
    { id: 'cut', name: 'Cut', cycleTime: { kind: 'uniform', min: 2, max: 4 }, breaks: lunch },
    { id: 'paint', name: 'Paint', cycleTime: { kind: 'fixed', value: 5 }, breaks: lunch },
  ],
  release: { kind: 'saturate' },
  horizon: 480,
}

const levers: Lever[] = [
  { id: 'tool', kind: 'upgrade', label: 'Tool', stations: ['cut', 'paint'], factor: 0.8 },
  { id: 'floater', kind: 'coverBreak', label: 'Floater', stations: ['cut', 'paint'] },
]

describe('applyLevers', () => {
  it('speeds up only the station that gets the upgrade', () => {
    const changed = applyLevers(model, levers, { tool: 'paint', floater: 'cut' })
    expect(changed.stations[1].cycleTime).toEqual({ kind: 'fixed', value: 4 })
    expect(changed.stations[0].cycleTime).toEqual(model.stations[0].cycleTime)
  })

  it('removes breaks only where the floater covers', () => {
    const changed = applyLevers(model, levers, { tool: 'paint', floater: 'cut' })
    expect(changed.stations[0].breaks).toEqual([])
    expect(changed.stations[1].breaks).toEqual(lunch)
  })

  it('leaves the original model untouched', () => {
    applyLevers(model, levers, { tool: 'cut', floater: 'paint' })
    expect(model.stations[0].cycleTime).toEqual({ kind: 'uniform', min: 2, max: 4 })
    expect(model.stations[1].breaks).toEqual(lunch)
  })
})

describe('rope and maintenance levers', () => {
  const jammy: FactoryModel = {
    ...model,
    stations: model.stations.map((s) => ({ ...s, jams: { every: { kind: 'fixed', value: 60 }, lasts: { kind: 'fixed', value: 10 } } })),
  }
  const rope: Lever[] = [
    { id: 'tie', kind: 'ropeTo', label: 'Tie', stations: ['cut', 'paint'], length: 5 },
    { id: 'length', kind: 'ropeLength', label: 'Length', lengths: [3, 8] },
  ]

  it('ties a rope of the lever length, then lets the length lever resize it', () => {
    expect(applyLevers(model, rope.slice(0, 1), { tie: 'paint' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 5 })
    expect(applyLevers(model, rope, { length: '8', tie: 'paint' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 8 })
  })

  it('resizes a rope the line already has, and leaves a line without one alone', () => {
    const roped: FactoryModel = { ...model, release: { kind: 'rope', constraint: 'paint', buffer: 5 } }
    expect(applyLevers(roped, rope.slice(1), { length: '3' }).release).toEqual({ kind: 'rope', constraint: 'paint', buffer: 3 })
    expect(applyLevers(model, rope.slice(1), { length: '3' }).release).toEqual({ kind: 'saturate' })
  })

  it('stops jams only where maintenance goes, and never touches planned breaks', () => {
    const fix: Lever = { id: 'fix', kind: 'maintain', label: 'Fix', stations: ['cut', 'paint'] }
    const changed = applyLevers(jammy, [fix], { fix: 'paint' })
    expect(changed.stations[1].jams).toBeUndefined()
    expect(changed.stations[1].breaks).toEqual(lunch)
    expect(changed.stations[0].jams).toEqual(jammy.stations[0].jams)
    const covered = applyLevers(jammy, [levers[1]], { floater: 'paint' })
    expect(covered.stations[1].breaks).toEqual([])
    expect(covered.stations[1].jams).toEqual(jammy.stations[1].jams)
  })
})

describe('machine rules and purchases', () => {
  const shop: FactoryModel = {
    ...model,
    products: [
      { id: 'poster', name: 'Poster' },
      { id: 'flyer', name: 'Flyer' },
    ],
    mix: ['poster', 'flyer'],
    stations: [
      model.stations[0],
      { id: 'print', name: 'Print', cycleTime: { kind: 'fixed', value: 5 }, machines: [{ name: 'Big press', products: ['poster'] }, { name: 'Small press' }] },
    ],
  }
  const shopLevers: Lever[] = [
    {
      id: 'rule',
      kind: 'machineRule',
      label: 'Big press may print',
      station: 'print',
      machine: 'Big press',
      options: [
        { id: 'posters', label: 'Posters only', products: ['poster'] },
        { id: 'both', label: 'Anything' },
      ],
    },
    {
      id: 'buy',
      kind: 'buy',
      label: 'Buy',
      options: [{ id: 'press', label: 'A press, $9,000', station: 'print', machine: { name: 'New press', products: ['flyer'] }, price: 9000 }],
    },
  ]

  it('changes only the named machine, and adds a bought machine to its station', () => {
    const changed = applyLevers(shop, shopLevers, { rule: 'both', buy: 'press' })
    expect(changed.stations[1].machines).toEqual([
      { name: 'Big press', products: undefined },
      { name: 'Small press' },
      { name: 'New press', products: ['flyer'] },
    ])
    expect(changed.stations[0]).toBe(shop.stations[0])
    expect(applyLevers(shop, shopLevers, { rule: 'posters', buy: 'none' }).stations[1].machines).toEqual(shop.stations[1].machines)
  })

  it('offers each option, labels it, and counts what a plan spends', () => {
    expect(leverValues(shopLevers[0])).toEqual(['posters', 'both'])
    expect(leverValues(shopLevers[1])).toEqual(['none', 'press'])
    expect(valueLabel(shopLevers[1], 'none', shop)).toBe("Don't buy")
    expect(valueLabel(shopLevers[1], 'press', shop)).toBe('A press, $9,000')
    expect(planCost(shopLevers, { rule: 'both', buy: 'press' })).toBe(9000)
    expect(planCost(shopLevers, { rule: 'both', buy: 'none' })).toBe(0)
  })

  it('counts how far a plan goes over the budget, if there is one', () => {
    expect(overBudget(shopLevers, { rule: 'both', buy: 'press' }, 5000)).toBe(4000)
    expect(overBudget(shopLevers, { rule: 'both', buy: 'press' }, 9000)).toBe(0)
    expect(overBudget(shopLevers, { rule: 'both', buy: 'press' })).toBe(0)
  })
})

describe('batch levers', () => {
  const candles: FactoryModel = {
    products: [
      { id: 'orange', name: 'Orange' },
      { id: 'ocean', name: 'Ocean' },
    ],
    mix: ['orange', 'ocean'],
    stations: [
      { id: 'melt', name: 'Melt', cycleTime: { kind: 'fixed', value: 3 }, changeover: { kind: 'fixed', value: 8 } },
      { id: 'pack', name: 'Pack', cycleTime: { kind: 'fixed', value: 1 } },
    ],
    release: { kind: 'interval', every: { kind: 'fixed', value: 4 } },
    horizon: 480,
  }
  const batchLevers: Lever[] = [
    { id: 'lot', kind: 'lotSize', label: 'Lot', sizes: [1, 3] },
    { id: 'crew', kind: 'quickChange', label: 'Crew', stations: ['melt'], factor: 0.25 },
    { id: 'cart', kind: 'transferSize', label: 'Cart', sizes: [1, 5] },
  ]

  it('brings orders in lots of one product at the same average pace', () => {
    const lots = applyLevers(candles, batchLevers, { lot: '3' })
    expect(lots.release).toEqual({ kind: 'interval', every: { kind: 'fixed', value: 12 }, lot: 3 })
    expect(lots.mix).toEqual(['orange', 'orange', 'orange', 'ocean', 'ocean', 'ocean'])
    const back = applyLevers(lots, batchLevers, { lot: '1' })
    expect(back.release).toEqual({ kind: 'interval', every: { kind: 'fixed', value: 4 }, lot: 1 })
    expect(back.mix).toEqual(['orange', 'ocean'])
  })

  it('cuts changeovers where the crew works, and sets every cart size', () => {
    const changed = applyLevers(candles, batchLevers, { crew: 'melt', cart: '5' })
    expect(changed.stations[0].changeover).toEqual({ kind: 'fixed', value: 2 })
    expect(changed.stations.map((s) => s.transfer)).toEqual([5, 5])
    expect(valueLabel(batchLevers[2], '1', candles)).toBe('One at a time')
    expect(valueLabel(batchLevers[0], '3', candles)).toBe('3 at a time')
  })
})

describe('product mix levers', () => {
  const bakery: FactoryModel = {
    products: [
      { id: 'cake', name: 'Cake' },
      { id: 'cookie', name: 'Cookie' },
    ],
    mix: ['cake', 'cookie'],
    stations: [
      { id: 'mix', name: 'Mix', cycleTime: { kind: 'fixed', value: 1 } },
      { id: 'bake', name: 'Bake', cycleTime: { kind: 'fixed', value: 2 } },
    ],
    release: { kind: 'interval', every: { kind: 'fixed', value: 3 } },
    horizon: 480,
  }
  const mixLevers: Lever[] = [
    {
      id: 'first',
      kind: 'priority',
      label: 'Bake first',
      station: 'bake',
      options: [
        { id: 'oldest', label: 'Oldest first' },
        { id: 'cookies', label: 'Cookies first', order: ['cookie'] },
      ],
    },
    {
      id: 'menu',
      kind: 'menu',
      label: 'Sell',
      options: [
        { id: 'both', label: 'Both', mix: ['cake', 'cookie'], every: 3 },
        { id: 'cookies', label: 'Cookies only', mix: ['cookie'], every: 1.5 },
      ],
    },
  ]

  it('sets the order only at the named station, and oldest first clears it', () => {
    const changed = applyLevers(bakery, mixLevers, { first: 'cookies' })
    expect(changed.stations[1].priority).toEqual(['cookie'])
    expect(changed.stations[0]).toBe(bakery.stations[0])
    expect(applyLevers(changed, mixLevers, { first: 'oldest' }).stations[1].priority).toBeUndefined()
  })

  it('sets what comes in, and how often, from the menu', () => {
    const changed = applyLevers(bakery, mixLevers, { menu: 'cookies' })
    expect(changed.mix).toEqual(['cookie'])
    expect(changed.release).toEqual({ kind: 'interval', every: { kind: 'fixed', value: 1.5 } })
    expect(changed.stations).toEqual(bakery.stations)
  })

  it('offers and labels each option', () => {
    expect(leverValues(mixLevers[0])).toEqual(['oldest', 'cookies'])
    expect(leverValues(mixLevers[1])).toEqual(['both', 'cookies'])
    expect(valueLabel(mixLevers[0], 'cookies', bakery)).toBe('Cookies first')
    expect(valueLabel(mixLevers[1], 'both', bakery)).toBe('Both')
    expect(planCost(mixLevers, { first: 'cookies', menu: 'both' })).toBe(0)
  })
})

describe('option levers', () => {
  const repair: Lever = {
    id: 'repair',
    kind: 'option',
    label: 'Fix first',
    options: [
      { id: 'cut', label: 'Cut first', stations: { cut: { outages: [{ at: { kind: 'fixed', value: 60 }, lasts: { kind: 'fixed', value: 20 } }] } } },
      { id: 'stock', label: 'Keep 30 on hand', price: 500, model: { supply: { onHand: 30, deliveries: [] } } },
    ],
  }

  it('changes the named stations and the rest of the model, and nothing else', () => {
    const cut = applyLevers(model, [repair], { repair: 'cut' })
    expect(cut.stations[0].outages).toHaveLength(1)
    expect(cut.stations[0].cycleTime).toEqual(model.stations[0].cycleTime)
    expect(cut.stations[1]).toBe(model.stations[1])
    expect(applyLevers(model, [repair], { repair: 'stock' }).supply).toEqual({ onHand: 30, deliveries: [] })
    expect(model.stations[0].outages).toBeUndefined()
  })

  it('applies before other levers, so they work on the changed factory', () => {
    const both = applyLevers(model, [repair, levers[0]], { repair: 'cut', tool: 'cut' })
    expect(both.stations[0].outages).toHaveLength(1)
    expect(both.stations[0].cycleTime).toEqual({ kind: 'uniform', min: 1.6, max: 3.2 })
  })

  it('offers, labels, and prices each option', () => {
    expect(leverValues(repair)).toEqual(['cut', 'stock'])
    expect(valueLabel(repair, 'stock', model)).toBe('Keep 30 on hand')
    expect(planCost([repair], { repair: 'stock' })).toBe(500)
    expect(planCost([repair], { repair: 'cut' })).toBe(0)
  })

  it('applies a change on its own', () => {
    expect(applyChange(model, { stations: { paint: { servers: 2 } } }).stations[1].servers).toBe(2)
  })
})

describe('allPlans', () => {
  it('lists every combination of choices', () => {
    expect(allPlans(levers)).toEqual([
      { tool: 'cut', floater: 'cut' },
      { tool: 'cut', floater: 'paint' },
      { tool: 'paint', floater: 'cut' },
      { tool: 'paint', floater: 'paint' },
    ])
  })
})
