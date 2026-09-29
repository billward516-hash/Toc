import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier7: Session = {
  tier: 7,
  summary:
    'When things break, in the robot factory running drum-buffer-rope. Learners see what a breakdown at the constraint costs, choose which of two breakdowns to fix first, size a cushion for a late truck, learn where scrap hurts most and where to catch it, and finish with a bad day where everything goes wrong at once. This is the longest session: there is a break in the middle, and it splits cleanly into two parts.',
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'This session is long. If you have less time, run it as two sessions of about an hour: levels 7.1 to 7.3, and levels 7.4 to 7.6, each with its own open and close.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 6,
      steps: [
        say(
          'Back to the robot factory, now running drum, buffer, rope with Paint as the constraint. Real factories break down, run out of material, and make bad parts. This session asks what each of those costs, and what to protect first.',
        ),
        ask(
          'A machine breaks in your factory. Before you know which machine it is, what is the one thing you want to know?',
          "Listen for 'is it the constraint?'. If not, the factory can usually absorb it. If it is, every minute is lost.",
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier7-constraint-down',
      minutes: 12,
      play: 4,
      idea: 'Every minute the constraint is down is lost for the whole factory. The buffer cannot help, because the buffer protects the constraint from stops upstream.',
      setup: [
        say(
          'Back at the robot factory. It runs drum, buffer, rope now: Paint is the constraint, and the rope keeps 8 robots on their way to it, so Paint always has a little work waiting. First, watch a normal day. It ships {first}.',
        ),
        ask(
          'On the next day, Paint breaks down at 2:00 and stays down for 90 minutes. How many robots will that cost the factory: none, about 10, or about 20?',
          'Ask for a show of hands before anyone plays.',
        ),
      ],
      watch: [
        'Learners watch the normal day to the end before they choose. Ask them to hold their prediction.',
        "'About 10, the buffer covers part of it' is the tempting middle answer.",
      ],
      mistakes: [
        "None, the other stations catch up: they can, but Paint cannot. It has no spare time, so nobody can make up its 90 minutes.",
        "About 10, the buffer covers part of it: a buffer protects the constraint from stops upstream. This time the constraint itself stopped.",
      ],
      debrief: [
        ask('Look at the tally. What did most people predict?', 'The breakdown day shipped {second}, which is {gap} fewer than the normal day.'),
        ask('The buffer had 8 robots waiting in front of Paint. Why did it not help?'),
        say(
          'A buffer protects the constraint when something before it stops. When the constraint itself stops, the robots just wait, and the stations after it wait too. An hour lost at the constraint is an hour lost for the whole factory.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier7-repair-order',
      minutes: 14,
      play: 5,
      idea: 'When two things break at once, fix first the one that would starve the constraint.',
      setup: [
        say(
          'Some mornings a power surge knocks out Mold and Assemble at the same moment. The factory has one repair crew, and a repair takes 30 minutes, so the machine it fixes second stays down for 90. Today the crew always starts with Assemble, the machine nearest its workshop. The factory ships {baseline} on a surge day, and it needs {target}.',
        ),
        ask(
          'Which machine should the crew fix first? How do you decide?',
          "Push for the rule, not just the answer: 'the one that would starve the constraint'.",
        ),
      ],
      watch: [
        'There are only three choices. Have learners write down their rule before they run it.',
        'Learners can watch the pile of robots waiting in front of Paint during each breakdown, and how quickly it drains.',
      ],
      mistakes: [
        "Assemble first: Assemble comes back quickly, but Mold stays down for 90 minutes, far longer than Paint's buffer can last. Paint sits idle.",
        "Half the crew on each: both are down for an hour. Assemble's hour costs nothing, but Mold's hour outlasts Paint's buffer.",
      ],
      debrief: [
        ask('Which machine is upstream of the constraint, and which is downstream?', 'Mold is upstream. Assemble is downstream, and has time to spare.'),
        say(
          'Mold feeds Paint, and Assemble comes after it. With Mold back in 30 minutes, the robots in the buffer covered the gap and Paint kept going. Assemble stayed down for 90 minutes, but it has time to spare and caught up: {shipped} shipped. When two things break at once, fix first the one that would starve the constraint.',
        ),
        ask('Where would you apply that rule outside a factory?', 'A person who feeds your slowest step is more urgent than one who receives from it.'),
      ],
      answer: { crew: 'mold' },
    },
    {
      kind: 'play',
      levelId: 'tier7-late-truck',
      minutes: 16,
      play: 6,
      idea: 'A late delivery stops the line like a breakdown. Keep enough material to ride out the delay you expect, and no more.',
      setup: [
        say(
          'Cut needs a bag of plastic for every robot. A truck brings 30 bags, two hours\' worth, at 2:00, 4:00, and 6:00, but this supplier is never on time: each truck is 20 minutes to almost two hours late. The stockroom starts the day with 30 bags. The factory ships {baseline}, and it needs {target}. Every bag on the shelf is money sitting still.',
        ),
        ask(
          'How much plastic should the stockroom start the day with? What does each extra bag cost you?',
          'The cost of a bag is the money tied up while it sits on the shelf. Aim for a number based on the longest delay.',
        ),
      ],
      watch: [
        'This level has two bars: enough shipped, and not too much stock on the shelf. Learners can meet the first and miss the second.',
        'Ask the room what the longest delay is and how many bags that is. It gives them a number to reason from.',
      ],
      mistakes: [
        '30 bags: with no cushion, every late truck stops Cut, and once the robots already in Paint\'s buffer are used up, Paint stops too.',
        '40 bags: enough for a short delay, not for a truck more than an hour late.',
        '80 bags: it rides out every delay, but too much sits on the shelf.',
      ],
      debrief: [
        act('Read down the four starting amounts, comparing shipped with the stock on the shelf.'),
        ask('80 bags never runs out, yet it earns fewer stars than 60. Why?', 'Every extra bag is money sitting still. The second star limits the stock on the shelf.'),
        say(
          'With 30 spare bags, Cut kept going through every late truck, and the factory shipped {shipped} against {baseline}, with about {stock} bags on the shelf on average. A late delivery stops the line just like a breakdown, so keep enough material to ride out the longest delay you expect, and no more.',
        ),
      ],
      answer: { stock: '60' },
    },
    {
      kind: 'talk',
      title: 'Stretch break',
      minutes: 5,
      steps: [
        tip('A good place to stop for a break, or to end the first hour if you are running the session in two parts.'),
        ask('Before we move on: what are the two ways the constraint can lose time so far?', 'It breaks, or it runs out of material or work. Next: what happens when it works on something that is thrown away.'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier7-where-scrap-hurts',
      minutes: 12,
      play: 4,
      idea: "Scrap after the constraint wastes the constraint's time. Scrap before it only costs spare time.",
      setup: [
        say(
          'Some parts come out bad. On the first day, 1 in 10 of Cut\'s parts is bad, and Cut spots it right away and throws it out. Watch that day first. It ships {first}.',
        ),
        ask(
          'On the second day, 1 in 10 robots goes bad at Assemble instead, and Box finds and throws them out. How many will that day ship: more, about the same, or fewer?',
          'The same fraction goes bad on both days. Ask for a show of hands.',
        ),
      ],
      watch: [
        'The same share of scrap on both days makes many pick about the same. Ask them to think about what each scrapped robot used up.',
      ],
      mistakes: [
        "About the same: the same share goes bad, but when it is found after Paint, Paint has already spent its time on it.",
        "More: every robot thrown out at Box has already used some of Paint's time, and Paint has none to spare.",
      ],
      debrief: [
        ask('Look at the tally. What did most people predict?', 'The second day shipped {second}, which is {gap} fewer.'),
        ask('A bad part at Cut, and a bad robot at Box. What did each one use up?', 'Cut: some of its spare time and a little plastic. Box: time at Paint, which has none to spare.'),
        say(
          'Scrap before the constraint costs spare time, and the rope just lets in another robot. Scrap after it has already used the constraint\'s time, and that is lost for the whole factory.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier7-catch-it-early',
      minutes: 14,
      play: 5,
      idea: 'Check for defects before the constraint, so the constraint never spends time on bad work.',
      setup: [
        say(
          'Mold has a problem: about 1 in 8 of its parts has a hairline crack. Box tests every finished robot and throws out the cracked ones. The factory ships {baseline}, and it needs {target}. You also have a spending limit of ${budget}.',
        ),
        ask('What will you do about the cracks?', 'There are five options with different prices. Ask learners to say what each buys before choosing.'),
      ],
      watch: [
        'Learners may reach for the most expensive fix. Ask what it buys and where it acts.',
        'Look for learners who ask where along the line each option checks the parts. That is the key question.',
      ],
      mistakes: [
        'Checking at Assemble: it comes after Paint, so the cracked robots it throws out have already been painted.',
        'Fixing the cooling at Mold: half the cracks, but the ones left still go through Paint before Box finds them.',
        'Fixing the cooling and checking at Mold: the check alone was enough, so the extra cost buys no more robots.',
        'Keeping the test at Box: every cracked robot has already used Paint\'s time.',
      ],
      debrief: [
        ask('The cooling fix removes half the cracks at the source. Why is it not the best answer?', 'It costs far more, and the cracks that are left still go through Paint before they are found.'),
        say(
          'Checking right after Mold threw out the cracked parts before Paint spent any time on them: {shipped} shipped instead of {baseline}, for $1,500. Mold and Cut have time to spare, and the rope let in a new robot for every part scrapped. Scrap after the constraint wastes the constraint\'s time, so catch defects before it.',
        ),
        ask('Where in your own work is the last chance to catch a problem before your slowest step spends time on it?'),
      ],
      answer: { check: 'mold' },
    },
    {
      kind: 'play',
      levelId: 'tier7-bad-day',
      minutes: 20,
      play: 8,
      idea: 'On a bad day, spend on whatever protects the constraint first. An upgrade anywhere else buys nothing.',
      setup: [
        say(
          "Everything goes wrong at once. A bad batch of plastic cracks 1 in 5 of Mold's parts, and Box only finds them after Paint. Mold will break down some time in the morning, and the repair crew takes two hours to come. And the plastic truck is running late again, with 30 bags in the stockroom. The factory ships {baseline}. You have ${budget} to spend, and it needs {target}.",
        ),
        ask(
          'There are four fixes on offer, at different prices. Before you play, put them in order: which protects Paint the most, and which the least?',
          'Give pairs a couple of minutes. Ask a few to say their order and why.',
        ),
      ],
      watch: [
        'Working in pairs helps here. Learners can talk through each fix and the budget together.',
        'Look for learners who price the plan before they run it. The best plan uses the whole budget.',
      ],
      mistakes: [
        'Upgrading Box: it already has time to spare, so the upgrade buys nothing, and the price takes the plan over budget.',
        'Skipping the extra plastic: the truck is late again, Cut stops, and Paint runs dry.',
        'Skipping the check at Mold: cracked robots are found after Paint, and Paint\'s time is wasted.',
        "Skipping the standby crew: Mold's breakdown lasts two hours, and the robots waiting at Paint last about half an hour.",
      ],
      debrief: [
        ask('Which three fixes did the best plan buy, and what did each protect?', 'Plastic: Cut keeps going. Checking at Mold: no bad work reaches Paint. Standby crew: Mold is back before Paint runs dry.'),
        ask('The Box upgrade looked impressive. Why did it buy nothing?', 'Box has time to spare. It is not the constraint.'),
        say(
          'Every dollar in the best plan went to protecting Paint\'s time, and {shipped} shipped against {baseline}. On a bad day, fix first whatever costs the constraint time.',
        ),
      ],
      answer: { plastic: 'yes', cracks: 'yes', crew: 'yes', box: 'no' },
    },
    closing(7, 8, [
      say(
        'Four things to take away. Every minute the constraint is down is lost for good, and its buffer cannot help. When two things break, fix the one that would starve the constraint. Keep a cushion for a late delivery, sized to the longest delay you expect. And check for defects before the constraint, never after.',
      ),
      ask('What are the three ways your own constraint can lose time, and what is one protection for each?', 'It breaks, it runs out of material or work, and it works on something bad. Protections: a standby crew, a cushion, a check before it.'),
    ]),
  ],
  short: [
    'Run only 7.1, 7.2, and 7.6. The bad day pulls the ideas together.',
    'Skip 7.4 and 7.5 if the room already understands that scrap after the constraint is costly, or run just 7.5.',
  ],
  extend: [
    'Ask learners to replay 7.6 and look for a plan that meets the target for less money than the best plan spent. Discuss what they find, and why.',
    'Free play: open Things to try and pick Which jams cost robots. Compare jams at the first station and at the constraint.',
  ],
}
