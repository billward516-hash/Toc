import { choice, forTier, truth } from './make.ts'

// Tier 4, Batches and flow: lots, changeovers, and the size of the batch you move.
export const tier4 = forTier(4, [
  choice(
    '4-1',
    'tier4-lots',
    "A candle workshop's constraint spends 10 minutes cleaning its pot every time it switches color. What does making bigger lots of each color at the constraint do?",
    'It saves changeover time at the constraint, so more candles ship, up to a point',
    [
      'It lowers output, because each candle has to wait longer',
      'It makes little difference, because each changeover takes just as long, however big the lot',
      'It tends to save the same changeover time at each station, so the whole workshop speeds up',
    ],
    'Each changeover is time the constraint is not making candles, and that time is lost for the whole workshop. Bigger lots mean fewer changeovers. Past some size, though, waiting for a lot to finish costs more than the changeovers it saves.',
  ),
  choice(
    '4-2',
    'tier4-lots',
    'A station loses 12 minutes every time it switches products. If it makes 6 items between switches instead of 3, what happens to the switching time per item?',
    'It is cut in half',
    ['It stays the same', 'It doubles', 'It falls to zero'],
    'With a lot of 3, each item carries 12 ÷ 3 = 4 minutes of changeover. With a lot of 6, each carries 12 ÷ 6 = 2 minutes. Bigger lots spread the changeover over more items.',
  ),
  choice(
    '4-3',
    'tier4-quick-change',
    'A workshop can pay to make changeovers faster at only one station. The station with the longest changeover is not the constraint. Where does that pay off in extra output?',
    'At the constraint, where the time saved becomes more output',
    [
      'At the station with the longest changeover, since it has the most time to save',
      'At the first station, so that work starts sooner and the line fills up quickly',
      'At the last station, so that finished orders reach the customer sooner',
    ],
    'Changeover time costs output only at the constraint. A quicker changeover at a station with time to spare saves time the line was not short of: another mirage.',
  ),
  choice(
    '4-4',
    'tier4-carts',
    'A station makes parts in lots of 20, and the next station sits idle, waiting. How can the wait be shortened without changing the lot size at the first station?',
    'Move finished parts on in small loads as they come off the machine, not all at once',
    ["Make the next station's lot bigger so that it has plenty to work on", 'Hold the parts until all 20 are done, then move them together', 'Make the first station work faster than the constraint'],
    'The batch you move does not have to be the batch you make. Moving parts in small loads lets the next station start earlier, which cuts waiting and the work sitting on the floor.',
  ),
  choice(
    '4-5',
    'tier4-carts',
    'What is the difference between a process batch and a transfer batch?',
    'A process batch is how many you make in a row, and a transfer batch is how many you move at once',
    [
      'A process batch is moved by hand, while a transfer batch is moved by a machine or cart',
      'A process batch is used at the constraint, while a transfer batch is used at the other stations',
      'They are two names for the same thing: the lot size',
    ],
    'The two do not have to match. You can make ten in a row to save changeovers and still move them one at a time, so the next station is not kept waiting.',
  ),
  choice(
    '4-6',
    'tier4-lots',
    'Why do bigger lots stop paying off at some point?',
    'Other orders wait for the whole lot, so orders take longer and work piles up',
    [
      'Changeovers get longer the bigger the lot is, until they cost more than they save',
      'Bigger lots mean more changeovers, and each one takes time away from making things',
      'Bigger lots lower the quality of the product, so more of it is scrapped',
    ],
    'Each extra item in a lot saves a little changeover time, but every other order waiting for that station must wait for the whole lot to finish. Past a point, the waiting costs more than the changeovers it saves.',
  ),
  truth(
    '4-7',
    'tier4-carts',
    'You can make parts in large lots and still move them to the next station in small loads.',
    true,
    'How many you make in a row and how many you move at once are two separate choices. Moving small loads gets parts to the next station sooner.',
  ),
  truth(
    '4-8',
    'tier4-quick-change',
    "Cutting the changeover time at a station that already has time to spare raises the factory's output.",
    false,
    'That station already had time to spare, and the constraint still sets the pace, so the factory ships the same. Speed-ups anywhere but the constraint are a mirage.',
  ),
  truth(
    '4-9',
    'tier4-lots',
    'At the constraint, every minute spent on a changeover is a minute the whole factory loses.',
    true,
    'The constraint decides how much the factory ships, so time it spends switching instead of making cannot be made up anywhere else.',
  ),
])
