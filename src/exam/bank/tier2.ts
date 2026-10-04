import { choice, forTier, truth } from './make.ts'

// Tier 2, Variation and dependent steps: why a line ships less than its averages promise.
export const tier2 = forTier(2, [
  choice(
    '2-1',
    'tier2-dice',
    'Two stations in a row each average 10 parts an hour, and each varies from hour to hour. The line starts empty, and parts are always available to the first station. Over a typical 8-hour shift, how many parts an hour does the line ship?',
    'Fewer than 10, because slow hours are passed on and fast hours are wasted',
    ['Exactly 10, because the highs and lows average out over the shift', 'More than 10, because the fast hours more than make up for the slow ones', 'About 20, because there are two stations, each making 10'],
    'When the second station has a slow hour, parts wait for it. When it has a fast hour, it can only use the parts the first station has already finished. Slow hours are passed on and fast hours are wasted, so the line ships less than either average.',
  ),
  choice(
    '2-2',
    'tier2-dice',
    'In a line of dependent steps, why is a fast stretch at a station often wasted?',
    'A station can only work on parts it has been handed, so spare speed does nothing',
    [
      "Fast stretches use up the station's materials sooner, so it has to wait for more later",
      'Parts made in a hurry are made badly, so most are thrown away later',
      'The station before it slows down whenever this one speeds up',
    ],
    'Each step needs the work of the one before it. A step that is fast for an hour can only finish the parts that have reached it, so the extra speed is lost, while a slow hour holds up everything after it.',
  ),
  choice(
    '2-3',
    'tier2-pace',
    'A constraint can finish 12 jobs an hour on average, and jobs are released into the line at exactly 12 an hour. Each step varies from job to job. What tends to happen at the constraint over a long day?',
    'Slow stretches leave work behind, and with no slack the pile tends to grow',
    [
      "Little or no pile builds up, because work arrives at the constraint's own speed",
      'The constraint sits idle most of the day, because work arrives too slowly',
      'Piles form during slow stretches, but each one clears again before the next begins',
    ],
    'With no slack, the constraint has no spare time to catch up after a slow stretch, so every one leaves a pile behind. Releasing work a little slower than its average lets the constraint work the piles off.',
  ),
  choice(
    '2-4',
    'tier2-pace',
    'Each step in a line varies from job to job. Orders are released into the line on a fixed schedule, not tied to what the constraint has actually finished. To keep piles from growing without limit, while not leaving the constraint idle much of the time, how fast should new work be released?',
    "A little slower than the constraint's average speed",
    ["Exactly as fast as the constraint's average speed", "A little faster than the constraint's average speed, so it is not short of work", 'As fast as the first station can take it'],
    "Releasing a little slower than the constraint's average gives it slack to catch up after slow stretches. At or above its speed, piles keep growing and every order waits longer, with no extra output.",
  ),
  choice(
    '2-5',
    'tier2-dice',
    'Which of these is a set of dependent steps, where each step needs the output of the one before it?',
    'Cutting, painting, and boxing parts, in that order',
    ['Three cashiers serving customers at the same store', 'Three writers working on reports', 'Three machines making different products'],
    'Steps are dependent when each one needs the work of the one before it, so a delay passes down the line. Independent workers each keep their own pace, so their ups and downs average out.',
  ),
  truth(
    '2-6',
    'tier2-dice',
    'In a line of dependent steps, fast stretches make up for slow stretches, so variation does not change how much the line ships.',
    false,
    'Delays pass down the line and add up, but a fast stretch can only use the parts that have reached it. Variation takes output away and does not give it back.',
  ),
  truth(
    '2-7',
    'tier2-pace',
    'Once work is released faster than the constraint can finish it, releasing it faster still makes the line ship more.',
    false,
    'Once work arrives faster than the constraint can finish it, the line ships no more, however fast it is released. The extra only piles up, so every order waits longer.',
  ),
  truth(
    '2-8',
    'tier2-dice',
    'Variation in job times reduces the output of a line of dependent steps, but not the long-run output of independent workers who each finish their own jobs.',
    true,
    'For independent workers, a fast job and a slow job average out. In a chain, each step waits on the one before it, so delays are passed on and gains are lost.',
  ),
])
