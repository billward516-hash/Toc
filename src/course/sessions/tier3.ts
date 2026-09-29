import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier3: Session = {
  tier: 3,
  summary:
    'The standard way to run a factory around its constraint: drum, buffer, rope. Learners tie the rope to the constraint, size the buffer to cover a jam upstream, and read the buffer to find the problems that really cost output. This completes the core (Tiers 0 to 3) and opens every other tier.',
  before: [
    'Tiers 0 to 2 come first. If someone has not finished them, sending the class to a level opens it for them anyway.',
    'Draw a supermarket checkout on the board before the session: shoppers, a belt, and a cashier. You will label it during the opening.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open: drum, buffer, rope',
      minutes: 10,
      steps: [
        say(
          'We have found the constraint, spent money on it, and seen that variation costs us. Today we learn the standard way to run a factory around its constraint. It has three parts, and it is called drum, buffer, rope.',
        ),
        say(
          'Picture a supermarket checkout. The cashier is the constraint. The cashier sets the pace for the whole shop, however fast shoppers fill their carts. That is the drum.',
        ),
        act('Label the cashier on your drawing: drum.'),
        say(
          'The belt in front of the cashier holds a few items, so the cashier never waits while a shopper unloads. That is the buffer: a small pile in front of the constraint.',
        ),
        act('Label the belt: buffer.'),
        say(
          'And imagine a store employee at the head of the line who lets the next shopper start unloading only when there is room on the belt. Work is let in only as fast as the cashier uses it. That is the rope: it ties the start of the line to the pace of the constraint.',
        ),
        act('Label the employee at the head of the line: rope.'),
        ask(
          'What goes wrong if the belt is too short? What goes wrong if it is too long?',
          'Too short: the cashier waits when a shopper is slow. Too long: a big queue of unscanned food builds up, and everything takes longer.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier3-rope',
      minutes: 14,
      play: 5,
      idea: 'Tie the rope to the constraint, so work goes in only as fast as the constraint uses it. Output stays the same, and the work on the floor and the wait fall.',
      setup: [
        say(
          "Paint is the constraint, so it sets the pace for the whole factory, like a drum. It needs a buffer, a small pile of work in front of it, so a slow turn upstream never leaves it waiting. Today parts go in as fast as Cut can take them. Watch what happens to Paint's buffer.",
        ),
        ask(
          'A rope lets a new robot in only when one finishes at the station it is tied to. Where should it be tied? What do you expect to change: the number shipped, or something else?',
          'Many will expect more robots. Write both predictions on the board: shipped goes up, or something else.',
        ),
      ],
      watch: [
        "The shift clock is colored as it plays: green while Paint's buffer is healthy, red when it runs dry, amber when it floods. Ask learners to watch the colors.",
        'With three choices, some will finish fast. Ask them to compare the results screen with the starting numbers: what changed, and what did not?',
      ],
      mistakes: [
        'Tied to the first station: work still goes in as fast as that station can take it, so the pile in front of Paint floods.',
        "Tied to the last station: 'one out, one in' sounds fair, but it counts robots already past Paint, so Paint's buffer runs dry and fewer ship.",
      ],
      debrief: [
        ask('With the rope on the constraint, how many robots shipped compared with before?', 'The same: {shipped} against {baseline}.'),
        ask(
          'So what did the rope change?',
          'The work on the floor: {wip} robots on average, instead of {wipBefore}. And each robot\'s wait from release to shipping: about {lead} minutes instead of {leadBefore}.',
        ),
        say(
          'The rope did not ship more robots. It stopped work going in faster than Paint could use it. Less work on the floor means less money tied up, less space, faster delivery, and problems that show up sooner.',
        ),
        ask('Where does your own work start more than the slowest step can finish? What does that pile cost you?'),
      ],
      answer: { rope: 'paint' },
    },
    {
      kind: 'play',
      levelId: 'tier3-size',
      minutes: 16,
      play: 6,
      idea: 'The buffer must last as long as the hiccup upstream, and no longer. A bigger buffer only adds inventory.',
      setup: [
        say(
          "The rope is tied to Paint, five robots long. But now Mold's machine jams: every two hours or so it stops for 25 to 35 minutes. A longer rope means a bigger buffer, but also more robots on the floor.",
        ),
        ask(
          'Paint takes about four minutes a robot. If Mold stops for about half an hour, how many robots does Paint need waiting in front of it to keep working? So how long should the rope be?',
          'About eight robots of waiting work. The rope also counts the robots being worked on upstream, so it has to be longer than eight. Let them estimate, then test.',
        ),
      ],
      watch: [
        "Learners can watch Paint's buffer during a jam. The jam list under the shift clock shows when each jam struck and what it did to the buffer.",
        'Have learners try more than one length. The Plans you have tried table shows shipped and the work on the floor for each.',
      ],
      mistakes: [
        'A rope of 5: every jam drains the buffer within minutes, and Paint sits idle.',
        'A rope of 8: it lasts through the start of a jam, but runs out before Mold is running again.',
        'A rope of 24: hardly a rope at all. Robots pile up in front of Paint and Paint cannot work any faster.',
        'A rope that is longer than it needs to be also fails the second star: it ships the same but puts too much on the floor.',
      ],
      debrief: [
        act('Read down the lengths from shortest to longest, comparing shipped with the work on the floor.'),
        ask('Past a certain length, shipping stopped rising but the work on the floor kept climbing. Where is that length, and why does it matter?'),
        say(
          'The best rope shipped {shipped} against {baseline}, with {wip} robots on the floor on average. Size the buffer to cover the hiccups upstream, and no bigger. Every extra robot is cash tied up, space used, and a longer wait.',
        ),
        ask(
          'Where at work do you keep a cushion? How would you decide how big it should be?',
          'Push toward a number based on a real delay, such as the longest usual delay, not a feeling.',
        ),
      ],
      answer: { length: '12' },
    },
    {
      kind: 'play',
      levelId: 'tier3-read',
      minutes: 14,
      play: 5,
      idea: 'The buffer tells you which problems cost output. Fix the one that empties it, not the one that builds the biggest pile.',
      setup: [
        say(
          "Three machines jam today: Cut, Mold, and Box. Maintenance can fix one of them for good. Watch Paint's buffer. When it runs into the red, see which station is jammed at that moment. Under the shift clock, a list of jams shows what each one did to the buffer.",
        ),
        ask('Which jam do you think costs the factory the most? How will you find out?', 'Listen for: the biggest pile, the longest jam, or the jam at the moment the buffer runs dry. Only the last is right.'),
      ],
      watch: [
        'Send learners to the jam list under the shift clock. It shows each jam and whether the buffer held or ran dry.',
        "Some will choose Box because its jams build the biggest piles. The game's answer explains why that is a trap.",
      ],
      mistakes: [
        "Box: its jams build big piles, but after Paint. Paint keeps working, and Box is fast enough to catch up.",
        "Cut: its jams are short, and Paint's buffer covers every one. That is exactly what a buffer is for.",
        'Assemble: it never jams today, so maintenance has nothing to do there.',
      ],
      debrief: [
        act('Replay the shift on the TV and pause each time the buffer runs into the red. Read out which station is jammed.'),
        ask('Box built the biggest piles. Why did fixing it change almost nothing?'),
        say(
          'Watch the buffer, not the biggest pile. The best fix shipped {shipped} against {baseline}. The buffer shows which problems cost the factory robots, so fix those first.',
        ),
        ask(
          'In your own work, what tells you which problem matters most: the one that is loudest, or the one that stops your slowest step?',
          'Try to get a concrete signal, such as what makes the slowest step wait.',
        ),
      ],
      answer: { fix: 'mold' },
    },
    closing(3, 10, [
      say(
        'Three things to take away. The rope is tied to the constraint, so work goes in only as fast as the constraint uses it. The buffer covers the hiccups upstream, and no more than that. And the buffer shows which problems cost output, so fix those first.',
      ),
      act('Point at the checkout drawing and say drum, buffer, rope together.'),
      ask('The core is now done. Who feels able to explain drum, buffer, and rope to a colleague? Invite one learner to try.'),
      tip('This is a good place to break, or to end a foundations course. See Start here for ways to run the rest.'),
    ]),
  ],
  short: [
    'Skip 3.3 and use 3.1 and 3.2, which carry the main ideas.',
    'Shorten the checkout opening to the three labels, and ask only the first question.',
  ],
  extend: [
    "Free play: open Things to try and pick 'How long a rope?'. Mold jams now and then. Try ropes of 2, 5, 10, and 20 on the same day, and find the shortest rope that keeps Paint busy.",
    "Free play: pick 'The next constraint'. Give Paint a second machine and see where the pile moves.",
  ],
}
