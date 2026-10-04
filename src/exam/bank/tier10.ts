import { choice, forTier, truth } from './make.ts'

// Tier 10, Everyday problems: absences, overtime, maintenance, rework, and power cuts.
export const tier10 = forTier(10, [
  choice(
    '10-1',
    'tier10-power-cut',
    'A power cut stops every station in a factory for an hour. After the power returns, which statement is most accurate?',
    "The constraint's lost hour is lost for good, but the other stations can catch up",
    [
      'Every station has lost the same output for good, since all of them stopped',
      'No output has been lost, because the stations can catch up afterward',
      'Only the stations before the constraint have lost output for good',
    ],
    "Only the constraint's lost time costs output. The other stations have spare time, so they catch up. The constraint cannot, because it has none.",
  ),
  choice(
    '10-2',
    'tier10-short-handed',
    "A clinic's X-ray room is its constraint, and many patients are already waiting for it. For the next hour, one X-ray technician and one check-in clerk are away, and a single spare person can cover only one of the two jobs. Which job should they cover?",
    'The X-ray room, because the check-in desk can catch up afterward',
    ['The check-in desk, because it can serve more patients an hour than the X-ray room', 'Half an hour on each, so that each keeps up', 'Whichever job has the shorter line'],
    "When someone is away, cover the constraint first. Its hours are the clinic's hours. The check-in desk has spare time, and patients are already waiting, so leaving it idle costs little.",
  ),
  choice(
    '10-3',
    'tier10-maintenance',
    'When should regular maintenance on the constraint be scheduled?',
    'At a time it is stopped anyway, such as a planned shutdown',
    [
      'In the middle of the busiest shift, so that the repair is fresh',
      'Whenever it suits the other stations best, since they have spare time',
      'Rarely, since a stop at the constraint costs output and breakdowns are uncommon',
    ],
    'Maintenance during production takes minutes the whole factory cannot get back, so choose a time the constraint would be stopped anyway. Skipping it is not the answer: a breakdown costs more.',
  ),
  choice(
    '10-4',
    'tier10-rework',
    'Defective parts are sent back through the constraint to be made again. What does this do?',
    "It uses the constraint's time twice on the same part, so less ships",
    [
      'No change, because the parts already exist and only need a little more work',
      "It saves the constraint's time, because the part is mostly finished",
      'It raises output, because more parts pass through the constraint',
    ],
    'Rework that loops back through the constraint takes its time twice. Fix quality before the constraint, so rework does not use up the one resource the factory is short of.',
  ),
  choice(
    '10-5',
    'tier10-first-candle',
    'A station that is not the constraint has spare time. How can it help the constraint?',
    'By using its spare time to prepare or check work for the constraint',
    [
      'By running faster than the constraint, to build a big pile in front of it',
      'By staying busy as much as it can, so its machines are not idle',
      'By sending parts on the moment they are made, however many are already waiting',
    ],
    "Spare time at a station that is not the constraint is worth spending on protecting the constraint's work, for example by checking parts before they reach it.",
  ),
  truth(
    '10-6',
    'tier10-overtime',
    "Overtime at a station that already has spare time does not raise the factory's output.",
    true,
    "The constraint still sets the pace, so extra hours elsewhere only make parts that wait. Overtime pays at the constraint, where each extra hour is an extra hour for the whole factory.",
  ),
  truth(
    '10-7',
    'tier10-short-handed',
    'When staff are short, it usually works best to spread the people evenly so that every station is equally busy.',
    false,
    "Cover the constraint first, even if that leaves a faster station idle. Spreading people thin can leave the constraint short, and its lost hours are the whole factory's.",
  ),
  truth(
    '10-8',
    'tier10-rework',
    "Rework that goes back through the constraint takes the constraint's time twice.",
    true,
    "The part has already used some of the constraint's limited time once. Making it again uses the same scarce time a second time, so the factory ships less.",
  ),
])
