import { labInfo } from '../labInfo.ts'
import { act, ask, look, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'

// The tier number the loading lab's session goes by in the trainer's guide. The lab is not part of the
// tiers (it has no levels, stars, or class screen), so this session sits after them.
export const LAB_TIER = 11

// The loading lab: what load does to cycle time, and how many bottlenecks a line has. Numbers written
// as {lab90} and so on are filled in from the lab's own model (see course/lab.ts), so they can't go stale.
export const labSession: Session = {
  tier: LAB_TIER,
  summary:
    'What factory loading does to cycle time. Learners load a line with more and fewer orders and find the knee in the curve, then see how a second bottleneck, and then five, make the knee come sooner. Two optional rounds take it into a fab: whole orders that ship full, the whole fleet dedicated to one order, and hot orders with a shorter promise. It is a workshop that can stand alone after Tier 3.',
  before: [
    'Tiers 0 to 3 come first, or at least Tier 3: the lab leans on the constraint, variation, and the rope. A group that has done only Tier 0 can still do rounds 1 and 2.',
    'The loading lab is not on the class screen. It has no levels, no stars, and nothing for the Progress tab to show. Learners play it on their own devices, and tell you their numbers. Find it on the home screen: the Loading lab card, above Free play.',
    'Play round 1 yourself once, so you know where the knee falls on your screen. Tap Show the average of {labDays} days after a few runs.',
    'The 80-second explainer video is inside the lab (round 1, and the closing page). Decide whether to play it on the TV at the start, or as the close.',
    'Rounds 4 and 5 are optional. They suit a group from semiconductors or any plant where an order is a lot of parts that must ship whole. Skip them for everyone else.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Open: the empty highway',
      minutes: 8,
      steps: [
        say(
          'Quick question. When a highway is half empty, your commute is easy. When it is almost full, everything crawls. Same road, same cars. What changed?',
        ),
        ask(
          'Where have you seen this? A checkout, a clinic, a help desk, a road, a machine. What happened as it got busier?',
          'Listen for "it gets much worse, not a little worse". That is the whole lesson. Write a few of their examples on the board.',
        ),
        say(
          'In a factory the busyness has a name. Loading is how busy you keep your slowest step, the bottleneck, as a share of what it can do. A hundred percent means it never gets a break. Cycle time is how long one order takes, from the day it starts to the day it ships: the minutes it is worked on, plus the minutes it waits.',
        ),
        ask(
          'A robot needs {labWork} minutes of real work. How long will it take from start to ship if the factory is loaded to 60%? To 100%?',
          'Write the guesses on the board and leave them up. Most people say a little longer at 100%. The lab says {lab60} minutes at 60% and {lab100} at 100%.',
        ),
        act(
          'If you like, play the 80-second explainer video now: round 1 of the lab has it under Watch the 80-second explainer. An illustrated host explains loading, cycle time, and the knee in plain words, with captions. Or save it for the close.',
        ),
        tip(
          'Learners play the lab on their own devices, from the Loading lab card on the home screen. It is not on the class screen, so ask for numbers aloud: the load they chose and the cycle time they got.',
        ),
      ],
    },
    {
      kind: 'talk',
      title: 'Round 1: Find the sweet spot',
      minutes: 12,
      steps: [
        say(
          'One line, one bottleneck: Paint. Paint can make {labCapacity} robots an hour, so {labCapacity} orders an hour is a load of 100%. You choose the load. Ship at least {labM1Shipped} robots in the day, and keep the average robot to {labM1Cycle} minutes or less in the factory.',
        ),
        act(
          'Learners open the Loading lab from the home screen. Round 1 of 5: slide the load, tap Run the day, and watch. Every run is the same day with the same luck, so only the load changes between runs. Let them play for about 5 minutes.',
        ),
        look(
          'Most start low (60%): the line ships too few robots. Then they try 100% or more: cycle time shoots up and robots pile in front of Paint. Then they settle at 90% to 95%.',
        ),
        ask('What load did you end on? What did it ship, and how long did a robot take?', 'Take three or four answers, and write the loads on the board.'),
        act('Tap Show the average of {labDays} days under the chart. The curve is what many different days average to. Each numbered dot is a learner\'s own run.'),
        ask('Where does the curve bend? Where would you stop loading it?', 'Around 90% to 95%. That bend is the knee.'),
        say(
          'The numbers: {lab60} minutes at 60% load, {lab90} at 90%, {lab95} at 95%, {lab100} at 100%, and {lab110} at 110%. From 90% to 100% the line ships {labShipGain}% more, and cycle time goes up {labRatio} times.',
        ),
        say(
          'A bottleneck that is never idle can never catch up after bad luck: a slow robot, or a crowd of orders. So the waiting grows without limit as it fills. Run it near full, not full.',
        ),
        tip(
          'Two wrong turns. One: "100% is best, because output is highest." Output barely rises past 95% while cycle time doubles. Two: at 110% the cycle time on the screen is for the robots that shipped, so it looks smaller than the pile really is. Point at In the factory: that counter keeps growing.',
        ),
      ],
    },
    {
      kind: 'talk',
      title: 'Round 2: Two bottlenecks',
      minutes: 12,
      steps: [
        say(
          'The factory changed. Assemble used to be quick, and now it is as slow as Paint. Two bottlenecks, each able to make {labCapacity} an hour. The line can make exactly as many robots as before.',
        ),
        ask(
          'Before anyone runs it: at 19 orders an hour, 95% load, the first line took {lab95} minutes. How long will this one take? The same, a little longer, a lot longer, or more than double?',
          'Do not let learners tap yet. Hands up for each choice. The round makes them pick before the Run button works.',
        ),
        act('Learners choose a guess in the lab, tap Run it and see, and read the result.'),
        say(
          'This one took {two95} minutes: {twoMore}% longer than the first line, at the same load, with the same capacity. A robot can now wait in front of either slow step, and a delay at one shows up as a pile at the next. Two bottlenecks mean two places to queue.',
        ),
        act('Learners then find the highest load that still meets the mission. Let them play for about 4 minutes. Most find it a notch lower than in round 1.'),
        look('The Queue strips under each result: with one bottleneck the pile sits at one station. With two, it moves between them.'),
        ask('What is it that makes the second line need a lower load for the same cycle time?', 'Neither slow step has spare time to clear a pile. With one clear bottleneck, every other station has slack to absorb the variation before it reaches the constraint.'),
        tip('Learners who guessed "about the same" are in good company: capacity looked the same. Ask them what they now think is different: where the waiting can happen.'),
      ],
    },
    {
      kind: 'talk',
      title: 'Round 3: Everything is a bottleneck',
      minutes: 12,
      steps: [
        say(
          'Now every step takes the same time: five bottlenecks. You have four speed-ups. Tap a station on the floor, or the buttons below, to make it 40% faster. The mission is the same as round 1. Where will you leave the bottleneck?',
        ),
        act('Learners play for about 5 minutes. The floor tags the bottlenecks as they change: five, four, three, two, then one.'),
        look(
          'Some speed up the first stations, some the last. Any four gives one bottleneck, and the mission can be won. Anyone who uses only two or three speed-ups still has several bottlenecks, and the advice line says so.',
        ),
        ask(
          'Speeding up four stations did not raise the capacity. Why did it help at all?',
          'It left exactly one bottleneck. At 95% load the five-bottleneck line took {five95} minutes, and with four speed-ups it took {fixed95}. Cycle time fell by more than half with the same {labCapacity} an hour.',
        ),
        say(
          'This is what the rope does in the main game. It holds the load where the one bottleneck is nearly full, and the piles stay short everywhere else. Fixing the balance, not the speed.',
        ),
        tip('Link back to Tier 1: after you elevate the constraint, the constraint moves. Ask which station is the bottleneck now that four are faster.'),
      ],
    },
    {
      kind: 'talk',
      title: 'Optional round 4: Orders and tools',
      minutes: 15,
      optional: true,
      steps: [
        say(
          'Now a fab. A workgroup of eight tools, run for two weeks. An order is a customer\'s demand for good wafers: 600, 1200, 1800, or 2400. You do not choose its size. It must ship full, and only when all of it is done.',
        ),
        say(
          'Yield runs from 69% to 85% and is known only when the order has run. So you start more wafers than ordered. Start for the worst yield and every order is full the first time, but spare wafers use tool time. Start for a better one and a short order needs a top-up run, and waits for it.',
        ),
        act(
          'Learners open round 4. The whole fleet works on one order at a time, which keeps orders from mixing. Choose how the workgroup is run, how to start each order, and how many orders to keep in the system. The mission for this group is {fleetGood} wafers shipped, with an order taking {fleetCycle} hours or less on average. Let them play for about 6 minutes.',
        ),
        look('Most keep four orders in the system, which "keeps the tools busy". Then they see the order cycle time.'),
        say(
          'With wafers always queued, cycle time is just the orders in the system times the time one takes. One order at a time took {fleetOne} hours, and four took {fleetFour}, with the same {fleetBusy}% busy tools. Queue only what the fleet can run.',
        ),
        say(
          'Starting every order for the worst yield suits the whole fleet: a top-up is a short run that holds all eight tools and leaves most idle, so starting for the best yield fell to {hopeBusy}% busy, with {hopeShort}% of orders needing one. Dividing the workgroup into single tools keeps every tool {divBusy}% busy and ships about {divShip}, but an order then takes about {divCycle} hours.',
        ),
        ask('A workgroup of two or four tools behaves differently. Why would a hopeful start pay on a small group?', 'A top-up ties up fewer tools, so it wastes less. Try it with the Workgroup buttons.'),
        tip('Cutting an order into sublots does not help: sublots that finish early cannot ship. Learners who try it see "Done, can\'t ship" fill up on the floor.'),
      ],
    },
    {
      kind: 'talk',
      title: 'Optional round 5: Hot orders',
      minutes: 12,
      optional: true,
      steps: [
        say(
          'Some orders are promised sooner: {dueHot} hours for a hot order, {dueNormal} for any other. Hot orders arrive at random, on top of the orders in the system. You choose whether they go first.',
        ),
        act('Learners play round 5 for about 5 minutes. The mission is that hot orders and the others both ship on time, with at least {hotShip} wafers.'),
        ask('What happens to a promise if hot orders wait their turn?', 'It is broken: only {hotNoPriority}% were on time with no priority, and {hotPriority}% going first.'),
        say(
          'Nothing interrupts the order on the fleet, so a hot order still waits for it to finish, and then needs the time its own size takes. Orders cannot shrink, so the fleet is the lever: keep it whole, and keep the queue short. With the workgroup divided into single tools, hot orders were on time {hotDivided}% of the time.',
        ),
        tip('Going first costs the other orders little. The wait just moves a little. The real cost shows if a set is kept free for hot orders: that tool time stands idle.'),
      ],
    },
    {
      kind: 'talk',
      title: 'Close',
      minutes: 8,
      steps: [
        act("Learners finish the last round they played and open the closing page: after round 3 they tap Skip the fab rounds: see what it shows, and after round 5 they tap See what it shows. It has a takeaway for each round, with the numbers behind them."),
        say('Waiting is the whole story: the work in a robot barely changes with load, but the piles do. The knee is where waiting takes off. More bottlenecks make the knee come sooner. And fixing the balance, not the speed, left one bottleneck to protect.'),
        look('Go back to the guesses on the board from the opening. Ask who was closest.'),
        ask(labInfo.reflect[0], 'Give a minute to think, then take two or three answers. Learners can write theirs in Notes, in the Course guide.'),
        say(labInfo.bridge),
      ],
    },
  ],
  short: [
    'Run only the opening and rounds 1 and 2: about 40 minutes. They carry the knee and the second bottleneck.',
    'Play the video instead of the opening talk, then go straight into round 1.',
    'Skip the optional rounds unless the group works with lots, batches, or promised dates.',
  ],
  extend: [
    'Run the optional rounds 4 and 5, and have the group try each workgroup: eight tools, six, four, and two. Ask what changes.',
    'Ask each learner to find the knee in one of their own processes, and the load they run it at.',
    'Have pairs race: who finds the sweet spot in round 1 in the fewest runs?',
  ],
}
