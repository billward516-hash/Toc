import { act, ask, look, say, tip } from '../steps.ts'
import type { Session } from '../types.ts'
import { closing } from './common.ts'

export const tier0: Session = {
  tier: 0,
  summary:
    'The welcome to the course, and the first look at a factory. Learners join the class, learn how a level works, and learn to read a factory floor: where work waits, which stations wait for work, and how to find the constraint.',
  before: [
    'Run a practice class with one phone a day ahead (see Start here), so the first minutes of the course go smoothly.',
    'Keep this guide on a second device or on paper, not on the TV: it has the answers.',
    'Tier 0 is open to everyone, so nothing needs unlocking.',
  ],
  segments: [
    {
      kind: 'talk',
      title: 'Welcome and joining',
      minutes: 12,
      steps: [
        say(
          "Today we're going to run a factory. It's a toy robot factory, on your phones. You'll find out what really limits how much a factory can make, and why the obvious fixes so often change nothing.",
        ),
        say(
          'There is one big idea behind everything we will do: every system is held back by one thing. Find it, and a small change makes a big difference. Miss it, and you can work very hard and change nothing.',
          'This is the Theory of Constraints. Name it once, here, and keep to everyday words after that. The game does the same.',
        ),
        act(
          'On your class device, open the game and tap Host a class. Put the Join tab on the TV: it shows a QR code, the web address, and the class code in large type.',
        ),
        say(
          "Point your phone's camera at the QR code and tap the link. Or open the address, tap Join a class, and type the code. Then type a nickname: any name you like.",
        ),
        say(
          'Until I end the class, this screen shows your nickname, the levels you finish, and your answers. There are no accounts and no emails. When I end the class, the screen forgets all of it. Your own progress stays on your own device.',
          'If your school or organization has rules about apps that handle student information, check them before the first class.',
        ),
        look('In the Join tab, names appear under In the class, each with a green dot while the phone is online. Wait until everyone is in.'),
        tip(
          "If someone can't join, check the six digits first, then Wi-Fi. If devices are short, put two learners on one phone: one drives, one predicts, and swap at each level.",
        ),
        say(
          "Here is how every level works. First a short briefing, which you can read again any time with the Briefing button. Then you watch the factory run a shift: a shift is eight hours, and it plays in a minute or so. You can pause, speed it up, or drag the clock. Then you decide, and the game tells you what happened and why. Nothing counts against you. Wrong answers are how we learn.",
        ),
        ask(
          'Has anyone stood in a long line at a coffee shop, an airport, or a school cafeteria? What was everyone waiting for?',
          "Take two or three. Listen for a single thing everyone waits for: one machine, one scanner, the one till that is open. You'll come back to this answer.",
        ),
        say("Two ground rules. Think out loud. And when a neighbor asks 'is it this one?', don't tell them: ask what they see."),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier0-pileup',
      minutes: 14,
      play: 5,
      idea: 'Work piles up in front of the constraint, the slowest step, and the steps after it wait for work.',
      setup: [
        say(
          'This is a robot factory. Robots move left to right through four stations. The blocks above a station are parts waiting for it. A green light means the station is working; gray means it is waiting for parts.',
        ),
        ask(
          'Watch the whole line for about an hour of the shift. What will you look at to find the step that holds everything back?',
          "Listen for the biggest pile, the station that is always busy, and the stations that keep waiting. All are worth testing. Don't say which is right.",
        ),
      ],
      watch: [
        'Learners have to watch the first hour of the shift before they can lock in an answer, so the room goes quiet for a minute. The Progress tab shows who has started.',
        "Some will pick Cut because it is always busy. That is the trap the next level sets, so let them, and don't explain yet.",
        'Nudge a stuck learner with one question: which station\'s light keeps going gray, and what is it waiting for?',
      ],
      mistakes: [
        'Cut: it is always busy and makes a big pile. But the pile is in front of Paint. The station that makes the pile is not the one holding it up.',
        'Assemble or Box: their lights keep going gray. A station that waits for work cannot be the one holding the line back.',
      ],
      debrief: [
        ask(
          'Look at the tally. Who picked something different from the crowd? What did you see?',
          'Ask someone who picked a wrong answer first, with names off, so it feels safe.',
        ),
        ask('How many parts are waiting in front of Paint by the end of the shift?', 'About {waiting:paint}. Nothing else comes close.'),
        act('Play the shift on the TV and pause near the one-hour mark. Point at the pile, then at the gray lights after it.'),
        say('Work piles up in front of the constraint, and everything after it waits for work. Finding it is always the first step.'),
        ask(
          "Where was the constraint in your coffee-shop line? Who was everyone waiting for?",
          'Come back to the answer from the welcome. It is usually one machine, one person, or one till.',
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier0-busy',
      minutes: 12,
      play: 5,
      idea: 'A station that is always busy is not necessarily helping. Only what the whole line ships counts.',
      setup: [
        say(
          'The manager loves the Cut station. It is always busy, and it makes more parts than anyone. Cut is about to get the Star Station award.',
        ),
        ask(
          'If you had to choose the star station by one number, which number would you use?',
          "Listen for 'most parts made' or 'the busiest'. That is the number this level puts on trial.",
        ),
        say('Keep an eye on the Made count under each station, and on the Shipped box at the end.'),
      ],
      watch: [
        'Most learners will pick Cut on the first try: it has made the most parts. Let them. The game shows them why it is wrong.',
        'Learners who drag the shift clock to compare Made and Shipped at different times are doing the analysis you want. Point it out to the room.',
      ],
      mistakes: [
        'Cut: the most parts made, {made:cut} by the end of the shift, and yet only {shipped} robots shipped. Making parts is not shipping robots.',
        'Mold: it is faster than Cut and waits for parts, so its light goes gray. A station that waits is not the one setting the pace.',
      ],
      debrief: [
        ask('Cut made the most parts. Did the factory ship more robots because of it?'),
        ask('Where did all those extra parts go?', 'Into a pile in front of Assemble: about {waiting:assemble} by the end of the shift.'),
        say('Keeping Cut busy shipped nothing extra. It only built a bigger pile of unfinished work. That costs money and hides the real problem.'),
        ask(
          'Where do people get rewarded for being busy, instead of for what the whole place produces?',
          "Machine utilization reports, hours logged, emails sent. Take one or two. Don't judge anyone's workplace.",
        ),
      ],
    },
    {
      kind: 'play',
      levelId: 'tier0-weakest-link',
      minutes: 14,
      play: 6,
      idea: 'When speeds vary, small piles come and go. The constraint is the pile that keeps growing.',
      setup: [
        say(
          'This line is less predictable. Every station\'s speed varies from robot to robot, so small piles come and go. One station is the weakest link, and you will need to watch longer this time.',
        ),
        ask(
          'How will you tell a pile that comes and goes from one that keeps growing?',
          'Good answers: watch over time, compare early and late, jump around with the shift clock.',
        ),
        act('Remind them they can drag the shift clock to jump back and forth in the shift and compare.'),
      ],
      watch: [
        'Learners have to watch two hours of the shift first. The ones who drag the clock are comparing early and late piles. Point that out to the room.',
        'Mold and Assemble both build small piles now and then. Expect a few wrong answers here.',
      ],
      mistakes: [
        'Mold: it builds a small pile when a few slow parts come in a row, then catches up.',
        'Assemble: the same. It clears its pile. The weakest link is the station whose pile never goes away.',
      ],
      debrief: [
        act('Play the shift on the TV and drag the clock to about one hour, four hours, and the end. Point at each pile in turn.'),
        ask('Which pile was still there at the end? Which ones came and went?', 'Paint\'s pile grows to about {waiting:paint} by the end. The others stay small.'),
        say('A chain is only as strong as its weakest link. However fast the others are, this factory can never ship faster than Paint works.'),
        ask(
          'Think of a team you know. Who or what is the weakest link? Besides opinions, what could you look at to find out?',
          'Listen for something measurable: what waits, how long, and for whom.',
        ),
      ],
    },
    closing(0, 8, [
      say(
        'Three things to take away. The constraint is the step that decides what the whole factory ships. You find it by the pile that keeps growing in front of it, and by the stations after it waiting for work. And being busy is not the same as being productive.',
      ),
      act('Write the three points on the board for the next session.'),
    ]),
  ],
  short: [
    'Skip 0.2 and go straight to 0.3, which also covers finding the constraint, when speeds vary.',
    "Drop the coffee-shop question in the welcome and use the level's own briefing.",
  ],
  extend: [
    "Open Free play and tap Things to try, 'Where does the work pile up?'. Learners run the shift, then tie a rope to the station where work piles up. It is a preview of Tier 3.",
    'Ask learners to describe the constraint in a process of their own, in Notes in the Course guide.',
  ],
}
