import { choice, forTier, truth } from './make.ts'

// Tier 1, The five focusing steps: use the constraint, and speed up nothing else.
export const tier1 = forTier(1, [
  choice(
    '1-1',
    'tier1-five-steps',
    'Which list gives the five focusing steps in the right order?',
    'Identify the constraint, exploit it, subordinate everything else to it, elevate it, then go back to the first step',
    [
      'Identify the constraint, elevate it, exploit it, subordinate everything else to it, then go back to the first step',
      'Exploit the constraint, identify it, subordinate everything else to it, elevate it, then stop',
      'Identify the constraint, subordinate everything else to it, elevate it, exploit it, then go back to the first step',
    ],
    'Find the constraint first. Then get the most out of it with what you have (exploit), make everything else support it (subordinate), and only then spend money on more capacity (elevate). Then look again, because the constraint has probably moved.',
  ),
  choice(
    '1-2',
    'tier1-lunch',
    'Which of these is the best example of exploiting the constraint?',
    "Having a spare worker (a floater) cover the constraint's operator during the lunch break",
    [
      'Buying a second machine for the constraint, so it can make more',
      "Telling the other stations to slow down to match the constraint's pace",
      'Counting the parts waiting in front of each station to see where piles form',
    ],
    'Exploiting means getting the most from the constraint with what you already have, for example by never letting it sit idle. Buying a machine is elevating, matching the pace is subordinating, and counting piles is part of identifying the constraint.',
  ),
  choice(
    '1-3',
    'tier1-five-steps',
    'Letting new work into a line only as fast as the constraint can use it is an example of which focusing step?',
    'Subordinating everything else to the constraint',
    ['Identifying the constraint by watching where piles form', 'Exploiting the constraint by keeping it running through lunch and breaks', 'Elevating the constraint by adding a second machine to it'],
    'Subordinating means running everything else to support the constraint, and letting work in at its pace keeps piles from burying it. Exploiting is getting the most from the constraint itself, and elevating is adding capacity to it.',
  ),
  choice(
    '1-4',
    'tier1-five-steps',
    'Why do you exploit the constraint before you elevate it?',
    'Exploiting costs little or nothing and may free enough capacity to avoid spending',
    [
      'Elevating the constraint does little good until the other stations have been sped up first',
      'Exploiting is often how you find out which station will be the next constraint',
      'Exploiting usually needs a bigger budget than elevating, so it is saved for later',
    ],
    'Free and cheap improvements come first. Idle time and wasted work at the constraint are often the cheapest capacity a factory has. Elevating costs money, so do it only if exploiting was not enough.',
  ),
  choice(
    '1-5',
    'tier1-five-steps',
    'A team adds capacity to its constraint until that station is no longer the slowest step. What should it do next?',
    'Go back to the first step and look for the new constraint',
    ['Stop, because the factory is now fixed', 'Keep adding capacity to the old constraint', 'Speed up whichever station is cheapest to improve'],
    'There is always a next constraint. Once the old one is no longer the limit, another step is, so the focusing steps start over. Money spent on the old constraint now buys nothing.',
  ),
  choice(
    '1-6',
    'tier1-one-upgrade',
    'A line has three stations: Cut takes 4 minutes a part, Mold takes 5, and Paint takes 3. There is money for one new tool that makes a single station 25% faster. Which station gives the biggest gain in output?',
    'Mold',
    ['Cut', 'Paint', 'All three give the same gain'],
    'Mold is the slowest, so it sets the pace. Only a faster Mold lets the line ship more, until Cut becomes the slowest step. Speeding up Cut or Paint changes nothing the customer gets.',
  ),
  choice(
    '1-7',
    'tier1-one-upgrade',
    'Why does running a station that is not the constraint faster, just to keep it busy, usually backfire?',
    'It piles up unfinished parts in front of the constraint',
    ['It overloads the constraint, which then has to work more slowly', 'It wears the machine out much sooner than the other machines', 'It lowers the quality of the parts it makes, so more are scrapped'],
    'The constraint cannot use the extra parts any faster, so they just wait. You end up with more work in process and longer waits, and no extra output.',
  ),
  truth(
    '1-8',
    'tier1-one-upgrade',
    "Speeding up a station that already has time to spare raises the factory's output.",
    false,
    'The constraint still sets the pace, so the factory ships the same as before. The extra parts just wait in a bigger pile. An improvement that changes nothing the customer gets is a mirage.',
  ),
  truth(
    '1-9',
    'tier1-lunch',
    'An hour lost at the constraint is an hour lost for the whole factory.',
    true,
    'Nothing can make up the time, because the constraint decides how much the factory ships. An hour lost at a station that has time to spare usually costs nothing.',
  ),
  truth(
    '1-10',
    'tier1-five-steps',
    "Once you have raised the constraint's capacity enough, the factory has no constraint left.",
    false,
    'Every system has a constraint. When you fix one, the limit moves to the next-slowest step, so you go back to the first step and look again.',
  ),
])
