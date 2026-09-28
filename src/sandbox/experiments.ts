import { changeStation, DEFAULT_SETUP, type SandboxSetup, type Variation } from './setup.ts'

// Things to try in free play: each sets up a line with one tap and asks a question to answer by
// changing it and running the same day again. Nothing is scored; tests check that each shows what it
// asks about.
export interface Experiment {
  id: string
  title: string
  // What to do, and what to look for.
  text: string
  setup: SandboxSetup
}

const even = (minutes: number, variation: Variation): SandboxSetup => ({
  stations: Array.from({ length: 5 }, () => ({ minutes, variation, machines: 1, jams: false })),
  release: { kind: 'busy' },
})

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'pile',
    title: 'Where does the work pile up?',
    text: 'Run the shift and watch where robots pile up. Then tie a rope to that station and run the same day again. Compare the robots shipped, and the robots on the floor.',
    setup: DEFAULT_SETUP,
  },
  {
    id: 'perfect',
    title: 'The perfect line',
    text: 'Five stations, each exactly 4 minutes a robot: 120 a shift on paper. Run it. Then give every station lots of variation, still 4 minutes on average, and run the same day. Does the line still ship as many?',
    setup: even(4, 'none'),
  },
  {
    id: 'jams',
    title: 'Which jams cost robots?',
    text: "Cut jams now and then. Run the shift, then move the jams to Paint (Cut's off, Paint's on) and run the same day. Which jams cost robots, and why?",
    setup: changeStation(DEFAULT_SETUP, 0, { jams: true }),
  },
  {
    id: 'next',
    title: 'The next constraint',
    text: 'The rope is tied to Paint, the slowest station. Give Paint a second machine and run the same day. Where do robots pile up now? Try moving the rope there.',
    setup: changeStation({ ...DEFAULT_SETUP, release: { kind: 'rope', station: 2, length: 10 } }, 3, { minutes: 3.5 }),
  },
  {
    id: 'rope',
    title: 'How long a rope?',
    text: "Mold jams now and then, and a rope of 2 keeps almost nothing waiting for Paint. Try ropes of 2, 5, 10, and 20 on the same day. What's the shortest rope that keeps Paint busy?",
    setup: { ...changeStation(DEFAULT_SETUP, 1, { jams: true }), release: { kind: 'rope', station: 2, length: 2 } },
  },
]
