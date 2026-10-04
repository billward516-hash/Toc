import { choice, forTier, truth } from './make.ts'

// Tier 9, Forecasts and demand: forecasts that are always wrong, and ways to cope.
export const tier9 = forTier(9, [
  choice(
    '9-1',
    'tier9-forecast',
    'A bakery forecasts 100 cupcakes a day. Over a month the average is exactly 100, but daily sales range from 60 to 140. If it bakes 100 every day, what happens?',
    'It runs out on busy days and has leftovers on slow days',
    [
      'It ends up with the right amount, because the forecast is right on average',
      'It runs out on busy days, but slow days leave no waste',
      'It has leftovers on slow days, but busy days are all covered',
    ],
    'A forecast can be right on average and wrong almost every day. Leftovers on a slow day cannot be sold on a busy one.',
  ),
  choice(
    '9-2',
    'tier9-bake-what-sells',
    'Which approach makes what customers actually take, instead of what the forecast says?',
    'Keep a small stock on the shelf and make one more each time one sells',
    ['Bake the full forecast each morning, so the shelf starts full', 'Bake extra to be safe, then mark down what is left', 'Stop baking whenever sales fall below the forecast'],
    'Replacing what sells keeps what you make close to what customers take. The shelf works like a buffer, and each sale works like a rope.',
  ),
  choice(
    '9-3',
    'tier9-lunch-rush',
    'A shop sells most of its sandwiches during a one-hour lunch rush. How much should it keep on the shelf for the rush?',
    'Enough for the busiest stretch, and no more',
    ["Enough for the average hour's sales", 'Enough for the quietest hour, since most hours are quiet', 'Enough to fill the shelf, whatever the sales'],
    'The shelf protects sales the way a buffer protects the constraint, so it must cover the busiest stretch. A bigger shelf only adds waste, and a smaller one loses sales.',
  ),
  choice(
    '9-4',
    'tier9-frost-to-order',
    'A bakery can forecast its total cupcake sales fairly well, but not how many of each flavor will sell. How can it cut leftovers?',
    'Bake plain cupcakes to the total forecast and add the flavor when customers choose',
    [
      'Bake each flavor to its own forecast, with some extra of each to be safe',
      'Drop the flavors that are hard to forecast, and keep only the ones that sell steadily',
      "Make each flavor's forecast more detailed, so that it is accurate enough to bake from",
    ],
    'Forecast the total, which swings less, and decide the details as late as you can. Waiting to add the flavor until the customer chooses means nobody has to forecast each flavor.',
  ),
  choice(
    '9-5',
    'tier9-frost-to-order',
    'A shop forecasts 700 units for next week, and 140 for each of the five days. Which statement is most likely true?',
    "The weekly forecast will usually be closer, in percent, than a single day's forecast",
    [
      "Each day's forecast will usually be closer, in percent, than the forecast for the whole week",
      'The weekly and daily forecasts will be off by about the same percent as each other',
      'The daily forecasts are usually right whenever the weekly forecast is right',
    ],
    'Highs and lows on separate days partly cancel out in the total, so the total swings less than a single day. That is why it is wiser to forecast the total and decide the details later.',
  ),
  truth(
    '9-6',
    'tier9-forecast',
    'A forecast is almost always wrong about any single day, even when it is right on average.',
    true,
    'Real days swing above and below the average. A plan built on the average alone leaves stock unsold on slow days and sales lost on busy ones.',
  ),
  truth(
    '9-7',
    'tier9-lunch-rush',
    "To avoid losing sales in a lunch rush, a shop should stock the shelf for the whole day's sales before it opens.",
    false,
    'Stock on a shelf is money tied up, and what is not sold may be thrown away. Size the shelf for the busiest stretch, and no bigger.',
  ),
  truth(
    '9-8',
    'tier9-bake-what-sells',
    'A shop that bakes one more each time one sells will usually end the day with fewer leftovers than one that bakes the full forecast in the morning.',
    true,
    'Each sale triggers one more to be made, so production follows real demand, while a morning forecast can only guess at it. On slow days the forecast baker is left with unsold stock.',
  ),
])
