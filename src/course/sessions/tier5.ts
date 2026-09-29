import { act, ask, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier5: Session = {
  tier: 5,
  summary:
    'Growing the factory. In a print shop, learners find a rule that is the constraint, look for the next constraint before they buy, notice an old rule that has become the new constraint, and see why time to spare is protection, not waste. Money matters here: stars reward output gained per dollar spent.',
  before: [
    'Tier 3 comes first. Tiers 4 to 10 can then be taught in any order.',
    'The four levels have budgets and prices. Have a calculator or a whiteboard ready for the sums.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open',
      minutes: 8,
      steps: [
        say(
          'Now the factory is a print shop, with posters, flyers, and presses. This session is about growing: what to do when the boss says we need more.',
        ),
        ask(
          "Your manager says: 'We need more capacity. Buy another machine.' What is the first question you ask before you spend?",
          "Listen for 'are we using what we have?' and 'where is the constraint?'. Those are steps 1 and 2.",
        ),
        say(
          'Four things to watch for: a rule that is the constraint, the next constraint after a fix, an old rule that outlives its reason, and idle time that is not waste. Each is a level.',
        ),
        say('Money matters now. Some levels give a budget, and the stars reward getting the most output for what you spend.'),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier5-house-rules',
      minutes: 16,
      play: 5,
      idea: 'Some constraints are rules. Lifting a rule is free capacity: exploit before you elevate.',
      setup: [
        say(
          'Welcome to the print shop. An order comes in every 3 minutes: a poster, then two flyers, and again. Posters only fit on the big press, and the small press prints flyers slowly. A house rule older than anyone remembers says the big press prints posters only. The shop prints {baseline} orders a shift and needs {target}.',
        ),
        ask(
          'You can change the rule, buy another small press for $20,000, or both. What will you do, and what will you ask before you decide?',
          'The stars judge output gained for every $1,000 spent, so spending nothing on something that works is worth the most.',
        ),
      ],
      watch: [
        'There are only four plans. Both changing the rule and buying a press meet the goal, but only one earns three stars. Ask who bought first.',
        'Look for learners who ask which press is idle. That is the question the level is about.',
      ],
      mistakes: [
        'Buying a press and keeping the rule: it works, for $20,000, but the big press still sits idle between posters.',
        'Changing the rule and buying the press: right idea, extra cost. The rule change alone was enough.',
        'Changing nothing: flyers keep piling up in front of the small press while the big one sits idle.',
      ],
      debrief: [
        ask('Changing the rule and buying a press both meet the goal. Why does one earn three stars and the other two?', 'The stars judge output gained per $1,000 spent. Lifting the rule costs nothing.'),
        say(
          'The best plan shipped {shipped} instead of {baseline}, for free. Before buying capacity, make sure the capacity you already have is not held back by a rule. Exploit before you elevate.',
        ),
        ask('Once the shop keeps up with every order, what is the constraint now?', 'The market: how many orders come in. More machines buy nothing.'),
        ask('What rule or habit at work or school might be holding something back?'),
      ],
      answer: { rule: 'both', press: 'none' },
    },
    {
      kind: 'play',
      levelId: 'tier5-next-constraint',
      minutes: 16,
      play: 6,
      idea: 'There is always a next constraint. Fixing one reveals another, so look for it before you spend.',
      setup: [
        say(
          'Business is booming: an order now comes in every 2.4 minutes, 200 a shift. With one machine at every station, the shop prints {baseline}, and it needs {target}. You have $30,000 to buy a second machine for any station, or two.',
        ),
        ask(
          'Where will you spend it? And after your first purchase, where do you expect the pile to move?',
          'The point is to name the next station before spending.',
        ),
      ],
      watch: [
        'Learners can look at the piles and station speeds before they spend. Ask who compared how slow Trim was with how slow Print was.',
        'With four purchases and a budget, there are many combinations. Encourage learners to plan on paper first.',
      ],
      mistakes: [
        'A second press alone: Print keeps up, but the pile moves to Trim and the shop prints less than the target.',
        'Machines at Design or Pack: neither is the constraint, so they change nothing.',
        'No press: every order goes through Print, and it still has one press.',
      ],
      debrief: [
        ask('After a second press, where did the pile move? How could you have known before you bought?', 'Trim was nearly as slow as Print. Compare each station: the second slowest is the next constraint.'),
        say(
          'A second press and a second trimmer together shipped {shipped} instead of {baseline}: every order that came in. Each time you break a constraint, go back to step one and find the next one.',
        ),
        ask('The shop now keeps up with every order. Where is the constraint again?', 'Outside the shop, in how many orders come in.'),
      ],
      answer: { computer: 'none', press: 'press', trimmer: 'trimmer', table: 'none' },
    },
    {
      kind: 'play',
      levelId: 'tier5-old-habits',
      minutes: 16,
      play: 6,
      idea: 'A rule built around an old constraint becomes the new constraint when the constraint moves.',
      setup: [
        say(
          'Last year Pack was the shop\'s constraint, so the shop tied a rope to it: a new order starts only when fewer than 3 are on their way to Pack. It worked. This spring the shop bought a second packing table. Orders are backed up for weeks, but the shop prints only {baseline} a shift, and it needs {target}.',
        ),
        ask('What would you change?'),
        tip(
          'Do not hint. The game teaches this one by letting learners feel the failure first. Resist the urge to point at the rope.',
        ),
      ],
      watch: [
        'Notice who buys the $20,000 press first. It is the tempting move, and it barely changes anything.',
        'Learners who reach for the rope have found the point. Let them say why.',
      ],
      mistakes: [
        'Buying a press and keeping the rope on Pack: almost no change. The rope still lets only a few orders onto the floor, so both presses wait for work.',
        'Changing nothing: the rope, tied to Pack, holds back the whole shop, while Pack has time to spare.',
        'Tying the rope to Design: the goal is met, but orders pile up in front of Print all day. A rope belongs on the constraint.',
      ],
      debrief: [
        ask('Who bought the press? What did it change?', 'Almost nothing, and it cost $20,000.'),
        ask('Why not?'),
        say(
          'The rope was right when Pack was the constraint. After the new table, Print was the slowest step, but the rope kept counting every order already past Print, so Print ran out of work. Tied to Print, the shop printed {shipped} instead of {baseline}, for free. When the constraint moves, the rules built around it have to move too, or the old rule becomes the new constraint.',
        ),
        ask('Name a rule at work or school that was built for a problem that has since gone away.'),
      ],
      answer: { rope: 'print', press: 'none' },
    },
    {
      kind: 'play',
      levelId: 'tier5-balance-flow',
      minutes: 16,
      play: 6,
      idea: 'Time to spare at stations that are not the constraint is protection, not waste.',
      setup: [
        say(
          "A consultant visited last month. Design, Trim, and Pack each had a second machine that sat idle half the day, so the consultant sold them. Now every station works at the press's pace, and every machine is busy all day. Orders still come in every 3.1 minutes, but the shop prints only {baseline}, and it needs {target}. You have $20,000.",
        ),
        ask(
          'Is a machine that sits idle half the day a waste? What would you buy back?',
          'Do not explain yet. Let them argue both sides.',
        ),
      ],
      watch: [
        'The press is the most expensive machine and the tempting purchase. Check who chose it.',
        'The best plan uses most of the budget. Have learners add up the costs before they commit.',
      ],
      mistakes: [
        'A second press: Design, Trim, and Pack still work at exactly the pace of the orders, so every jam there still costs orders for good.',
        'Buying nothing: every station is busy and still behind.',
        'Buying only some of the machines: it helps, but not enough.',
      ],
      debrief: [
        ask('The consultant counted idle time as waste. What did that idle time actually do for the shop?', 'It let each station catch up after a jam.'),
        say(
          'With their second machines back, Design, Trim, and Pack catch up after every jam, and only the press sets the pace: {shipped} instead of {baseline}. Do not balance capacity. Balance the flow with what customers order, and keep time to spare everywhere but the constraint.',
        ),
        ask('Where does a place that is 100% busy get into trouble? What happens when something unexpected arrives?', 'An emergency room at full occupancy. A calendar with no gaps.'),
        tip("This is Tier 2's dice lesson again: a perfectly balanced line ships less than its average."),
      ],
      answer: { computer: 'computer', press: 'none', trimmer: 'trimmer', table: 'table' },
    },
    closing(5, 8, [
      say(
        'Four things to take away. A rule can be the constraint, and lifting it is free. Fixing one constraint reveals the next, so look before you spend. A rule built around an old constraint becomes the new one. And idle time at a station that is not the constraint is protection, not waste.',
      ),
      act('Write the four points on the board.'),
    ]),
  ],
  short: [
    'Skip 5.4. Its idea, that a perfectly balanced line ships less than its average, is the dice lesson from Tier 2.',
    'Run 5.2 as a group: take votes on what to buy, then run the best two plans on the TV and compare.',
  ],
  extend: [
    "Free play: open Things to try and pick 'The next constraint'. Give Paint a second machine and see where the pile moves. Then move the rope to follow it.",
    'Go back to 5.1 and ask learners to explain, in one sentence, why lifting a rule beats buying a press.',
  ],
}
