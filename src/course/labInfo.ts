import type { TierInfo } from './types.ts'

// What learners are told about the loading lab, and asked to think about, in the same words the
// trainer's session closes with. The lab sits outside the tiers, so it has no tier number of its own.
export const labInfo: Omit<TierInfo, 'tier'> = {
  objectives: [
    'say what loading and cycle time are, and why cycle time is the minutes of work plus the minutes of waiting',
    'find the knee: the load past which a little more work makes everyone wait much longer',
    'explain why a second bottleneck, and a fifth, bring the knee sooner, and why fixing the balance beats speeding everything up',
    'choose a load that keeps the bottleneck busy without letting the piles run away',
  ],
  reflect: [
    'Think of a process you run, a team or a machine or a desk. How busy is its slowest step? If it ran at 90% instead of 100%, what would happen to how long things take?',
  ],
  bridge: 'Next: take the same idea to your own work. Find the slowest step, and ask how busy it really is.',
}

// The ideas the lab leaves learners with, for the Course guide.
export const labIdeas: string[] = [
  'Waiting is the whole story. The work in an order barely changes with load; the time it waits in piles is what grows.',
  'The curve has a knee. Before it, a little more load costs almost nothing. After it, every extra order makes everyone wait.',
  'More near-equal bottlenecks bring the knee sooner, because each is another place to queue and none has spare time to clear a pile.',
  'Fix the balance, not the speed: leaving one bottleneck, with the rest faster, cut cycle time without raising capacity.',
  'Where an order is a lot that must ship whole and full, the whole fleet is dedicated to it, only as many orders as the fleet can run should be queued, and a promise needs a priority.',
]
