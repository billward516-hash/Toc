import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier10: Session = {
  tier: 10,
  summary:
    "Everyday problems. Learners predict what a power cut costs, decide who covers for an absent operator, where overtime pays, when to schedule maintenance, and where to catch rework, and finish by spending a non-constraint's spare time to protect the constraint's work. This is the capstone: it pulls together the whole course.",
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order, but this session works best late, when the room has the ideas from the others.',
    'The close of this session is also the close of the course. Leave time for the course closing in Start here.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 6,
      steps: [
        say(
          'Real days are full of small problems: someone is away, the schedule needs overtime, a machine needs service, some work comes back. None of them makes the news. Each one costs output only if it lands on the constraint. This session is about telling the difference quickly.',
        ),
        ask(
          "In each of these problems, what is the first question you will ask?",
          "It should be: 'does this touch the constraint?'. Say it together, and write it on the board.",
        ),
        act('Write on the board: Does it touch the constraint?'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier10-power-cut',
      minutes: 10,
      play: 4,
      idea: "Only the constraint's lost time costs output. The other stations catch up.",
      setup: [
        say(
          'Back at the robot factory, running drum, buffer, rope with Paint as the constraint. The rope is longer now, 12 robots, so there are usually 8 to 10 robots waiting at Paint. Watch a normal day. It ships {first}.',
        ),
        ask(
          'On the next day, the power goes out at 2:30, and every station stops for 30 minutes. How many robots will that cost: about 7, about 35, or none because the robots waiting at Paint cover it?',
          'Ask for a show of hands before anyone plays.',
        ),
      ],
      watch: [
        "The 'about 35' answer comes from adding 30 minutes at each of five stations. It is the tempting sum.",
      ],
      mistakes: [
        "About 35: every station lost 30 minutes, but only Paint's cost robots. The others have time to spare, and caught up.",
        "None, the robots waiting at Paint cover it: the buffer protects the constraint when something before it stops, not when the constraint itself stops.",
      ],
      debrief: [
        ask('Look at the tally. What did most people predict?', 'The power-cut day shipped {second}, which is {gap} fewer than the normal day.'),
        say(
          "Every station lost 30 minutes, but only Paint's cost robots. The others caught up. Paint is the constraint, so its 30 minutes were lost for good. An hour lost at the constraint is an hour lost for the whole factory.",
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier10-short-handed',
      minutes: 12,
      play: 4,
      idea: 'When someone is away, cover the constraint first, even if that idles a faster station.',
      setup: [
        say(
          "Paint's operator has to be away from 1:00 to 3:00 today. Another operator can cover for them, but then that operator's own station stands idle until 3:00. If nobody covers, Paint stands idle instead, and the factory ships {baseline}. It needs {target}.",
        ),
        ask(
          "Who should cover for Paint's operator?",
          'Ask what happens at the station the cover leaves, and whether that station can catch up.',
        ),
      ],
      watch: [
        'Four options. Learners will choose upstream or downstream. Ask which side of Paint each one is on.',
      ],
      mistakes: [
        "Nobody covering: Paint stands idle for two hours, and nothing wins that time back.",
        "Cut's or Mold's operator: with an upstream station idle, no new robots start, and the ones already on their way keep Paint busy for less than an hour. Then Paint stands idle anyway.",
      ],
      debrief: [
        ask("Why is it safe to leave Box idle for two hours, but not Cut or Mold?", 'Box comes after Paint: idling it does not starve the constraint, and it is fast enough to catch up.'),
        say(
          "With Box's operator painting, Paint never stopped: {shipped} shipped against {baseline}. Box stood idle for two hours and robots piled up in front of it, but Box is faster than Paint, so it caught up. An hour lost at the constraint is lost for the whole factory. An hour lost at a station with time to spare is just a pile that shrinks again.",
        ),
      ],
      answer: { cover: 'box' },
    },
    {
      kind: 'play',
      levelId: 'tier10-overtime',
      minutes: 12,
      play: 4,
      idea: 'Overtime pays only at the constraint.',
      setup: [
        say(
          'Everyone stops for lunch from 4:00 to 4:45, and the factory ships {baseline} a day. A big order means it needs {target} a day this week. The manager can pay an operator to work through lunch, for $150 a day each.',
        ),
        ask('Who should work through lunch, and what will it cost?', 'The second bar is a spending limit: the goal has to be met for $150.'),
      ],
      watch: [
        'Learners can pay everyone to work through lunch. It meets the first star, but not the second.',
      ],
      mistakes: [
        "Cut's or Box's operator: the extra parts just wait, or Box has nothing to box, because Paint still stops for lunch.",
        'Everyone, $750: it ships about what Paint alone would, for five times the cost.',
        'Nobody: Paint stops for 45 minutes with everyone else.',
      ],
      debrief: [
        ask("Everyone working through lunch ships about the same as Paint's operator alone. Is the extra $600 worth it?"),
        say(
          'Paint kept painting through lunch, working through the robots waiting in front of it while everyone else ate: {shipped} shipped, for $150 a day. Assemble and Box came back to a pile, but they are faster than Paint and cleared it. Overtime pays only at the constraint.',
        ),
        ask('Where do people work overtime at your place? Is it the constraint?'),
      ],
      answer: { overtime: 'paint' },
    },
    {
      kind: 'play',
      levelId: 'tier10-maintenance',
      minutes: 12,
      play: 4,
      idea: "Schedule the constraint's maintenance for a time it would be stopped anyway.",
      setup: [
        say(
          'Paint is due for its monthly service: 45 minutes with the machine switched off. The crew has booked 2:00, and everyone still stops for lunch from 4:00 to 4:45. Today the factory ships {baseline}. It needs {target}.',
        ),
        ask('When should the crew service Paint?', 'Four times to choose from. Ask what is happening at Paint at each time.'),
      ],
      watch: [
        'Some learners will think the very start of the shift is free. Point out the first robots reach Paint a few minutes in.',
      ],
      mistakes: [
        'First thing: the first robots reach Paint a few minutes into the shift, so servicing it then still takes 45 minutes from the constraint, on top of lunch.',
        'At 2:00, as booked, or at 6:00: 45 minutes of Paint, on top of the 45 it already loses to lunch.',
      ],
      debrief: [
        ask('Which time cost the factory nothing? Why?'),
        say(
          "The crew serviced Paint while the whole factory was at lunch, when Paint would have stood still anyway, so the service cost no robots at all: {shipped} shipped. Schedule the constraint's maintenance for times it would be idle anyway.",
        ),
        ask('Where does your own constraint have a quiet time? Could maintenance, training, or meetings go there?'),
      ],
      answer: { service: 'lunch' },
    },
    {
      kind: 'play',
      levelId: 'tier10-rework',
      minutes: 12,
      play: 4,
      idea: "Rework that loops back through the constraint takes its time twice. Fix it before the constraint.",
      setup: [
        say(
          'About 3 in every 20 robots come out of Mold with rough edges. The inspector at Box catches them and sends them back to Mold to be made again, so each one goes through Paint a second time. Today {sentBackBefore} were sent back, and the factory shipped {baseline}. It needs {target}.',
        ),
        ask('Where should the rough edges be caught, and what should happen to those robots?'),
      ],
      watch: [
        'Three options. Ask learners to trace one rough robot through the factory and count how many times it uses Paint.',
      ],
      mistakes: [
        "Catching them at Box and sending them back: every robot sent back goes through Paint a second time. Paint's time is spent twice on the same robot.",
        "Catching them at Box and scrapping them: it throws away the time Paint had spent on them. About as few ship as when they are sent back.",
      ],
      debrief: [
        ask('Scrapping and sending back ship about the same. Why?', "Either way, the robot has already used Paint's time, and Paint has none to spare."),
        say(
          "Checked as they left Mold, rough robots were made again on the spot, before Paint ever saw them: {sentBack} made again, and {shipped} shipped. Mold has time to spare, so the extra work there cost nothing. Rework that goes back through the constraint takes its time twice.",
        ),
      ],
      answer: { check: 'mold' },
    },
    {
      kind: 'play',
      levelId: 'tier10-first-candle',
      minutes: 16,
      play: 6,
      idea: "Spend a non-constraint's spare time to protect the constraint's work.",
      setup: [
        say(
          "Back at the candle workshop, in lots of 10. Pour's nozzle keeps a little of the last scent, so the first candle it pours after a scent change smells of both and is thrown out, after Melt, the constraint, has already melted it. Today the workshop throws out {scrappedBefore} and ships {baseline}.",
        ),
        ask(
          "How should the workshop stop wasting candles? What would you be willing to give up to do it?",
          'There are two choices to make together: the nozzle, and the lot size. Ask what the extra minutes at Pour cost.',
        ),
      ],
      watch: [
        'There are three bars: enough candles shipped, none scrapped, and a limit on the wait. Each star needs the next.',
        'Six plans. Learners can combine the nozzle choice with the lot size, so ask them to explain their pair.',
      ],
      mistakes: [
        'Leaving the nozzle as it is: the first candle after every scent change is melted by Melt and then thrown out.',
        'Flushing the nozzle but with lots of 5: Melt spends so long cleaning its pot that it falls behind.',
        'Flushing with lots of 20: nothing is spoiled, but each candle waits for its whole lot, and the wait goes over the limit.',
      ],
      debrief: [
        ask("Flushing the nozzle costs Pour three minutes at each scent change. Why is that free?", 'Pour has time to spare. It is not the constraint.'),
        say(
          "Flushing cost Pour three more minutes at every scent change, but Pour has time to spare, so it cost the workshop nothing, and no candle was spoiled: {shipped} shipped, each out in about {lead} minutes. Every spoiled candle had used Melt's time. Spend a non-constraint's spare time to protect the constraint's work.",
        ),
        ask('Which earlier level does this remind you of?', 'Tier 4 (lots and changeovers) and Tier 7 (protect the constraint from bad work).'),
      ],
      answer: { nozzle: 'flush', lot: '10' },
    },
    closing(10, 10, [
      say(
        'Four things to take away. Cover the constraint first when someone is away. Overtime and maintenance belong where they do not cost output. Rework must not loop through the constraint. And spend the spare time of a station that is not the constraint to protect the constraint\'s work.',
      ),
      ask('What is the one question that runs through every problem in this session?', 'It is: does this touch the constraint?'),
      tip('This is the last session of the full course. Turn to Closing the course in Start here for the final ten minutes.'),
    ]),
  ],
  short: [
    'Skip 10.4 and 10.5 if you have taught Tier 7. Their ideas, protecting the constraint from lost time and bad work, are there.',
    'Play 10.1, 10.2, and 10.6 only: the power cut, cover for an absence, and the pull-together level.',
  ],
  extend: [
    'Ask each learner to choose one problem from their own week (an absence, overtime, maintenance, or rework) and answer: does it touch the constraint, and what does my usual response protect?',
    'Free play: build a line of your own with a jam at the first station and a jam at the constraint, and compare what each one costs.',
  ],
}
