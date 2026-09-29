import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier1: Session = {
  tier: 1,
  summary:
    'Learners have found a constraint. Now they use one: they spend a single improvement, cover a lunch break, and put the five focusing steps together. The lesson that runs through the session: help the constraint, and only the constraint.',
  before: [
    'Everyone should have finished Tier 0. If someone has not, sending the class to a level opens it for them anyway.',
    'Write the five focusing steps on the board before the session so they are there for 1.3: Identify, Exploit, Subordinate, Elevate, and go back to step 1.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 8,
      steps: [
        say('Last time we found the constraint. Today we spend money and effort on the factory, and the question is where.'),
        ask(
          'A friend runs a busy restaurant, and the kitchen is where orders wait. Their new budget lets them do one thing. Do they hire another server, buy a bigger dining room, or make the kitchen faster?',
          'Most will say the kitchen. Ask why. You want them to say out loud that only the slow step matters.',
        ),
        say(
          "That instinct is the whole session. Let's see whether the factory agrees with you when the constraint isn't as obvious as a kitchen.",
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier1-one-upgrade',
      minutes: 14,
      play: 4,
      idea: 'Speeding up anything but the constraint changes nothing the customer gets. It is a mirage.',
      setup: [
        say(
          'The owner bought one new tool that makes any one station 25% faster. Today the factory ships {baseline} robots a shift. The owner wants {target}.',
        ),
        ask(
          'Which station gets the tool, and how many robots do you expect the factory to ship afterward?',
          'Ask for a number, not just a station. Have them write it down or tell a neighbor before they play.',
        ),
      ],
      watch: [
        'Learners who look at the piles before choosing are using Tier 0. Praise it out loud.',
        'A learner whose pick shipped {baseline}, the same as before, may think the run failed. Tell them it is data, not failure.',
        'Encourage everyone to try more than one station. The Plans you have tried table shows the results side by side.',
      ],
      mistakes: [
        'Any station but the constraint: shipped stays at {baseline}. The extra speed is wasted.',
        'The first station is the tempting one, because it feeds everyone. Its extra parts just make the pile in front of the constraint bigger, so the work on the floor rises well above {wipBefore} robots. Speeding up a station before the constraint only builds inventory.',
      ],
      debrief: [
        ask('Some of you put the tool on a station and the factory shipped exactly the same. Where did the extra speed go?'),
        act('When you watch the plans on the TV, start with one that gave the tool to Cut, then the one with the right station. Compare the piles.'),
        say(
          'The right station lifted shipments from {baseline} to {shipped}, and the pile in front of it disappeared. Everywhere else, the tool bought nothing. That is a mirage: an improvement that looks like progress and changes nothing anyone receives.',
        ),
        ask('The pile is gone. What do you expect to see next in this factory?', 'A different station becomes the slowest. Hold that thought for 1.3.'),
      ],
      answer: { tool: 'assemble' },
    },
    {
      kind: 'play',
      levelId: 'tier1-lunch',
      minutes: 12,
      play: 4,
      idea: 'An hour lost at the constraint is lost for the whole factory. An hour lost anywhere else costs nothing.',
      setup: [
        say(
          'Everyone takes lunch at the same time, from four to five hours into the shift. A floater can keep one station running through lunch. The factory ships {baseline} robots a shift and the owner wants {target}.',
        ),
        ask(
          'Where should the floater go? And at the other stations, what happens to the work during lunch?',
          "The second question matters: work waits, then the station catches up. Ask them to predict whether it catches up.",
        ),
      ],
      watch: [
        'Expect picks at the other stations as well as the constraint. Ask each learner what that station would be doing during lunch, and what happens to the work waiting for it.',
        'The right plan is worth {gain} more robots. If a learner calls that too small to matter, ask how they would explain it to the owner.',
      ],
      mistakes: [
        'Cut, Assemble, or Box: they are faster than the constraint. After lunch they clear the waiting work quickly, so shipments stay at {baseline}.',
      ],
      debrief: [
        ask('Lunch stopped every station for an hour. Why did an hour at one station cost {gain} robots and an hour at the others cost none?'),
        say(
          'The other stations have time to spare, so after lunch they catch up. The constraint has none, so its lunch hour is gone for good. An hour lost at the constraint is an hour lost for the whole factory. An hour saved there is an hour gained.',
        ),
        ask(
          'Think of a shop with one cashier and one person who bags. If the cashier goes to lunch, what happens? If the bagger goes?',
          'Cashier: the line stops. Bagger: the cashier bags. The bagger has time to spare.',
        ),
      ],
      answer: { floater: 'paint' },
    },
    {
      kind: 'play',
      levelId: 'tier1-five-steps',
      minutes: 18,
      play: 6,
      idea: 'Take the steps in order, and when you break a constraint, another step becomes the slowest: go back to step 1.',
      setup: [
        say(
          'Now put it together. Here are the five focusing steps. One, identify the constraint. Two, exploit it: do not waste a minute of its time. Three, subordinate everything else to it. Four, elevate it: add capacity. Five, if the constraint moves, go back to step one.',
        ),
        act('Point to the five steps on the board.'),
        ask(
          'This time you have a tool that makes a station 30% faster and a floater for lunch. Which of the five steps is the tool, and which is the floater?',
          'Tool: step 4, elevate. Floater: step 2, exploit. Ask which one costs money.',
        ),
        say('The factory ships {baseline} robots and the owner wants {target}.'),
      ],
      watch: [
        'This is the hardest level so far, with many possible plans. Watch for learners who put the tool and the floater on the same station, and ask them why.',
        'Learners who use the Plans you have tried table to work through the plans systematically are ahead. Point that out.',
      ],
      mistakes: [
        'Tool and floater both on Paint: the tool made Paint faster, so Paint stopped being the constraint. Covering its lunch protected a station with time to spare.',
        'The tool on the right station and the floater somewhere unhelpful: half the job. Ask what the slowest step is once the first has been sped up.',
        'The floater on the constraint and the tool elsewhere: a good step 2 and a wasted step 4.',
      ],
      debrief: [
        ask('After the tool went on Paint, which station became the slowest?', 'Assemble. That is why the floater belongs there.'),
        say(
          'That is step five. The tool made Paint faster, so Paint stopped being the constraint and another station took its place. The floater then belonged there. The best plan shipped {shipped} against {baseline}.',
        ),
        ask('Why is it wise to do step two before step four?', 'Exploiting costs almost nothing. Elevating costs money. Do the cheap thing first.'),
        tip('If time allows, ask a learner to talk through their winning plan using the words identify, exploit, subordinate, elevate, and repeat.'),
      ],
      answer: { tool: 'paint', floater: 'assemble' },
    },
    closing(1, 8, [
      say(
        'Three things to take away. Speeding up anything but the constraint is a mirage. An hour lost at the constraint is lost for the whole factory. And when you fix the constraint, another step becomes the slowest, so you go back to step one.',
      ),
      act('Point to the five steps on the board once more and say them together.'),
    ]),
  ],
  short: [
    'Skip 1.2. Its idea, that time at the constraint is time for the whole factory, comes back in 1.3.',
    'Run 1.3 as a group: take a vote on where the tool goes, run it on the TV, then vote on the floater.',
  ],
  extend: [
    "Ask learners to write the five steps in their own words, using a process from their own life, in Notes in the Course guide.",
    'Free play: build a line where the slowest station is not the last, and compare speeding it up with speeding up the last station.',
  ],
}
