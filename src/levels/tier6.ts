import type { Dist } from '../engine/distributions.ts'
import type { FactoryModel } from '../engine/model.ts'
import type { Economics, Level, MenuOption } from './types.ts'

const SHIFT = 480
// A station's average time, give or take 15%.
const about = (minutes: number): Dist => ({ kind: 'uniform', min: minutes * 0.85, max: minutes * 1.15 })

// Each product's price and ingredients. Per minute of the oven, the constraint, a cake earns $1,
// a cupcake $1.50, and a cookie $3.
const economics: Record<string, Economics> = {
  cake: { price: 30, materials: 10 },
  cupcake: { price: 4, materials: 1 },
  cookie: { price: 2, materials: 0.5 },
}
const EXPENSE = 400

// Orders keep coming all day, more than the oven can bake: every 19.2 minutes, 1 cake, 5 cupcakes,
// and 6 cookies (or whichever of them the bakery sells).
const CYCLE = 19.2
const order = (...counts: [string, number][]) => {
  const mix: string[] = []
  const left = new Map(counts)
  while ([...left.values()].some((n) => n > 0)) {
    for (const [product, n] of left) {
      if (n > 0) {
        mix.push(product)
        left.set(product, n - 1)
      }
    }
  }
  return mix
}
const menu = (id: string, label: string, mix: string[]): MenuOption => ({ id, label, mix, every: CYCLE / mix.length })

const bakery = (mix: string[], every: number, priority?: string[]): FactoryModel => ({
  products: [
    { id: 'cake', name: 'Cake' },
    { id: 'cupcake', name: 'Cupcake' },
    { id: 'cookie', name: 'Cookie' },
  ],
  mix,
  stations: [
    { id: 'mix', name: 'Mix', cycleTime: about(0.8) },
    { id: 'bake', name: 'Bake', cycleTime: about(2), times: { cake: about(20), cupcake: about(2), cookie: about(0.5) }, priority },
    { id: 'decorate', name: 'Decorate', cycleTime: about(0.5), times: { cake: about(8), cookie: about(1.5) } },
    { id: 'box', name: 'Box', cycleTime: about(0.4) },
  ],
  release: { kind: 'interval', every: { kind: 'fixed', value: every } },
  horizon: SHIFT,
})

const everything = order(['cake', 1], ['cupcake', 5], ['cookie', 6])
const goal = (target: number, minShipped: number, maxInventory: number, prompt: string) => ({
  kind: 'profit' as const,
  economics,
  expense: EXPENSE,
  target,
  minShipped,
  maxInventory,
  freshDays: 9,
  prompt,
})

export const tier6: Level[] = [
  {
    id: 'tier6-bake-what-pays',
    tier: 6,
    title: 'Bake what pays',
    principles: [28],
    requires: ['tier3-read'],
    briefing:
      'Welcome to the bakery. Orders pour in all day, one cake for every seven cupcakes, more than the oven can bake in a shift. A cake sells for $30 and its ingredients cost $10, so it brings in $20. A cupcake sells for $4 with $1 of ingredients: $3. Wages, rent, and power cost ${expense} a shift, whatever gets baked. Today the oven bakes orders as they come in, and the bakery makes ${profitBefore} a shift.',
    model: bakery(order(['cake', 1], ['cupcake', 7]), 2.1),
    seed: 1,
    goal: goal(220, 150, 150, 'What should the oven bake first?'),
    levers: [
      {
        id: 'first',
        kind: 'priority',
        label: 'The oven bakes',
        station: 'bake',
        options: [
          { id: 'oldest', label: 'Whatever came in first' },
          { id: 'cakes', label: 'Cakes first', order: ['cake'] },
          { id: 'cupcakes', label: 'Cupcakes first', order: ['cupcake'] },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { first: 'cupcakes' } },
        title: 'Earn the most per oven minute',
        body: "A cake brings in $20 but ties up the oven for 20 minutes: $1 a minute. A cupcake brings in only $3, but bakes in 2 minutes: $1.50 a minute. The oven is the constraint, so its minutes are what the bakery really sells. Baking cupcakes first made ${profit} instead of ${profitBefore}. Rank products by what they earn per minute of the constraint, not per item.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { first: 'cakes' } },
        title: 'The biggest margin, the smallest profit',
        body: 'Cakes earn the most each, so baking them first sounds smart. But each cake ties up the oven for 20 minutes, so the oven baked only {shipped} items while the cupcake orders piled up: ${profit} for the shift. What matters is what a product earns per minute of the oven, not per item.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { first: 'oldest' } },
        title: 'First come, first baked',
        body: 'Baking orders as they came in gave the oven\'s time to cakes and cupcakes alike: ${profit} for the shift, and the goal is ${target}. When the oven can\'t bake everything, which orders get its time matters.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough profit',
        body: 'The bakery made ${profit}; the goal is ${target}. Work out what each product earns per minute of oven time.',
      },
    ],
  },
  {
    id: 'tier6-rank-the-menu',
    tier: 6,
    title: 'Rank the menu',
    principles: [28],
    requires: ['tier6-bake-what-pays'],
    briefing:
      'Cookies are on the menu now: $2 each with 50¢ of ingredients, and a tray bakes them in half a minute each. Orders for cakes, cupcakes, and cookies come in all day, still more than the oven can bake. Today the oven bakes orders as they come in: ${profitBefore} a shift.',
    model: bakery(everything, CYCLE / everything.length),
    seed: 1,
    goal: goal(280, 220, 120, 'In what order should the oven bake?'),
    levers: [
      {
        id: 'order',
        kind: 'priority',
        label: 'The oven bakes',
        station: 'bake',
        options: [
          { id: 'oldest', label: 'Whatever came in first' },
          { id: 'cakes', label: 'Cakes, then cupcakes, then cookies', order: ['cake', 'cupcake', 'cookie'] },
          { id: 'cookies-cakes', label: 'Cookies, then cakes, then cupcakes', order: ['cookie', 'cake', 'cupcake'] },
          { id: 'cookies-cupcakes', label: 'Cookies, then cupcakes, then cakes', order: ['cookie', 'cupcake', 'cake'] },
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { order: 'cookies-cupcakes' } },
        title: 'Every oven minute counted',
        body: 'Per minute of oven time, cookies earn $3, cupcakes $1.50, and cakes $1. Baking in that order made ${profit}, against ${profitBefore} before. When the constraint can\'t make everything, give its time to whatever earns the most per minute of it, then to the next best.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { order: 'cookies-cakes' } },
        title: 'Right start, wrong second',
        body: 'Cookies first was right. But putting cakes before cupcakes gave the oven\'s remaining time to the product that earns the least per oven minute: ${profit} for the shift.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { order: 'cakes' } },
        title: 'Backwards',
        body: 'Biggest price first put the oven\'s time into the product that earns the least per minute of it. The oven baked only {shipped} items: ${profit} for the shift.',
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough profit',
        body: 'The bakery made ${profit}; the goal is ${target}. Rank the products by what each earns per minute of oven time.',
      },
    ],
  },
  {
    id: 'tier6-cost-report',
    tier: 6,
    title: 'The cost report',
    principles: [29, 26],
    requires: ['tier6-rank-the-menu'],
    briefing:
      "Last month the accountant's cost report said each cookie costs $2.30 to make: 50¢ of ingredients plus $1.80 of wages and overhead, spread over every product by labor time. At $2 each, cookies looked like a loss, so the bakery stopped making them. Profit fell to ${profitBefore} a shift. The oven still bakes whatever earns the most per oven minute first.",
    model: bakery(order(['cake', 1], ['cupcake', 5]), CYCLE / 6, ['cookie', 'cupcake', 'cake']),
    seed: 1,
    goal: goal(280, 220, 120, 'What should the bakery sell?'),
    levers: [
      {
        id: 'menu',
        kind: 'menu',
        label: 'The bakery sells',
        options: [
          menu('no-cookies', 'Cakes and cupcakes, as the report says', order(['cake', 1], ['cupcake', 5])),
          menu('all', 'Cakes, cupcakes, and cookies', everything),
          menu('no-cakes', 'Cupcakes and cookies', order(['cupcake', 5], ['cookie', 6])),
          menu('no-cupcakes', 'Cakes and cookies', order(['cake', 1], ['cookie', 6])),
        ],
      },
    ],
    popups: [
      {
        trigger: { kind: 'ran', met: true, choices: { menu: 'all' } },
        title: "Costs that don't go away",
        body: "The wages and overhead the report spread onto each cookie get paid whether the bakery bakes cookies or not. Dropping cookies saved only their 50¢ of ingredients, and lost the $1.50 each one brings in. With cookies back: ${profit} a shift instead of ${profitBefore}. Judge a product by the throughput it adds per minute of the constraint, not by a cost report.",
      },
      {
        trigger: { kind: 'ran', met: false, choices: { menu: 'no-cookies' } },
        title: 'The report was wrong',
        body: 'Without cookies, the oven\'s best product per minute is gone, and the wages and overhead stayed exactly the same: ${profit} a shift. Spreading fixed costs over products makes some look like losers when they aren\'t.',
      },
      {
        trigger: { kind: 'ran', met: false, choices: { menu: 'no-cakes' } },
        title: 'The oven sat idle',
        body: "Without cakes, every order got baked and the oven still had time to spare: the market, not the oven, became the constraint. Cakes earn the least per oven minute, but they still earn something: ${profit} a shift without them.",
      },
      {
        trigger: { kind: 'ran', met: false },
        title: 'Not enough profit',
        body: 'The bakery made ${profit}; the goal is ${target}. Every product that earns more than its ingredients adds throughput while the oven has time for it.',
      },
    ],
  },
]
