import type { Term } from './types.ts'

// Key terms, in plain words, each with the tier where the game first brings it up. The game keeps to
// everyday words until a tier needs a name (spec section 5.5), so the guide does too.
export const glossary: Term[] = [
  {
    term: 'Constraint',
    tier: 0,
    meaning:
      'The one step that limits how much the whole system can produce. Work piles up in front of it, and the steps after it wait for work. Also called the bottleneck.',
  },
  {
    term: 'Work in process (WIP)',
    tier: 0,
    meaning: 'Everything that has been started but not yet shipped: the parts waiting in piles and the parts being worked on. The game calls it "In process".',
  },
  {
    term: 'Pile (queue)',
    tier: 0,
    meaning: 'The parts waiting in front of a station. The blocks above a station in the factory view are its pile.',
  },
  {
    term: 'Weakest link',
    tier: 0,
    meaning: 'A chain is only as strong as its weakest link. A factory can never ship faster than its slowest step works, however fast the others are.',
  },
  {
    term: 'Made and shipped',
    tier: 0,
    meaning: 'A station\'s "Made" count is what it has finished. "Shipped" is what left the end of the line. Lots of parts made and few shipped means work is piling up somewhere.',
  },
  {
    term: 'Five focusing steps',
    tier: 1,
    meaning: 'The order for improving a system: 1 Identify the constraint. 2 Exploit it. 3 Subordinate everything else to it. 4 Elevate it. 5 Go back to step 1, because the constraint has probably moved.',
  },
  {
    term: 'Exploit',
    tier: 1,
    meaning: 'Get the most out of the constraint with what you already have: never let it wait, never let it work on something that will be thrown away. It costs little or nothing.',
  },
  {
    term: 'Subordinate',
    tier: 1,
    meaning: 'Run everything else to support the constraint: work goes in at the constraint\'s pace, and other stations use their spare time to keep it supplied.',
  },
  {
    term: 'Elevate',
    tier: 1,
    meaning: 'Add capacity to the constraint: a faster tool, another machine, more hours. Do it after you exploit, because it costs money.',
  },
  {
    term: 'Mirage',
    tier: 1,
    meaning: 'An improvement that looks good but changes nothing the customer gets. Speeding up a station that is not the constraint is a mirage: the factory ships the same.',
  },
  {
    term: 'Floater',
    tier: 1,
    meaning: 'A person who covers for others, for example during lunch, so a station keeps running.',
  },
  {
    term: 'Variation',
    tier: 2,
    meaning: 'Times that differ from one job to the next, even when the average stays the same. In a line of dependent steps, variation takes output away and does not give it back.',
  },
  {
    term: 'Dependent steps',
    tier: 2,
    meaning: 'Steps where each one needs the work of the one before it. A slow turn upstream makes everything after it wait.',
  },
  {
    term: 'Slack',
    tier: 2,
    meaning: 'A little spare time at the constraint, so it can catch up after a slow streak. With none, every slow streak leaves a pile behind for good.',
  },
  {
    term: 'Steady',
    tier: 2,
    meaning: 'The share of the shift in which no station has a big pile waiting. A steady line has few surprises and short waits.',
  },
  {
    term: 'Drum',
    tier: 3,
    meaning: 'The constraint, seen as the one that sets the beat for the whole factory. Everyone else works to its pace.',
  },
  {
    term: 'Buffer',
    tier: 3,
    meaning: 'A small pile of work kept in front of the constraint so a hiccup upstream never leaves it waiting. Big enough to cover the hiccup, and no bigger.',
  },
  {
    term: 'Rope',
    tier: 3,
    meaning: 'The rule that lets new work into the factory only as fast as the constraint uses it. It is tied to the constraint, so work never goes in faster than the constraint can use it.',
  },
  {
    term: 'Healthy buffer',
    tier: 3,
    meaning:
      'A buffer with enough work in it to keep the constraint busy, but not so much that work floods the floor. The game colors the shift clock green when the buffer is healthy, red when it runs dry, and amber when it floods.',
  },
  {
    term: 'Jam',
    tier: 3,
    meaning: 'A short stop when a machine sticks. The buffer is there to ride out jams before the constraint.',
  },
  {
    term: 'Throughput',
    tier: 4,
    meaning: 'What a business ships and sells. Until Tier 6 the game counts it in units shipped; in Tier 6 it becomes money.',
  },
  {
    term: 'Lead time',
    tier: 4,
    meaning: 'How long an order takes from the moment it is released to the moment it ships. Big piles and big batches make it longer.',
  },
  {
    term: 'Changeover',
    tier: 4,
    meaning: 'The time a station spends switching from one product to another, such as cleaning a pot. It is time the station is not making anything.',
  },
  {
    term: 'Lot (process batch)',
    tier: 4,
    meaning: 'The number of items of one kind made in a row before switching. Bigger lots mean fewer changeovers but longer waits.',
  },
  {
    term: 'Transfer batch',
    tier: 4,
    meaning: 'The number of items moved to the next station at once. It does not have to equal the lot: you can make ten in a row and move them one at a time.',
  },
  {
    term: 'Policy constraint',
    tier: 5,
    meaning: 'A rule or habit that holds back output, such as "the big press prints posters only". Changing a policy can free capacity for nothing.',
  },
  {
    term: 'Market constraint',
    tier: 5,
    meaning: 'When the factory can make more than customers order, the constraint is the market. More capacity then buys nothing.',
  },
  {
    term: 'Next constraint',
    tier: 5,
    meaning: 'When you fix one constraint, another step becomes the slowest. Look for it before you spend on the first fix.',
  },
  {
    term: 'Protective capacity',
    tier: 5,
    meaning: 'The time a station that is not the constraint has to spare. It lets that station catch up after a jam. It is not waste, and selling it can cost output.',
  },
  {
    term: 'Throughput ($)',
    tier: 6,
    meaning: 'The money that comes in from sales, minus what was paid for the materials in what was sold.',
  },
  {
    term: 'Inventory ($)',
    tier: 6,
    meaning: 'The money tied up in work that has been paid for but not yet sold. The game values it at the cost of the ingredients.',
  },
  {
    term: 'Operating expense',
    tier: 6,
    meaning: 'The money spent to turn inventory into throughput: wages, rent, power. In the game it is the same whatever gets made.',
  },
  {
    term: 'Profit',
    tier: 6,
    meaning: 'Throughput minus operating expense.',
  },
  {
    term: 'Earnings per constraint minute',
    tier: 6,
    meaning: 'What one item earns divided by the minutes it takes at the constraint. It ranks products correctly when the constraint cannot make them all.',
  },
  {
    term: 'Product mix',
    tier: 6,
    meaning: 'How much of each product is made, or ordered. A change in the mix can change which step is the constraint.',
  },
  {
    term: 'Cost report',
    tier: 6,
    meaning: 'A report that spreads wages and overhead over each product. Dropping a product saves only the costs that actually go away, so the spread-out figure can point the wrong way.',
  },
  {
    term: 'Downtime',
    tier: 7,
    meaning: 'Time a machine is stopped, for a breakdown or a repair. At the constraint, each minute is lost for the whole factory.',
  },
  {
    term: 'Safety stock',
    tier: 7,
    meaning: 'Extra material kept on hand to ride out a late delivery. Enough for the longest delay you expect, and no more, since it is money sitting still.',
  },
  {
    term: 'Scrap and yield',
    tier: 7,
    meaning: 'Scrap is work thrown away because it is bad. Yield is the share that comes out good. Scrap found after the constraint has already used the constraint\'s time.',
  },
  {
    term: 'Priority',
    tier: 8,
    meaning: 'Which order a station works on first. Changing priorities at the constraint can mean changeovers, and every changeover is lost time.',
  },
  {
    term: 'Rush order',
    tier: 8,
    meaning: 'An order that jumps the queue. It changes the order of work, not how much work the constraint can do, so other orders wait longer.',
  },
  {
    term: 'Forecast',
    tier: 9,
    meaning: 'A guess about how much customers will want. It is usually close on average and wrong about any one day.',
  },
  {
    term: 'Lost sale',
    tier: 9,
    meaning: 'A customer who leaves without buying because the shelf was empty.',
  },
  {
    term: 'Waste',
    tier: 9,
    meaning: 'Goods thrown out unsold, such as cupcakes left at closing.',
  },
  {
    term: 'Replenish (make what customers take)',
    tier: 9,
    meaning: 'Keep some on the shelf and make one more for each one sold, so what is made follows what customers actually take. The shelf works like a buffer and each sale like a rope.',
  },
  {
    term: 'Decide the details late',
    tier: 9,
    meaning: 'Forecast the total, which swings less, and choose the flavor, size, or color as late as you can, once you know what the customer wants.',
  },
  {
    term: 'Overtime',
    tier: 10,
    meaning: 'Extra paid hours. They pay only at the constraint, where each hour is an hour for the whole factory.',
  },
  {
    term: 'Maintenance window',
    tier: 10,
    meaning: 'The time chosen for servicing a machine. For the constraint, choose a time it would be stopped anyway.',
  },
  {
    term: 'Rework',
    tier: 10,
    meaning: 'Sending work back to be made again. If it goes back through the constraint, it uses the constraint\'s time twice.',
  },
]
