import { choice, forTier, truth } from './make.ts'

// Tier 6, Product mix and profit: earnings per minute of the constraint, and the three measures.
export const tier6 = forTier(6, [
  choice(
    '6-1',
    'tier6-bake-what-pays',
    'An oven is the constraint. A cake earns $20 and needs 20 minutes of oven time. A cookie earns $1 and needs half a minute. Which earns more per minute of oven time?',
    'The cookie: $2 a minute, against $1 a minute for the cake',
    ['The cake: $20 against $1 for the cookie', 'They tie, at $1 a minute each', 'The cake: $1 a minute, against 50 cents a minute for the cookie'],
    'Rank products by what they earn per minute of the constraint, not per item. A cake earns $20 in 20 minutes, which is $1 a minute. A cookie earns $1 in half a minute, which is $2 a minute.',
  ),
  choice(
    '6-2',
    'tier6-rank-the-menu',
    "Three products compete for the constraint's time. A earns $40 and needs 8 minutes. B earns $30 and needs 3 minutes. C earns $12 and needs 4 minutes. In what order should the constraint make them if there is not time for all of them?",
    'B, then A, then C',
    ['A, then B, then C', 'B, then C, then A', 'C, then A, then B'],
    "Divide what each earns by its minutes at the constraint: B earns $10 a minute, A $5, and C $3. Give the constraint's time to the best earner per minute first, then the next best.",
  ),
  choice(
    '6-3',
    'tier6-cost-report',
    'A cost report spreads wages and rent over every product and shows that Product X loses money. X sells for $10 and its materials cost $4. Dropping X would not change wages or rent, and the factory has spare capacity. What would dropping X do to profit?',
    'Lower it, since X still adds $6 on each unit toward costs that do not go away',
    [
      'Raise it, because the cost report says X loses money on each unit sold',
      "Leave it unchanged, since the loss the report shows for X is only on paper",
      'Raise it, because the freed capacity could go to other products',
    ],
    "The wages and rent do not go away when X is dropped, so the cost report's loss is misleading. X adds $6 of throughput on every unit sold, and giving that up lowers profit.",
  ),
  choice(
    '6-4',
    'tier6-cost-report',
    'In throughput accounting, what is throughput?',
    'Sales minus the materials in what was sold',
    ['The number of units the factory makes in a day', 'The money tied up in goods that have not been sold', 'The money spent on wages, rent, power, and other running costs'],
    'Throughput is money coming in: sales less the materials in what was sold. Inventory is the money tied up in unsold goods, and operating expense is the money spent turning inventory into throughput.',
  ),
  choice(
    '6-5',
    'tier6-bake-what-pays',
    'In throughput accounting, how is profit worked out?',
    'Throughput minus operating expense',
    ['Throughput minus inventory', 'Inventory minus operating expense', 'Sales minus the cost of the units made'],
    'Throughput is the money coming in from sales, less materials. Operating expense is the money spent to turn inventory into throughput. What is left over is profit.',
  ),
  choice(
    '6-6',
    'tier6-rank-the-menu',
    'The constraint cannot make everything customers want this week. It has made all that customers will buy of the best earner per minute. What should it do next?',
    'Give the remaining time to the next-best earner per minute, and so on down the list',
    [
      'Make a little of everything so that no customer is disappointed',
      'Switch to the product with the highest price per item',
      'Stop, because only the best earner matters',
    ],
    "Give each product as much of the constraint's time as customers will buy, best earner per minute first, then the next best, until the time runs out.",
  ),
  truth(
    '6-7',
    'tier6-bake-what-pays',
    "The product with the highest price per item should get the constraint's time first.",
    false,
    "What counts is what each product earns per minute of the constraint, not per item. A cheaper item that needs very little of the constraint's time can earn more per minute.",
  ),
  truth(
    '6-8',
    'tier6-cost-report',
    'When a product is dropped, the wages and rent that the cost report charged to it go away too.',
    false,
    'The wages and rent usually stay the same when a product is dropped, so they get spread over the products that are left. A cost report that charges them to each product can make a profitable product look like a loser.',
  ),
  truth(
    '6-9',
    'tier6-bake-what-pays',
    'Operating expense is the money spent to turn inventory into throughput, such as wages, rent, and power.',
    true,
    'Together with throughput and inventory, it is one of the three measures used to judge a decision: does it raise throughput, cut inventory, or cut operating expense?',
  ),
])
