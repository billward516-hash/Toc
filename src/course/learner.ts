import type { OverviewSection } from './types.ts'

// The Course guide's "Get started" page: how to use the game, for someone who has never seen it.
// It says what the screens actually do, so check it against them when they change.
export const gettingStarted: OverviewSection[] = [
  {
    id: 'level',
    title: 'How a level works',
    blocks: [
      {
        kind: 'list',
        ordered: true,
        items: [
          'Read the briefing. It says what the factory makes and what you are trying to do. Tap Briefing at the top of a level to read it again at any time.',
          'Watch the shift. A shift is eight hours, and it plays in about a minute. Tap Play, pause whenever you like, speed it up with 4×, or drag the shift clock to jump around.',
          'Decide. Some levels ask you to pick the station that holds the factory back. Some ask you to predict what will happen. Others ask you to make a plan with buttons, then run the shift with your plan.',
          'Read what happened. After every run the game explains why, whether you were right or not. Nothing counts against you.',
          'Try again. Change my plan lets you try another plan as often as you like, and Plans you\'ve tried lists every plan you have run and how each one did.',
        ],
      },
    ],
  },
  {
    id: 'floor',
    title: 'Reading the factory',
    blocks: [
      {
        kind: 'list',
        items: [
          'Work moves from left to right through the stations.',
          'The blocks above a station are parts waiting for it. The bigger the pile, the longer the wait.',
          'A green light means a station is working. Gray means it is waiting for parts.',
          'Under each station, Made counts what it has finished. Shipped, at the right, counts what has left the end of the line.',
          'In levels with a buffer, the shift clock is colored as it plays: green when the buffer is healthy, red when it runs dry, and amber when it floods.',
          'On a phone, turn it sideways to see the whole line.',
        ],
      },
    ],
  },
  {
    id: 'stars',
    title: 'Goals and stars',
    blocks: [
      {
        kind: 'list',
        items: [
          'A level with a goal gives up to three stars. Each star asks a little more than the last, and the level tells you what each one asks.',
          'Some stars check your plan on days you have not seen, so a plan that only got lucky will not earn them.',
          'You keep the best stars you have earned. A low score never takes anything away.',
        ],
      },
    ],
  },
  {
    id: 'buttons',
    title: 'Other things to know',
    blocks: [
      {
        kind: 'list',
        items: [
          'Pause at problems: in levels where things go wrong, tap it and the shift stops itself at each breakdown, jam, or dry buffer, so you can see what happened.',
          'Explanations: once you have finished Tier 3, you can fold each explanation behind a Why? button, from the home screen.',
          'Free play: build a line of your own and run it. There are no stars or scores. Things to try has ready-made experiments.',
          'Full screen: on an iPad, the Full screen button on the home screen hides the browser bars. Adding the game to your Home Screen makes it open full screen.',
          'Exam and certificate: on the home screen. It has {examQuestions} questions, you need {examPass}% to pass, and you see the reason after every answer. A pass earns a certificate you can save as a PDF. You do not need to finish the levels first.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Your progress and your privacy',
    blocks: [
      {
        kind: 'list',
        items: [
          'Your progress is saved on this device, under your nickname. Nothing is sent anywhere.',
          'Switch player lets several people share a device. Each nickname keeps its own progress, exam results, and certificate.',
          'Your exam answers, your results, and the name on your certificate stay on this device too. Nothing about the exam is sent anywhere, even in a class.',
          'On an iPad, the game added to the Home Screen keeps its progress separately from Safari. Pick one and stay with it.',
          "If your instructor runs a class, tap Join a class and enter the code on their screen. Until the class ends, their screen shows your nickname, the levels you finish, and your answers. Tap Leave class whenever you like: your own progress stays on your device.",
        ],
      },
    ],
  },
]
