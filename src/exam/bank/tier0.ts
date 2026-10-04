import { choice, forTier, truth } from './make.ts'

// Tier 0, Reading the factory: finding the constraint, and why busy is not the same as productive.
export const tier0 = forTier(0, [
  choice(
    '0-1',
    'tier0-weakest-link',
    'A line has four stations in a row. Each part takes 3 minutes at Cut, 5 at Mold, 4 at Paint, and 2 at Box. Which station is the constraint?',
    'Mold, the second station',
    ['Cut, the first station', 'Paint, the third station', 'Box, the last station'],
    'The constraint is the step that limits what the whole line can finish. Here that is Mold, at 5 minutes a part, the slowest of the four. Nothing can leave the line faster than Mold works.',
  ),
  choice(
    '0-2',
    'tier0-pileup',
    'On the floor of a running factory, a big pile of parts waits in front of one station, and the stations after it keep standing idle with nothing to work on. What does this most likely show?',
    'The station with the pile is the constraint, because the stations after it wait on it.',
    [
      'The stations after the pile are the constraint, because they are the ones standing idle.',
      'The first station in the line is the constraint, because that is where the work starts.',
      'The pile is just ordinary ups and downs and says little about the line.',
    ],
    'Work piles up in front of the slowest step, and the steps after it can only work as fast as it passes parts on. A pile with idle stations behind it points at the constraint.',
  ),
  truth(
    '0-3',
    'tier0-weakest-link',
    'Over a long stretch, a factory cannot ship more than its slowest step can make.',
    true,
    'Every part has to pass through every step, so the slowest step sets the limit, however fast the others are. That is the weakest-link idea: a chain is only as strong as its weakest link.',
  ),
  truth(
    '0-4',
    'tier0-busy',
    'A station that is busy all day must be the constraint.',
    false,
    'A fast station can be kept busy making parts the next station cannot use yet, which only builds a pile. Busy is not the same as productive. The constraint is the step the whole line waits for.',
  ),
  choice(
    '0-5',
    'tier0-weakest-link',
    'Five stations in a row can finish 12, 20, 8, 16, and 14 parts an hour. Parts are always available. What is the most this line can ship in an hour?',
    '8 parts',
    ['12 parts', '14 parts', '20 parts'],
    'The line can ship no more than its slowest station can finish, which is 8 an hour. The average of the five is 14, but an average hides this: parts pile up in front of the 8-an-hour station, and the stations after it can only work on what it passes on.',
  ),
  truth(
    '0-6',
    'tier0-weakest-link',
    'A small pile that appears in front of a station and soon disappears shows that the station is the constraint.',
    false,
    'Piles that come and go are just variation in how long jobs take. The constraint is the station whose pile keeps growing, because it cannot keep up with what arrives.',
  ),
  choice(
    '0-7',
    'tier0-busy',
    'Which description best fits the constraint of a system?',
    'The one step that limits what the whole system can produce',
    ['The most expensive machine, since it costs the most', 'The machine that breaks down more often than the others', 'The station with the most people working at it all day'],
    'The constraint is defined by what it does to output, not by its cost, its reliability, or its staffing. A costly, crowded, or unreliable station can still be fast enough to keep up.',
  ),
  choice(
    '0-8',
    'tier0-pileup',
    'At a coffee shop, the cashier takes orders quickly and customers crowd the pickup counter, waiting for drinks. Orders pile up at the espresso machine, which never stops. Where is the constraint?',
    'The espresso machine',
    ['The cashier who takes the orders', 'The pickup counter where drinks wait', 'Nowhere: a coffee shop is not a factory, so it has no constraint'],
    'Orders wait in front of the espresso machine, and the people after it wait for it to finish, so it sets the pace for everyone. The same pattern appears in any process, not only in factories.',
  ),
])
