import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier9: Session = {
  tier: 9,
  summary:
    "Forecasts and demand, at the bakery's new shop counter. Learners see that a forecast can be right on average and wrong every day, make what customers take instead of what the forecast says, size a shelf for the busiest stretch of the day, and forecast the total while deciding the details late.",
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'This session uses a shop counter, not a factory line. Tell learners so: the ideas carry over, but the picture changes.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 8,
      steps: [
        say(
          'Until now, every order that came in was one we had to make. Now customers walk into a shop, and nobody knows how many will come. So the bakery guesses, and bakes to the guess. That guess is called a forecast.',
        ),
        ask(
          'Have you ever ordered food for a party, or planned a budget, by guessing? How close were you, and what happened when you were wrong?',
          'Listen for leftovers when it was too much and running out when it was too little. Both are costs.',
        ),
        say(
          'Our forecast will be a good one: right on average. This session asks whether that is good enough. The shop counter is different from the factory line, but the ideas carry over.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier9-forecast',
      minutes: 14,
      play: 5,
      idea: 'A forecast can be right on average and wrong every day. Leftovers on a slow day cannot be sold on a busy one.',
      setup: [
        say(
          'The bakery has opened a shop. It opens at 2:00, and customers come in until the end of the shift at 8:00, each wanting one cupcake. Cupcakes are only fresh for a day, so whatever is left at closing is thrown out. Last month, 120 customers came in on an average day, so every morning the bakery bakes 120: the forecast. Watch today.',
        ),
        ask(
          'Over the next 10 days, the bakery bakes 120 every day, and about 1,200 customers come in altogether, just as the forecast says. What will happen: sells about 1,200 and throws out hardly any, throws some out but never runs out, or both throws some out and turns customers away?',
          'Ask for a show of hands before anyone plays.',
        ),
      ],
      watch: [
        'The result is ten days at once, in a chart. Learners can also watch any single day. Ask them to look at the days, not just the total.',
      ],
      mistakes: [
        'Sells about 1,200 and throws out hardly any: the misses never cancel out, because a cupcake left over on a slow day cannot be sold on a busy one.',
        'Throws some out but never runs out: on the busy days more than 120 customers come in, and once the cupcakes are gone the rest leave with nothing.',
      ],
      debrief: [
        act('Show the ten days on the TV. Point at a slow day, then a busy day.'),
        ask('Over the ten days, how many customers came, and how many were sold a cupcake?', '{customers} came, and only {sold} were sold.'),
        ask('Where did the difference go?', 'On {slowDays} slow days it threw out {thrownOut} in all, and on {busyDays} busy days it turned {turnedAway} customers away.'),
        say(
          'A forecast is always wrong about any one day. A plan that just follows it loses both ways: leftovers when it is too high, lost customers when it is too low.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier9-bake-what-sells',
      minutes: 14,
      play: 5,
      idea: 'Make what customers take, not what the forecast says.',
      setup: [
        say(
          'Anywhere from 70 to 170 customers come into the shop each day, and nobody knows how many until the day is over. The bakery bakes 120 every morning, the forecast. Today {customersBefore} customers came in. The oven bakes about a cupcake a minute, and customers come in more slowly than that, even on the busiest day.',
        ),
        ask(
          'How should the bakery decide how many cupcakes to bake?',
          'Listen for: bake more, bake fewer, or bake as they sell. Ask what each one would do on a slow day and on a busy day.',
        ),
      ],
      watch: [
        'There are two bars: no customers turned away, and few thrown out. Learners can meet the first by baking a lot and miss the second.',
      ],
      mistakes: [
        'Baking the forecast: it runs out on busy days and throws cupcakes out on slow ones.',
        'Baking enough for the busiest day: every customer is served, but on other days a lot is thrown out.',
        'Baking fewer, to avoid waste: hardly any waste, but a lot of customers turned away.',
      ],
      debrief: [
        ask('Baking one cupcake for each one sold worked best. Why does it work, and what must be true for it to work?', 'It follows what customers actually buy. It works because the oven bakes faster than customers come in.'),
        say(
          'Keeping 10 on the shelf and baking one more for each one sold turned {turnedAway} customers away today, and only the {thrownOut} left at closing were thrown out. The bakery did not need to guess how busy the day would be. Make what customers take, not what the forecast says.',
        ),
        ask('Can you see a buffer and a rope in this?', 'The shelf is the buffer. Baking one more for each one sold is the rope.'),
      ],
      answer: { plan: 'replace' },
    },
    {
      kind: 'play',
      levelId: 'tier9-lunch-rush',
      minutes: 14,
      play: 5,
      idea: 'Size the shelf for the busiest stretch of the day, and no bigger. It protects sales the way a buffer protects the constraint.',
      setup: [
        say(
          'The shop keeps 10 cupcakes on the shelf and bakes one more for each one sold. Now a lunch crowd has found it: between 5:00 and 6:00, 4 of every 10 of the day\'s customers come in, faster than the oven\'s cupcake a minute on a busy day. Today {customersBefore} customers came in: the shop sold {soldBefore}, turned {turnedAwayBefore} away, and threw out {thrownOutBefore}.',
        ),
        ask('How many cupcakes should the shop keep on the shelf?', 'Take a few numbers. Ask what each would do at lunch.'),
      ],
      watch: [
        'Four choices, including no shelf at all. Ask learners to say what the shelf is for before they choose.',
      ],
      mistakes: [
        '10 on the shelf: plenty until the lunch rush, then customers come in faster than the oven can bake, and the shelf runs dry.',
        '100 on the shelf: never runs out, but all 100 left at closing are thrown out.',
        'No shelf, baking 170 in the morning: back to guessing. It is a good day on a busy day and wasteful on a slow one.',
      ],
      debrief: [
        ask('How did the shelf get the shop through the rush?', 'It held enough to serve customers while the oven caught up.'),
        say(
          'A shelf of 40 carried the shop through the rush while the oven caught up, so nobody was turned away, and {thrownOut} were left at closing. Size the shelf for the busiest stretch of the day, and no bigger. It protects the sales the way a buffer protects the constraint.',
        ),
        ask("Is this the same question as 'how long should the rope be' in level 3.2?", 'Yes: size it to cover the hiccup, and no more.'),
      ],
      answer: { shelf: 'forty' },
    },
    {
      kind: 'play',
      levelId: 'tier9-frost-to-order',
      minutes: 16,
      play: 6,
      idea: 'Forecast the total, and decide the details as late as you can.',
      setup: [
        say(
          'The shop sells three flavors now: vanilla, chocolate, and strawberry. The number of customers hardly changes, 110 to 130 a day, but what they want swings: some days nearly everyone wants chocolate, other days strawberry. Each morning the bakery bakes 120 and frosts 40 of each flavor. Today {customersBefore} customers came in: the shop threw out {thrownOutBefore} and turned {turnedAwayBefore} away.',
        ),
        ask(
          'How should the bakery frost its cupcakes? Which is easier to forecast: the total number of customers, or how many want each flavor?',
          'The total. Ask why: the ups and downs of three flavors partly cancel in the total.',
        ),
      ],
      watch: [
        'Five options. Ask learners to look for the one that never has to guess a flavor.',
      ],
      mistakes: [
        '40 of each flavor: about the right number, but not the right flavors.',
        '50 of each flavor: more of every flavor means more left over, and a day when everyone wants the same flavor still runs out.',
        "By last week's sales: last week's favorites are not today's.",
        'Keeping 10 of each on the shelf: three shelves to keep full, and 30 left to throw out.',
      ],
      debrief: [
        ask('The frost-to-order plan baked plain cupcakes. Why did that beat every plan that guessed flavors?', 'Every cupcake could become whatever flavor its customer asked for.'),
        say(
          'The number of customers hardly changes from day to day, but which flavor they want swings a lot. Baked plain, every cupcake could become any flavor, so the bakery only had to forecast the total: {thrownOut} thrown out and {turnedAway} turned away today. Forecast the total, and decide the details as late as you can.',
        ),
        ask('Where else can you put off the final choice, such as color, size, or destination, until you know what the customer wants?', 'Custom printing, paint mixed at the counter, a sandwich made to order.'),
      ],
      answer: { frosting: 'counter' },
    },
    closing(9, 8, [
      say(
        'Four things to take away. A forecast can be right on average and wrong every day. Make what customers take when you can. Size a shelf for the busiest stretch, and no bigger. And forecast the total, then decide the details late.',
      ),
      ask('Where does a forecast drive something you plan? Could you follow what actually happens instead?'),
      tip('If someone asks whether forecasts are useless, say no: they help with the total and with the long term. The lesson is about how much weight to put on them for a single day.'),
    ]),
  ],
  short: [
    'Skip 9.3. Its idea, sizing a cushion to the busiest stretch, is the buffer from Tier 3 again.',
    'Run 9.1 and 9.2 only, as a pair: the problem and the fix.',
  ],
  extend: [
    'Ask learners to bring an example of a forecast from their own work, and to say what a shelf and a rope would look like there.',
    'Ask learners to redraw the shop with a buffer (the shelf) and a rope (bake one for each sold), and label them.',
  ],
}
