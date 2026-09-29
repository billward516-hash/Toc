import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier2: Session = {
  tier: 2,
  summary:
    'Why a real line ships less than its averages promise. Learners predict what variation does to a line of dependent steps, then set the pace of new work so the constraint keeps a little slack. The optional dice line makes the point with coins and dice before the game does.',
  before: [
    'Tiers 0 and 1 come first. If someone has not finished them, sending the class to a level opens it for them anyway.',
    'For the optional dice line you need five dice (or a dice app on five phones) and about forty coins or paper clips.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 8,
      steps: [
        say(
          "Here is a planner's sum. Every station takes four minutes a robot. A shift is eight hours: 480 minutes. Four goes into 480 a hundred and twenty times. So the factory ships 120 robots.",
        ),
        ask(
          'Do you believe it? Will a real day ship 120?',
          'Take a show of hands: yes, about, or fewer. Keep the split in mind for level 2.1. The perfect day in the game ships a little under 120, because the line takes a few minutes to fill.',
        ),
        say(
          "Today is about why that sum is wrong, and it isn't because somebody made a mistake. It is because of what variation does to a line where each step depends on the one before.",
        ),
      ],
    },
    {
      kind: 'talk',
      title: 'The dice line (optional)',
      minutes: 12,
      optional: true,
      steps: [
        act(
          'Set up five volunteers in a row, each with a die. Give each of the last four 4 coins. The first has a pile that never runs out. Put a "shipped" box after the last person.',
          'A dice app on a phone works as well as a die.',
        ),
        say(
          "Every round, everyone rolls at the same time. Move that many coins to the person on your right. If you have fewer coins than your roll, move what you have. The last person puts their coins in the shipped box.",
        ),
        ask(
          'A die averages 3.5. Twelve rounds of 3.5 is 42. How many coins do you think the line will ship?',
          'Collect a few guesses and write them on the board before anyone rolls.',
        ),
        act('Run twelve rounds. Write the shipped total on the board after each round.'),
        ask(
          'Everyone averaged 3.5 a round, and we shipped fewer than 42. Where did the rest go?',
          'Coins waiting in front of people, and rounds when someone had fewer coins than their roll. A high roll with nothing to move is wasted. A low roll holds everyone after it up.',
        ),
        tip(
          'Most runs end in the low 30s, and reaching 40 is very rare, about one run in seventy. If your first run is near 42, run it again with different volunteers.',
        ),
        say('That is exactly what the next level does on screen, with robots.'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier2-dice',
      minutes: 15,
      play: 5,
      idea: 'In a line of dependent steps, variation only takes robots away: fast turns are wasted, and slow turns are passed on.',
      setup: [
        say(
          "The planner's math is simple: every station takes 4 minutes a robot on average. First, watch the line on a perfect day, when every station takes exactly 4 minutes. It ships {first}.",
        ),
        ask(
          'On a real day, each robot takes anywhere from 1 to 7 minutes at every station, like rolling a die, and still 4 on average. Will the real line ship more than {first}, about {first}, or fewer?',
          'Ask for a show of hands before anyone plays, and note the split. If you ran the dice line, ask what it taught them.',
        ),
      ],
      watch: [
        'Learners must watch the perfect day to the end before they can choose. Ask them to hold their prediction and not change it after they see the real day.',
        "'About the same' is the tempting answer. It is what averages suggest.",
      ],
      mistakes: [
        "About the same: 'the averages match.' They do, but the stations depend on each other, and averages do not simply add up along a line.",
        "More: 'the fast turns will make up for the slow ones.' A fast turn often has nothing to work on, because the station before it was slow.",
      ],
      debrief: [
        ask('Look at the tally. What did most people predict, and what happened?', 'The real day shipped {second}, which is {gap} fewer than the perfect day.'),
        ask('A station finishes early. What does it do with the time it saved?', 'Nothing, if the station before it has not handed it more work. A fast turn is often wasted. A slow turn is never wasted: everyone after it waits.'),
        say(
          'That is why the ups do not cancel the downs. The downs pass down the line and add up. A line that is perfectly balanced on average ships less than its average.',
        ),
        ask(
          'If real lines look like dice lines, how could you protect the output? Where would you put a cushion?',
          'This sets up 2.2 and Tier 3: slack at the constraint, and then a buffer in front of it.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier2-pace',
      minutes: 16,
      play: 6,
      idea: "Release work a little slower than the constraint's average, or every slow streak leaves a pile behind for good.",
      setup: [
        say(
          "Orders now arrive on a schedule you control. Today the planner releases one every 3 minutes, and the line is swamped. Paint is the constraint at about 3.8 minutes a robot on average, but some robots take under 2 minutes there and others take over 6.",
        ),
        say(
          'Your goal has two parts. Keep the line steady: no station with {limit} or more parts waiting, for at least {minSteadyPct}% of the shift. And still ship at least {minShipped}.',
        ),
        ask(
          'Paint takes 3.8 minutes on average. How often would you release a new order?',
          "Expect '3.8'. It is the tempting answer. Do not correct it: let them run it.",
        ),
      ],
      watch: [
        'Encourage learners to try several release times. The Plans you have tried table shows each one side by side.',
        'A learner who jumps to a much slower pace will find the line calm and the output low. That is the other half of the lesson.',
      ],
      mistakes: [
        'Every 3 minutes, or 3.4: faster than Paint can work on average, so the pile in front of Paint grows all shift.',
        "Every 3.8 minutes, exactly Paint's average: no slack, so after each slow streak Paint never catches up, and the pile grows.",
        'Every 5 minutes: calm, but too slow. Paint often sits waiting for work and the factory ships too few.',
      ],
      debrief: [
        act('When you watch the plans on the TV, start with the one that released every 3.8 minutes, then the best plan. Compare the piles in front of Paint.'),
        ask("Releasing an order every 3.8 minutes matches Paint's average exactly. Why does the pile still grow?"),
        say(
          'With no slack, after every slow streak Paint stays behind, because it never gets a quick streak to catch up on. Releasing a little slower than its average gave it room. The best plan shipped {shipped}, steady {steadyPct}% of the shift.',
        ),
        ask(
          'Where in your own week is the schedule set exactly to the average? What happens when one thing runs long?',
          'Listen for meetings that run over and the whole afternoon slipping. That is a constraint with no slack.',
        ),
      ],
      answer: { pace: '4.2' },
    },
    closing(2, 8, [
      say(
        'Two things to take away. Variation does not average out on a line of dependent steps: it takes output away. And the constraint needs a little slack, or every slow streak leaves a pile behind for good.',
      ),
      ask("Has anyone changed their mind about the planner's 120 since the start of the session?"),
    ]),
  ],
  short: [
    'Leave out the dice line: it is optional, and 2.1 makes the same point on screen.',
    'Skip the closing question and go straight to the bridge.',
  ],
  extend: [
    "Free play: open Things to try and pick 'The perfect line'. Every station takes exactly 4 minutes. Then give every station lots of variation, still 4 minutes on average, and run the same day. Does the line still ship as many?",
    'Run the dice line again with 8 coins in front of each person instead of 4. It usually ships close to 40. The cushion works, and its cost is the coins sitting there: a preview of the buffer in Tier 3.',
  ],
}
