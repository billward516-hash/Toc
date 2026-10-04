import { choice, forTier, truth } from './make.ts'

// Tier 8, Changing orders: a shifting mix, priority changes, and rush orders.
export const tier8 = forTier(8, [
  choice(
    '8-1',
    'tier8-mix-shifts',
    'Painting takes 4 minutes per item for every product. Assembly takes 2.5 minutes on a Classic item and 6 minutes on a Deluxe item. A big order of Deluxe items arrives. While those items are flowing, where is the constraint likely to be?',
    'At Assembly, because the change in mix moved it',
    ['Still at Painting, because the constraint does not move', 'At the first station, because new orders arrive there', 'Nowhere, because a factory with two products has no constraint'],
    'A change in the product mix can move the constraint. Painting takes 4 minutes on every item, but Deluxe items take Assembly 6 minutes, so while they flow Assembly is the slowest step.',
  ),
  choice(
    '8-2',
    'tier8-new-rope',
    'After the product mix changes, the constraint has moved from Painting to Assembly, but the rope is still tied to Painting. What should the team do?',
    'Tie the rope to Assembly, the new constraint',
    ['Leave it, since Painting was the constraint for years', 'Remove the rope altogether so that work flows freely through the line', 'Tie the rope to the first station instead, where new work starts'],
    'When the mix moves the constraint, the rope has to move with it. Tied to the old constraint, it lets work in faster than Assembly can finish it, so piles grow and orders wait.',
  ),
  choice(
    '8-3',
    'tier8-spread-deluxe',
    'A station takes 2 minutes on a normal item, and a normal item reaches it every 6 minutes through an 8-hour day. Today it must also make 40 special items, all on hand from the start, that take 6 minutes each and must be finished by the end of the day. When should the 40 be made, so that the normal items wait as little as possible?',
    'Spread evenly through the whole day, between the normal items',
    ['All at once at the start of the day, ahead of the normal items', 'All at the end of the day, after the normal items', 'In small groups, but all of them in the first half, so the rest of the day runs clear'],
    'Spread hard work through the day so that it never swamps one station. The 40 special items need 240 minutes between them. Made as one block at the start, they hold up every normal item behind them. Crowded into the first half of the day, they leave the station short of time, and a pile builds. Saved for the end, there is not enough time left to finish them.',
  ),
  choice(
    '8-4',
    'tier8-hot-list',
    "Sales phones the constraint's operator every half hour with a new 'hot' product, and each switch costs a 10-minute changeover. What is the likely effect of switching every time?",
    'The constraint loses time to changeovers, so the factory ships less',
    ['The factory ships more, because hot orders go out sooner and customers are happier', 'There is no effect, because the other stations make up the lost time', 'Costs fall, because the hot orders are made right away'],
    'Changing priorities at the constraint costs output. Every switch is a changeover, and the minutes the constraint loses are lost for the whole factory. Set the order once and let the constraint keep working.',
  ),
  choice(
    '8-5',
    'tier8-rush-order',
    'A rush order of 12 items jumps the queue at a constraint that is already busy all day. What does the rush order change?',
    'The order the work is done in, but not how much the constraint can make in total',
    [
      'How much the constraint can make in a day, because rush orders speed it up',
      'No change, since a rush order is just another order',
      'Which station is the constraint, because rush orders move it to the front',
    ],
    'A rush order changes whose order is made first, not how much the constraint can do. The rush customer gets theirs sooner, and the other orders wait longer by the same amount.',
  ),
  truth(
    '8-6',
    'tier8-mix-shifts',
    'A change in the mix of products can move the constraint to a different step.',
    true,
    'Each product loads the stations differently. When the mix changes, a different station can become the slowest.',
  ),
  truth(
    '8-7',
    'tier8-hot-list',
    'Changing priorities at the constraint more often usually helps the factory ship more.',
    false,
    "Each change can mean a changeover or lost momentum at the constraint, and the constraint's lost time is lost for the whole factory.",
  ),
  truth(
    '8-8',
    'tier8-rush-order',
    'A rush order does not give the constraint any more time: it changes whose order is made first, and the orders it jumps ahead of wait longer.',
    true,
    'The constraint can make only so much in a day. A rush order moves one customer to the front, and the orders it jumps ahead of must wait.',
  ),
])
