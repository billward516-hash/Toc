import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier6: Session = {
  tier: 6,
  summary:
    "Product mix and profit, in a bakery. Learners meet throughput, inventory, and operating expense in dollars, rank products by what each earns per minute of the oven (the constraint), and see why a cost report can point the wrong way. Sums matter here: keep a whiteboard or paper handy.",
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'Have a whiteboard or paper ready. Learners will divide dollars by minutes, and the working is the lesson.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open: three money words',
      minutes: 10,
      steps: [
        say(
          "Tier 6 is a bakery, and it is about money. We need three words. Throughput is the money that comes in from sales, minus what we paid for the ingredients in what we sold. Inventory is the money tied up in things we have paid for but not sold yet. Operating expense is the money we spend to turn one into the other: wages, rent, power.",
        ),
        act(
          'Write on the board: Throughput = sales minus ingredients. Inventory = money tied up. Operating expense = the cost of running the shop. Profit = throughput minus operating expense.',
        ),
        ask(
          'A cake sells for $30 and its ingredients cost $10. A cupcake sells for $4 and its ingredients cost $1. What is the throughput of each?',
          '$20 and $3. Write both on the board.',
        ),
        say(
          'Those are the numbers everyone reaches for: the cake earns more. Hold that thought. The oven is the constraint, and its minutes are what the bakery really has to sell. Let us see whether the price of a cake is the right number to look at.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier6-bake-what-pays',
      minutes: 16,
      play: 6,
      idea: 'Rank products by what they earn per minute of the constraint, not per item.',
      setup: [
        say(
          'The bakery makes cakes and cupcakes. Orders pour in all day, one cake for every seven cupcakes, more than the oven can bake in a shift. A cake brings in $20 and a cupcake $3. Wages, rent, and power cost $400 a shift, whatever gets baked. Today the oven bakes orders as they come in, and the bakery makes ${profitBefore} a shift.',
        ),
        act(
          'Give them the oven times: a cake ties up the oven for 20 minutes, a cupcake for 2. Ask them to work out what each earns per minute of oven time before they play.',
          'Cake: $20 in 20 minutes is $1 a minute. Cupcake: $3 in 2 minutes is $1.50 a minute.',
        ),
        ask('What should the oven bake first?'),
      ],
      watch: [
        'Circulate while learners do the sums. Those who divide dollars by minutes are ahead. Ask them to show the room.',
        "Some will try 'cakes first'. It sounds smart and makes the least profit: the oven bakes only a few items.",
      ],
      mistakes: [
        "Cakes first: the biggest margin per item, but each cake ties up the oven for 20 minutes, so the oven bakes very few items and the cupcake orders pile up.",
        'Whatever came in first: cakes and cupcakes share the oven, and the profit is ${profitBefore}, below the goal of ${target}.',
      ],
      debrief: [
        ask('Which earns more, a cake or a cupcake? And which earns more per minute of the oven?', 'Per item, the cake. Per oven minute, the cupcake, $1.50 against $1.'),
        say(
          'Baking cupcakes first made ${profit} instead of ${profitBefore}. The oven is the constraint, so its minutes are what the bakery really sells. Rank products by what they earn per minute of the constraint, not per item.',
        ),
        ask('Where do you choose between jobs by their size or price, when you should choose by what they earn per hour of your scarcest resource?'),
      ],
      answer: { first: 'cupcakes' },
    },
    {
      kind: 'play',
      levelId: 'tier6-rank-the-menu',
      minutes: 14,
      play: 5,
      idea: 'Give the constraint\'s time to whatever earns the most per minute of it, then to the next best.',
      setup: [
        say(
          'Cookies are on the menu now: $2 each with 50 cents of ingredients, and a tray bakes them in half a minute each. Orders for cakes, cupcakes, and cookies come in all day, still more than the oven can bake. Today the oven bakes orders as they come in: ${profitBefore} a shift.',
        ),
        ask(
          'In what order should the oven bake? Show me your working.',
          'Cookie: $1.50 in half a minute is $3 a minute. Cupcake $1.50 a minute. Cake $1 a minute.',
        ),
      ],
      watch: [
        'Four orderings, but only one is best. Look for learners who compute all three earnings before they choose.',
      ],
      mistakes: [
        'Cookies first, then cakes, then cupcakes: right start, wrong second. Cakes earn the least per oven minute.',
        'Cakes first: backwards. Biggest price first puts the oven\'s time into the product that earns the least per minute.',
      ],
      debrief: [
        ask('Rank the three products by what each earns per minute of the oven. Who can say it from memory?'),
        say(
          'Per minute of oven time, cookies earn $3, cupcakes $1.50, and cakes $1. Baking in that order made ${profit}, against ${profitBefore} before. When the constraint cannot make everything, give its time to whatever earns the most per minute, then to the next best.',
        ),
        tip('If a learner objects that nobody would sell only cookies, agree: that is what the next level is about.'),
      ],
      answer: { order: 'cookies-cupcakes' },
    },
    {
      kind: 'play',
      levelId: 'tier6-cost-report',
      minutes: 16,
      play: 6,
      idea: 'A cost report spreads costs that do not go away. Judge a product by the throughput it adds per constraint minute.',
      setup: [
        say(
          "Last month the accountant's cost report said each cookie costs $2.30 to make: 50 cents of ingredients plus $1.80 of wages and overhead, spread over every product by labor time. At $2 each, cookies looked like a loss, so the bakery stopped making them. Profit fell to ${profitBefore} a shift.",
        ),
        ask(
          'If the bakery stops making cookies, which of those costs actually go away?',
          'Only the 50 cents of ingredients. Wages and overhead are paid whether or not cookies are baked.',
        ),
      ],
      watch: [
        'Some learners will trust the report. Ask them what they would need to see to change their mind.',
        'The level has four menus. Encourage learners to try more than one, and to compare profit.',
      ],
      mistakes: [
        "As the report says (no cookies): the oven's best product per minute is gone, and the wages and overhead stay the same.",
        'Dropping cakes: every order gets baked and the oven has time to spare. The market, not the oven, becomes the constraint.',
      ],
      debrief: [
        ask('The report said cookies lose money. What did dropping them save, and what did it cost?', 'Saved: 50 cents each. Cost: the $1.50 each one brought in.'),
        say(
          'With cookies back the bakery made ${profit} a shift instead of ${profitBefore}. The wages and overhead the report spread onto each cookie get paid whether or not cookies are baked. Judge a product by the throughput it adds per minute of the constraint, not by a cost report.',
        ),
        ask('When the oven has time to spare, does a low earner still help?', 'Yes, as long as it earns more than its ingredients. That is what the no-cakes menu shows.'),
        tip('Be even-handed. Cost reports are useful for other jobs. The point is that spreading fixed costs can make a decision about a scarce resource look different from what it is.'),
      ],
      answer: { menu: 'all' },
    },
    closing(6, 8, [
      say(
        'Three things to take away. Rank products by what they earn per minute of the constraint. Judge decisions by throughput, inventory, and operating expense, not by a cost spread over each item. And when the constraint can make everything, the market becomes the constraint.',
      ),
      act('Write the ranking on the board: cookies, cupcakes, cakes, with their dollars per oven minute.'),
    ]),
  ],
  short: [
    'Skip 6.2. Its idea is in 6.1, with a third product.',
    'Cut the three-word opening to one sentence each, and let 6.1 carry the sums.',
  ],
  extend: [
    'Ask learners to pick something they spend an hour on each week and work out what it earns per hour of their scarcest resource.',
    "Ask what the bakery's constraint would be if it made only cookies: the oven, or the customers?",
  ],
}
