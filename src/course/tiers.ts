import type { TierInfo } from './types.ts'

// What learners are told about each tier: what they'll be able to do, what to think about afterward,
// and what comes next. The trainer's script uses the same words, so the room hears what the guide says.
export const tierInfo: TierInfo[] = [
  {
    tier: 0,
    objectives: [
      'read a factory floor: where work waits, and which stations wait for work',
      'find the constraint, the one step that decides how much the whole factory ships',
      'explain why a station that is always busy is not always a help',
    ],
    reflect: [
      "Think of a place where you've waited in a line, or a process at work or school that always seems backed up. What was everyone waiting for? How do you know that's the limit?",
    ],
    bridge: 'Next: what to do once you have found the constraint. That is the five focusing steps.',
  },
  {
    tier: 1,
    objectives: [
      'say the five focusing steps in order',
      'explain why speeding up anything but the constraint changes nothing',
      'show why an hour lost at the constraint is lost for the whole factory',
      'expect another step to become the slowest once the constraint is fixed',
    ],
    reflect: [
      'Pick a limit you deal with: time, a person, a machine, or a rule. Before spending money or effort to add capacity, what could you do to make better use of what you have?',
    ],
    bridge: 'Next: why a real line ships less than its averages promise. That is variation.',
  },
  {
    tier: 2,
    objectives: [
      'explain why a line with the same averages ships less on a real day',
      'explain why a fast turn is often wasted while a slow turn never is',
      'set the pace of new work so the constraint has a little slack',
    ],
    reflect: [
      'Where is your week planned to the last minute, with no slack? What happens when one thing runs long?',
    ],
    bridge: 'Next: protecting the constraint with a buffer, and tying the release of work to its pace.',
  },
  {
    tier: 3,
    objectives: [
      'describe the drum, the buffer, and the rope in plain words',
      'tie the rope to the constraint, and say what that changes: the work on the floor and the wait, not the output',
      'size a buffer to cover the hiccup it protects against, and no more',
      'use the buffer to tell which problems really cost output',
    ],
    reflect: [
      'Where could a rope keep your team from starting more work than the slowest person can finish? What would the buffer be?',
    ],
    bridge:
      'You now have the core. From here the course branches: batches (Tier 4), capacity and rules (Tier 5), product mix (Tier 6), and what happens when things go wrong (Tiers 7 to 10). Choose the next tier that fits your work.',
  },
  {
    tier: 4,
    objectives: [
      'explain why bigger batches save time at the constraint, and where they stop paying',
      'explain why the batch you move can be smaller than the batch you make',
      'put quick-change effort at the constraint, and say why it does not help elsewhere',
    ],
    reflect: [
      'Where do you save work up and do it in batches: email, laundry, orders, approvals? What waits while you save it up, and is there a real cost to switching?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 5,
    objectives: [
      'look for a rule that holds a machine back before buying more capacity',
      'expect a next constraint when one is fixed, and look for it before spending',
      'notice when a rule built around an old constraint has become the new one',
      'explain why idle time at a station that is not the constraint is protection, not waste',
    ],
    reflect: [
      'Is there a rule or a habit at work or school that made sense once but might be the limit now? How would you find out?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 6,
    objectives: [
      'work out what each product earns per minute of the constraint',
      'give the constraint\'s time to the product that earns the most per minute, then the next',
      'explain why a cost report can make a profitable product look like a loser',
      'use throughput, inventory, and operating expense to judge a decision',
    ],
    reflect: [
      'If you had one scarce resource, such as an hour a day, a machine, or a specialist, how would you decide what to spend it on: the price of each job, or what each earns per hour of that resource?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 7,
    objectives: [
      'explain why every minute the constraint is down is lost for good',
      'decide which of two broken things to fix first',
      'size a cushion of material for a late delivery, and say what the cushion costs',
      'say where to check for defects, and why before the constraint',
    ],
    reflect: [
      'What are the ways your constraint could lose time: breaking down, waiting for input, or working on something bad? What protects it against each one?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 8,
    objectives: [
      'expect the constraint to move when the mix of orders changes, and move the rope with it',
      'spread hard work through the day instead of stacking it at the end',
      'explain what constant changes of priority cost the constraint',
      'say what a rush order really changes, and what it costs everyone else',
    ],
    reflect: [
      'When did an urgent request last jump the queue at work or school? What did the work it pushed aside cost?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 9,
    objectives: [
      'explain why a forecast can be right on average and wrong every day',
      'make what customers take instead of what the forecast says, when you can',
      'size a shelf for the busiest stretch of the day, and no bigger',
      'forecast the total, and decide the details as late as you can',
    ],
    reflect: [
      'Where do you plan around a forecast: a schedule, stock, a budget? Could you follow what actually happens instead, or decide the details later?',
    ],
    bridge: 'Back to the map: the other tiers stand alone, so pick the one that fits your work.',
  },
  {
    tier: 10,
    objectives: [
      'cover the constraint first when someone is away',
      'put overtime and maintenance where they do not cost output',
      'keep rework from looping through the constraint',
      'spend the spare time of a station that is not the constraint to protect the constraint\'s work',
    ],
    reflect: [
      'Name an everyday problem at your work: someone away, overtime, maintenance, or rework. Where is the constraint in that situation, and does your usual response protect it?',
    ],
    bridge: 'That is the whole course. Try Free play to build a line of your own and test what you learned.',
  },
]

export const tierInfoFor = (tier: number): TierInfo => {
  const info = tierInfo.find((entry) => entry.tier === tier)
  if (!info) throw new Error(`No course information for tier ${tier}`)
  return info
}
