import { act, ask, look, say, tip } from './steps.ts'
import type { Format } from './summary.ts'
import type { OverviewSection } from './types.ts'

// The trainer's "Start here": what the course is, how to run it, and how to close it. Numbers written
// as {levels} and {sessions} are filled in from the game itself (see summary.ts).
export const overview: OverviewSection[] = [
  {
    id: 'about',
    title: 'What this course is',
    blocks: [
      {
        kind: 'p',
        text: 'A course in the Theory of Constraints, taught with a factory that learners run on their own phones or tablets. Nobody needs any background. It works for high school students through working adults.',
      },
      {
        kind: 'p',
        text: 'There are {levels} levels in {sessions} sessions, one session for each tier of the game. A session is about an hour: you put the game on a big screen, learners play on their own devices, and you guide the talk between levels. This guide gives you the words to say, the questions to ask, the answers, and the wrong turns to expect.',
      },
      { kind: 'p', text: 'By the end of the course, learners can:' },
      {
        kind: 'list',
        items: [
          'find the constraint in a process, and say how they know',
          'use the five focusing steps in order: identify, exploit, subordinate, elevate, and go back to step one',
          'explain why improving anything but the constraint changes nothing, and why an hour lost at the constraint is lost for the whole factory',
          'run a line with drum, buffer, and rope, and size a buffer to the problem it protects against',
          'decide what to make, buy, fix, and schedule by asking what it does for the constraint',
        ],
      },
    ],
  },
  {
    id: 'before',
    title: 'Before your first class',
    blocks: [
      {
        kind: 'list',
        items: [
          "Open the game at its web address on the device you will put on the TV, and try Host a class. Do a practice class with one phone a day ahead, so the first minutes of the course go smoothly.",
          'Every device needs a connection while the class runs, because the class screen and the phones talk to each other. The game itself runs on the device once it has loaded.',
          'Devices need a current browser: Safari 16.4 or newer on iPad and iPhone (iPadOS 16.4 or newer), or a current Chrome, Edge, or Firefox. iPads from 2017 on can run iPadOS 16.4, so check any that are older.',
          'One device per learner is best. If devices are short, pairs work well: one drives and one predicts, and they swap at each level.',
          'Connect the class device to the TV or projector. On an iPad, the Full screen button on the home screen hides the browser bars. Adding the game to the Home Screen also makes it open full screen.',
          'Keep this guide on a second device or on paper, not on the TV. It has the answers.',
          'Check that your school or organization is comfortable with an app that handles student nicknames and answers during a class. The class service receives only what the class screen shows (a nickname, the levels finished with their stars, the level open now, and each answer, prediction, and plan) and deletes it when you end the class, but it is your decision.',
          'Read a session the day before. Each one lists what to prepare.',
        ],
      },
    ],
  },
  {
    id: 'class-screen',
    title: 'Running a class on the class screen',
    blocks: [
      {
        kind: 'p',
        text: 'The class screen puts the game on the TV: who has joined, how far everyone has got, and what everyone answered. Only you see it. Learners see only their own phones, plus whatever you put on the TV.',
      },
      {
        kind: 'steps',
        steps: [
          act(
            'Open the game and tap Host a class. The Join tab shows a QR code, the web address, and the class code in large type. Learners scan the code with their camera, or open the address, tap Join a class, and type the code and a nickname.',
          ),
          look('Names appear under In the class, each with a green dot while the phone is online. The × beside a name removes that person.'),
          act(
            'To take the class to a level, open the Answers tab, pick the level from the list (levels are numbered like 0.1 and 3.2, the same as in this guide), and tap Send everyone here. Each learner gets a prompt with Go to this level. It opens the level even if they have not unlocked it.',
          ),
          look(
            'The Progress tab shows every learner against every level: a check for finished, with the stars earned, an amber cell for tried in class, and a blue outline for the level they have open now. Tap a level number to jump to its answers.',
          ),
          act(
            'On the Answers tab, a level with a right answer (a station or a prediction) shows a tally of everyone\'s first answer, with the right one hidden. A planning level shows every plan the class ran, best first, with its results and how many ran it. Show the right answer when you are ready, and tap Watch to play any plan on the TV.',
          ),
          tip('Turn off Show names to talk about wrong answers. Everyone becomes Student 1, Student 2, and so on, in the order they joined.'),
          act(
            'When you are done, tap End class. It deletes the names, progress, and answers from the class service. Learners keep their own progress on their own devices. If you forget, the class is cleared away the next time anyone hosts a class after it is 12 hours old.',
          ),
          tip('If your class device reloads, the game takes you straight back to your class.'),
        ],
      },
    ],
  },
  {
    id: 'loop',
    title: 'How each level runs',
    blocks: [
      {
        kind: 'p',
        text: 'Every level in this guide follows the same four beats. The timings are a guide.',
      },
      {
        kind: 'list',
        items: [
          'Predict (about 2 minutes). Say the situation in your own words, then ask for a prediction before anyone plays. A show of hands or a quick word with a neighbor is enough. A prediction makes the result matter.',
          'Play (about 4 to 6 minutes). Learners play on their own devices, at their own pace. You watch the Progress tab and the room, and ask questions, not give answers.',
          'Discuss (about 5 to 7 minutes). Use the Answers tab. Read the tally or the plans table, ask why, compare a good plan with a plausible wrong one using Watch, and let learners explain.',
          'Name it (about 1 minute). Say the idea in plain words, the same words the game uses, and write it on the board.',
        ],
      },
      {
        kind: 'p',
        text: 'Each level in the script also has the answer, what to look for while learners play, the wrong turns to expect and what each one shows, and the numbers from the game, which are filled in from the level itself.',
      },
    ],
  },
  {
    id: 'tips',
    title: 'Facilitation tips',
    blocks: [
      {
        kind: 'list',
        items: [
          'Let them be wrong. The game explains every result, so your job is questions, not answers. When a learner asks, "Is it Paint?", ask what they would expect to see if it were.',
          'Wait. After you ask a question, count to seven before you rescue anyone. The first answer is rarely the best one.',
          'Ask for a prediction before every level. People remember the ones they got wrong.',
          'Compare two plans. On a planning level, use Watch to play the best plan and a plausible wrong one on the TV, one after the other, and ask what is different: the piles, the lights, the numbers.',
          'Use names off for wrong answers. It keeps the room safe, and people volunteer.',
          'Say the principle in the same words the game uses, and write it on the board. Learners will meet those words again in the level feedback.',
          'Tie every level to something real. Ask for an example from the room. A line at a shop, a shared kitchen, a team that waits for one person.',
          'Watch the clock. One discussion question is about two minutes. Every session has a list of what to cut when you are short of time.',
          'Give fast finishers something to do: go back and look for the three-star plan, use Briefing to reread the premise, or try Free play and Things to try.',
          'Do not spoil. If you give away the station, the room stops looking.',
        ],
      },
    ],
  },
  {
    id: 'trouble',
    title: 'If something goes wrong',
    blocks: [
      {
        kind: 'list',
        items: [
          "A learner can't join: check the six digits first, then that their device is online. If the message says no class is open, the code is wrong or you have ended the class. Read the code out and have them try again.",
          "A learner's level is locked: send everyone to it with Send everyone here. It opens even if they have not unlocked it, and finishing it counts on their own map.",
          "A learner lost their progress: progress is saved on the device, under the nickname. A home-screen app and the browser keep separate progress on an iPad, so a learner should stick to one. Switch player on the home screen returns to a name used on this device.",
          'A learner shows a gray dot on the Join tab: their phone slept or lost its connection. It sends its results again when it is back, so nothing is lost.',
          'A result does not appear: results arrive when a learner locks in an answer, runs a plan, or makes a prediction. The Progress tab shows amber for tried and a check for finished.',
          'A learner sees Something went wrong: tell them to tap Start again. Their progress is already saved.',
          'The TV shows the wrong screen: keep this guide off the class device. Use a second device or paper.',
        ],
      },
    ],
  },
  {
    id: 'closing',
    title: 'Closing the course',
    blocks: [
      {
        kind: 'p',
        text: 'Use this for the last ten minutes of the last session you teach. It works after Tier 3 for a foundations course, and after Tier 10 for the full course.',
      },
      {
        kind: 'steps',
        steps: [
          say(
            'Let us finish where we started. Every system is held back by one thing. You have found it, exploited it, subordinated everything to it, elevated it, and looked again. Say the five steps with me: identify, exploit, subordinate, elevate, and go back to step one.',
          ),
          ask(
            'What was the most surprising result you saw in the game?',
            'Take three or four. Common ones: a faster station changing nothing, a rope that did not ship more, an upgrade that bought nothing.',
          ),
          ask(
            'Name one place you will look for a constraint this week. What will you look at to find it?',
            'Ask for something concrete and measurable, not a hunch. Have them write it in Notes in the Course guide.',
          ),
          act('Show the Progress tab on the TV, and thank the room.'),
          say(
            'I am going to end the class now. The screen forgets all the names and answers. Your own progress stays on your own device, so you can keep playing, and there is a Free play mode where you can build a line of your own.',
          ),
          act('Tap End class.'),
          tip('Ask what to change. Note what ran long and what fell flat, while it is fresh.'),
        ],
      },
    ],
  },
]

// Ways to run the course, from a taste to the whole thing.
export const formats: Format[] = [
  {
    name: 'Taster',
    who: 'A first look, in one sitting. A welcome, then three levels that show the main ideas, then a close.',
    levels: ['tier0-pileup', 'tier1-one-upgrade', 'tier3-rope'],
    extra: 20,
  },
  {
    name: 'Foundations',
    who: 'The core of the course: finding the constraint, the five focusing steps, variation, and drum, buffer, rope. Tiers 0 to 3, with a break or two.',
    sessions: [0, 1, 2, 3],
  },
  {
    name: 'Foundations and one branch',
    who: 'Foundations, then one of Tiers 4 to 10, chosen for the audience (see the list below).',
    sessions: [0, 1, 2, 3],
    extra: 70,
  },
  {
    name: 'The full course',
    who: 'Every session, in order. It suits a weekly class of about an hour and a half, or two long days.',
    sessions: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
]

// Which branch to teach after Tier 3, by audience.
export const branches: { audience: string; tiers: string }[] = [
  { audience: 'Manufacturing and operations', tiers: 'Tiers 4, 5, 7, 8, and 10' },
  { audience: 'Managers and finance', tiers: 'Tiers 5 and 6' },
  { audience: 'Retail, food, and service', tiers: 'Tiers 6 and 9' },
  { audience: 'Office and project teams', tiers: 'Tiers 5 and 8, with the dice line from Tier 2' },
  { audience: 'Maintenance and reliability', tiers: 'Tiers 7 and 10' },
]
