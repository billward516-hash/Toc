import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier4: Session = {
  tier: 4,
  summary:
    'Batch size and flow, in a candle workshop where switching scents means cleaning a pot. Learners choose how many candles of one scent to make in a row, where to put a quick-change crew, and how many to move at a time. Tier 4 stands alone once Tier 3 is done.',
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'This is the first session that says throughput. It is introduced in level 4.1, and the game keeps saying shipped until Tier 6 puts dollars on it.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 6,
      steps: [
        say(
          'Tier 4 is a candle workshop. Orders come in, candles are melted, poured, labeled, and packed. Switching scents costs time. This session is about batch size: how many candles of one scent to make in a row, and how many to move at a time.',
        ),
        ask(
          'When you cook pancakes for a crowd, do you make a big stack and then serve, or serve as they come off the pan? What does each way cost?',
          'Big stack: fewer trips, but the first pancake waits. Serve as they come: the first is fast, but more effort. Both costs appear in the candle workshop.',
        ),
        say('One new word. Throughput is what a business ships and sells. We have said shipped so far. From here we will also say throughput.'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier4-lots',
      minutes: 16,
      play: 6,
      idea: 'At the constraint, bigger lots save changeover time, up to the point where waiting for the lot costs more.',
      setup: [
        say(
          'Welcome to the candle workshop. Orders come in one candle at a time, switching scents each time: an Orange blossom, then an Ocean breeze, about every four minutes. Melt is the slowest step, and every time it switches scents it spends about eight minutes cleaning the pot. The workshop ships {baseline} candles a shift. That is its throughput.',
        ),
        ask(
          'How many candles of one scent should come in together? What do you expect if the lot is very big?',
          "Listen for 'fewer cleanings' for bigger lots, and for someone to say the candles would wait. Ask them to hold both ideas.",
        ),
      ],
      watch: [
        'The goal has two bars: at least {target} candles shipped, and an average wait of no more than {maxLead} minutes from order to shipping. Some learners will meet one and miss the other.',
        'Have learners try every lot size. The Plans you have tried table shows shipped and the wait for each.',
      ],
      mistakes: [
        'One at a time: Melt cleans its pot before almost every candle, about {changeoverBefore} minutes of changeovers across the line, and only {baseline} candles ship.',
        'Lots of 20: fewest changeovers and the most candles, but every candle waits for the other 19 in its lot, and the wait goes past the limit.',
      ],
      debrief: [
        act('Read down the lot sizes from smallest to largest, comparing shipped with the wait.'),
        ask('Lots of 20 ship about as many candles as lots of 10, yet they earn fewer stars. Why?', 'Each candle waits for its whole lot. The wait passes the limit of {maxLead} minutes.'),
        say(
          'The best lot shipped {shipped} against {baseline}, each candle about {lead} minutes from order to shipping. At the constraint, every changeover is time the whole workshop loses, so bigger lots pay off, up to a point. Past that point they only add waiting and inventory.',
        ),
        ask(
          'Where do you do work in batches: emails, laundry, invoices? What is the changeover that makes a batch worth it, and what waits while you fill it?',
          'Push for both halves: the cost of switching, and the wait.',
        ),
      ],
      answer: { lot: '10' },
    },
    {
      kind: 'play',
      levelId: 'tier4-quick-change',
      minutes: 12,
      play: 4,
      idea: 'Cut the changeover where it costs output: at the constraint. Quick changeovers anywhere else are a mirage.',
      setup: [
        say(
          'Orders now come in lots of 5 candles of one scent. That is still more changeovers than Melt can afford: the workshop ships {baseline} a shift. A quick-change crew can cut one station\'s changeovers to a quarter of the time, by heating the next pot early and laying out the tools.',
        ),
        ask('Where should the crew work?', 'Remind them of level 1.1: whose time do changeovers cost?'),
      ],
      watch: [
        'With three choices this goes quickly. The value is in the discussion afterward, not in the search.',
      ],
      mistakes: [
        'Pour or Label: their changeovers get quicker, but they already had time to spare, and the workshop still ships {baseline}.',
      ],
      debrief: [
        ask('The same crew in three places. Why did it help at one and not the other two?'),
        say(
          'Time saved at the constraint is time gained by the whole workshop: {shipped} shipped instead of {baseline}, each candle about {lead} minutes from order to shipping. Time saved at a station that is not the constraint is a mirage, the same lesson as the tool in Tier 1.',
        ),
        ask('With quicker changeovers at Melt, what becomes affordable that was not before?', 'Smaller lots: shorter waits and less inventory.'),
      ],
      answer: { crew: 'melt' },
    },
    {
      kind: 'play',
      levelId: 'tier4-carts',
      minutes: 14,
      play: 4,
      idea: 'The batch you move does not have to be the batch you make.',
      setup: [
        say(
          'Orders now come in lots of 10, so Melt keeps up. But every station waits until a whole lot of 10 is done before carrying it to the next one. The workshop ships {baseline} a shift, and a candle takes about {leadBefore} minutes from order to shipping. Watch the carts.',
        ),
        ask(
          'What if every candle went on to the next station as soon as it was done? What would that cost, and what would it save?',
          'The cost is extra trips. What it saves is waiting. Ask who does the carrying and whether they are busy.',
        ),
      ],
      watch: [
        'The carts show on the floor between stations. Ask learners how long the first candle of a lot waits.',
      ],
      mistakes: [
        'Carts of 10: every candle waits for its whole lot at every station, and the last lots are still in carts when the shift ends.',
        'Carts of 5: better, but candles still sit in carts while their neighbors are finished.',
      ],
      debrief: [
        ask('Melt still makes ten of a scent in a row. Why did moving candles one at a time not bring the changeovers back?'),
        say(
          'Making and moving are separate choices. Melt keeps its big lot, so changeovers stay rare, and each candle moves on as soon as it is done: about {lead} minutes from order to shipping instead of {leadBefore}, and {shipped} shipped instead of {baseline}.',
        ),
        ask('When are extra trips a bad idea?', 'When the carrier is itself the constraint, or when trips are costly. Here the stations after Melt have time to spare.'),
      ],
      answer: { cart: '1' },
    },
    closing(4, 8, [
      say(
        'Three things to take away. Bigger lots at the constraint save changeover time, but only up to a point. Changeover savings only count at the constraint. And the batch you move can be smaller than the batch you make.',
      ),
      tip('Ask learners to find one batch in their own work and name what it costs to switch, and what waits.'),
    ]),
  ],
  short: [
    'Skip 4.2. Its idea, that time saved off the constraint is a mirage, is the tool in level 1.1 again.',
    'Run 4.3 as a group: vote on the cart size, run it on the TV, and discuss.',
  ],
  extend: [
    'Go back to 4.1 and use the Plans you have tried table to find the lot size that earns all three stars.',
    'Ask learners to draw a timeline of one lot of ten candles moving through the workshop, with and without small carts.',
  ],
}
