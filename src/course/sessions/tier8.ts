import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier8: Session = {
  tier: 8,
  summary:
    'Changing orders, in a robot factory that now makes a second model. Learners see the constraint move when the mix shifts, move the rope to follow it, spread hard work through the day, predict what constant priority changes cost, and predict what a rush order really changes.',
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'This session leans on Tier 3. If you have not taught it, spend a few minutes on drum, buffer, and rope first.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 6,
      steps: [
        say(
          'So far the orders never changed. Real orders do. A customer asks for something different, the sales office changes what is hot, an urgent order arrives. This session is about what changing orders do to the constraint.',
        ),
        ask(
          'When an urgent request lands on your desk, what happens to the work you were doing?',
          'Listen for: it waits, it gets rushed later, or it gets dropped. That is the cost the session measures.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier8-mix-shifts',
      minutes: 12,
      play: 5,
      idea: 'A change in the product mix can move the constraint.',
      setup: [
        say(
          'The robot factory makes a second model now, the Deluxe robot. It has more parts to fit, so it takes Assemble more than twice as long. The day starts with Classic robots, and at 2:00 a big order for Deluxe robots starts. Watch the shift.',
        ),
        ask(
          'Where will the pile be before 2:00, and where will it be after?',
          'Write both predictions on the board. Before: Paint. After: somewhere else.',
        ),
      ],
      watch: [
        'Learners must watch five hours of the shift, well past the change at 2:00. Ask them to note where the pile is at each end.',
        'The shift clock can jump: dragging it from before 2:00 to after shows the pile move.',
      ],
      mistakes: [
        'Paint: it was the constraint until the Deluxe orders started. Now it keeps up, and the pile is at Assemble.',
      ],
      debrief: [
        act('Play the shift on the TV and drag the clock to just before 2:00, then to about 5:00. Point at the pile each time.'),
        ask('The station that was fine at the start of the day is holding the line back now. What changed?'),
        say(
          'Until 2:00, Paint set the pace. Deluxe robots take Assemble more than twice as long, so once they started, Assemble fell behind: about {waiting:assemble} were waiting for it by the end of the shift. A change in the product mix can move the constraint.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier8-new-rope',
      minutes: 14,
      play: 5,
      idea: 'When the mix moves the constraint, the rope has to move with it.',
      setup: [
        say(
          'From today, every other order is a Deluxe robot, which takes Assemble about six minutes. The rope is still tied to Paint, 8 robots long, the way it has been for months. The factory ships {baseline} a shift, but an order now takes about {leadBefore} minutes from release to shipping.',
        ),
        ask('Where should the rope be tied now, and what do you expect to change?', 'Remind them of level 3.1: the rope changed the wait, not the output.'),
      ],
      watch: [
        'Two bars: a maximum wait of {maxLead} minutes, and at least the shipped target. Learners who look only at the shipped count will miss the first.',
      ],
      mistakes: [
        "Tied to Paint: last month's constraint. It lets in work faster than Assemble can finish it, so the pile grows all day.",
        'Tied to Cut: the first station lets in work as fast as it can take it, so orders pile up in front of the slowest step and the wait balloons.',
      ],
      debrief: [
        ask('How many robots shipped with the rope on Assemble, compared with before?', 'The same: {shipped} against {baseline}.'),
        ask('So what improved?', 'The wait: about {lead} minutes from release to shipping, instead of {leadBefore}.'),
        say(
          'With every other robot a Deluxe, Assemble is the constraint now. Tied to Paint, the rope let work in faster than Assemble could finish it. When the mix moves the constraint, the rope has to move with it.',
        ),
      ],
      answer: { rope: 'assemble' },
    },
    {
      kind: 'play',
      levelId: 'tier8-spread-deluxe',
      minutes: 16,
      play: 6,
      idea: 'Spread hard work through the day, so it never swamps one station.',
      setup: [
        say(
          'A big customer changed today\'s order: 40 of the robots must be Deluxe, and each takes Assemble about six minutes instead of two and a half. The planner put all 40 at the end of the day, after the Classic robots. The factory ships {baseline}, but only {shippedOfBefore} of them are Deluxe.',
        ),
        ask(
          'When should the 40 Deluxe robots be made? What is the risk of each choice?',
          'Listen for: first, last, spread, alternate. Ask what happens at Assemble in each case.',
        ),
      ],
      watch: [
        'There are three bars: all {minOf} Deluxe robots shipped, enough shipped in all, and a wait of no more than {maxLead} minutes. Each star needs the next.',
        'Encourage learners to try all four options and compare the star count.',
      ],
      mistakes: [
        'Last: the Deluxe robots all reach Assemble at once and it cannot finish them before the shift ends.',
        'First thing in the morning: all 40 ship, but while they are made Assemble is the constraint and orders pile up in front of it, so the wait is long.',
        'Every other robot: Assemble is the constraint all day, and the factory makes more Deluxe robots than the customer needs.',
      ],
      debrief: [
        act('When you watch the plans on the TV, start with the one that made them last, then the one that spread them.'),
        ask('Why did spreading them work when saving them for last, or doing them first, did not?'),
        say(
          'Spread through the day, the Deluxe robots never piled up at Assemble, and Paint stayed the constraint: {shippedOf} Deluxe robots and {shipped} in all. A change in the mix can move the constraint. Spreading the new work out keeps it where your plan expects.',
        ),
      ],
      answer: { order: 'spread' },
    },
    {
      kind: 'play',
      levelId: 'tier8-hot-list',
      minutes: 12,
      play: 4,
      idea: 'Changing priorities at the constraint costs output. Set the order once, and let the constraint keep working.',
      setup: [
        say(
          'The factory makes orange robots and blue robots. Switching colors means cleaning Paint\'s spray gun, about eight minutes, so Paint keeps painting one color while any robots of that color are waiting, and only then switches. Watch a normal day. It ships {first}.',
        ),
        ask(
          'On the next day, the sales office calls Paint every half hour: "Blue is hot!", then "Orange is hot!", and Paint switches colors at every call. How many robots will that day ship: more, about the same, or fewer?',
          'Ask for a show of hands. Many will say more, because the hot robots go out faster.',
        ),
      ],
      watch: [
        'Learners watch a normal day first, then predict. Ask them to hold the prediction.',
      ],
      mistakes: [
        'More: a hot robot does jump ahead, but every jump costs Paint a color change, and the constraint has no time to spare.',
        'About the same: each call looks harmless, but each one makes Paint clean its gun.',
      ],
      debrief: [
        ask('Look at the tally. What did most people predict?', 'The hot-list day shipped {second}, which is {gap} fewer.'),
        ask('Every call felt like helping a customer. Who paid for it?', "Every other customer's order, in the constraint's lost minutes."),
        say(
          'Every call made Paint switch colors, and every switch meant eight minutes cleaning the gun instead of painting. Paint is the constraint, so those minutes were lost for the whole factory. Set the order once, in the plan and the rope, and let Paint keep painting.',
        ),
        ask('Where does an interrupt-driven day cost you your best hours?'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier8-rush-order',
      minutes: 12,
      play: 4,
      idea: 'A rush order changes the order the work goes out in, not how much goes out.',
      setup: [
        say('Back to one kind of robot, with the rope tied to Paint, 8 robots long. Watch a normal day. It ships {first}.'),
        ask(
          'On the next day, a customer calls at 2:00 with a rush order: 12 more robots, needed by 5:00. They start at once, on top of the rope, and jump the queue at every station. How many robots will that day ship in all: about 12 more, about the same, or fewer?',
          'Ask for a show of hands before anyone plays.',
        ),
      ],
      watch: [
        'Most learners will say about 12 more. Ask them where Paint would find the time.',
      ],
      mistakes: [
        'About 12 more: Paint is already busy every minute, so the rush robots take the places of robots that would have shipped today. They ship tomorrow instead.',
        'Fewer: jumping the queue cost nothing here, because no station had to switch anything to let the rush robots through.',
      ],
      debrief: [
        ask('Look at the tally. What did most people predict?', 'The rush-order day shipped {second}, about as many as the normal day.'),
        ask('The rush customer got their order on time. What did everyone else get?', "Their orders were pushed back by exactly as much. A rush changes who waits, not how much the factory can make."),
        say(
          'Rushing changes the order work goes out in, not how much goes out. Only more time at the constraint does that. Compare this with the hot list: a rush that needed a changeover would have cost output. This one did not.',
        ),
        tip('Be careful not to say rush orders are bad. The lesson is that they are a trade, and the trade is not free.'),
      ],
    },
    closing(8, 8, [
      say(
        'Four things to take away. A change in the mix can move the constraint, so move the rope with it. Spread hard work through the day. Constant priority changes at the constraint cost output. And a rush order changes the order of work, not the amount.',
      ),
      ask('Think of one urgent request from the past week. Whose work did it push aside?'),
    ]),
  ],
  short: [
    'Skip 8.3 and 8.5. Levels 8.1, 8.2, and 8.4 carry the main ideas.',
    'Play 8.4 and 8.5 back to back as a pair of predictions and compare their answers.',
  ],
  extend: [
    "Ask learners to redraw the rope in 8.2 with a pencil: where did it start, where did it end, and what did the change do to the wait?",
    'Ask learners to design a rule for how their team handles urgent requests so that the constraint keeps working.',
  ],
}
