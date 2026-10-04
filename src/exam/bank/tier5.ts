import { choice, forTier, truth } from './make.ts'

// Tier 5, More capacity, better rules: rules that constrain, the next constraint, and spare time.
export const tier5 = forTier(5, [
  choice(
    '5-1',
    'tier5-house-rules',
    "A repair shop's constraint is a machine that only the senior technician is allowed to run, even though two other trained people are free. What is the best first step to get more output?",
    'Let the other trained people run the machine',
    ['Buy a second machine to run alongside the first', 'Hire another senior technician, so that the rule can stay as it is', 'Speed up the stations that come after the machine'],
    'Some constraints are rules, not machines. Lifting a rule costs nothing, so exploit before you elevate: look for a rule or habit that holds the constraint back before you spend money.',
  ),
  choice(
    '5-2',
    'tier5-next-constraint',
    'A factory doubles the speed of its constraint, but output rises by much less than double. What is the most likely reason?',
    'Another step has become the slowest and now limits output',
    ['The old constraint is still the slowest step', 'Speeding up a constraint can raise output only a little', 'The faster station spoils more of the parts it makes'],
    'There is always a next constraint. When you speed up one step, the limit moves to the next-slowest step, and the gain stops there.',
  ),
  choice(
    '5-3',
    'tier5-next-constraint',
    "A company plans to spend $50,000 to double its constraint's capacity. What should it find out first?",
    'Which step becomes the constraint next, and how much more could ship by then',
    [
      'Whether the old machine could be sold for a good price, and what the new one would cost to run',
      'How many hours the old machine was run during the whole of last year',
      'Whether the other stations could be slowed down to match the new machine',
    ],
    'The gain stops when the next step becomes the limit. If that is close, most of the money buys nothing. Look for the next constraint before you spend.',
  ),
  choice(
    '5-4',
    'tier5-old-habits',
    "Years ago Machine A was the constraint, so the shop made a rule: 'Keep Machine A running every minute.' After an upgrade, Machine C is the constraint. Machine A is the first machine in the line, and Machine C comes later. What is the rule likely doing now?",
    'Making more parts than Machine C can use, so work piles up in front of it',
    ['Raising output, because Machine A is busier than ever', 'Shortening the wait for orders, because Machine A finishes them sooner', 'No effect, because a rule cannot affect machines'],
    'A rule built around an old constraint can become the new one. Keeping Machine A busy now only makes parts that Machine C cannot use yet, so piles grow and orders wait longer. Review old rules whenever the constraint moves.',
  ),
  choice(
    '5-5',
    'tier5-balance-flow',
    'Station B feeds the constraint and is idle about 20% of the time. A manager plans to cut its staff to save money. What is the main risk?',
    'Its spare time lets it catch up after trouble, so cutting it can starve the constraint',
    [
      'It could start working faster than the constraint and fill the line with unfinished parts',
      'There is no risk, because idle time at a station is waste that should be removed',
      'The constraint itself may slow down to match the smaller crew at Station B',
    ],
    'Spare time at a station that is not the constraint is protective capacity. It lets the station catch up after a jam so the constraint never waits. Taking it away can cost output.',
  ),
  choice(
    '5-6',
    'tier5-balance-flow',
    'What is meant by balancing the flow instead of balancing the capacity?',
    "Letting work move at the constraint's pace, with spare capacity at the other stations",
    [
      'Giving each station the same capacity, so that none is faster than another',
      'Keeping each station busy all of the time, so that no capacity is wasted',
      "Raising the constraint's capacity until it matches the fastest station",
    ],
    "A line with equal capacity everywhere has no protection, because every slow stretch costs output. Better to let work flow at the constraint's pace and keep some spare capacity elsewhere.",
  ),
  choice(
    '5-7',
    'tier5-next-constraint',
    'A factory could make far more than its customers order, and orders have been flat for months. Which statement is correct?',
    'The constraint is the market, so more capacity would buy nothing until demand grows',
    [
      'The constraint is the slowest machine, so it should be sped up as soon as possible to raise output',
      'Adding capacity at the slowest machine will raise sales',
      'The factory has no constraint at all',
    ],
    'When customers order less than the factory can make, demand is the constraint. Every system has one: sometimes it is inside the factory, and sometimes it is the market.',
  ),
  truth(
    '5-8',
    'tier5-house-rules',
    'Sometimes the constraint is a rule or a habit, not a machine.',
    true,
    "A policy such as 'only one person may approve orders' can limit output as much as a slow machine, and changing it often costs nothing.",
  ),
  truth(
    '5-9',
    'tier5-balance-flow',
    'A station that is not the constraint should have some idle time, so that it can catch up after trouble.',
    true,
    'That spare time is protective capacity: it lets the station catch up after a jam so the constraint keeps working. Removing it can cost output.',
  ),
  truth(
    '5-10',
    'tier5-house-rules',
    'When a factory needs more output, buying more capacity for the constraint should come before looking for free ways to get more from it.',
    false,
    'Exploit before you elevate. Free fixes, like lifting a rule or keeping the constraint from sitting idle, cost nothing and might be enough. Spend money only when they are not.',
  ),
])
