# Cathedral Builder (working title)

A casual puzzle game: build real cathedrals from a tray of pieces, some of which are decoys.
Design summary: drafted 12 November 2026 (not stored in this repository).

## Play it

Open `index.html` in a browser (no build, no server needed), or serve the folder. It saves progress
in the browser. Useful URL options for testing:

- `?idle=3000` offers a hint after 3 seconds without a placement (the default is 35 seconds)
- `?silhouette=0` hides the faint silhouette of the finished section (the "mystery" layer)
- `?slots=none` hides the dashed boxes that mark open places, so placement is by recognition alone

## How it is built

- `rules.js`: the dependency rule, hint order, save cleaning, hint wording. No DOM, no randomness.
- `data/*.js`: one file per cathedral (pieces, shapes, order, decoys, history card). Add a file and a
  `<script>` tag in `index.html` to add a cathedral. A piece is `{ id, name, tone, box, needs, d, marks }`;
  `needs` lists what it rests on, and the order of `pieces` is the build order the hint follows.
- `game.js`: screens, tap-to-place with generous snapping, hint button and idle offer, sound
  (synthesized, no files), vibration where supported, the finishing flourish.
- `test/cathedral.test.js`: checks every phase (12 pieces, 3 decoys, order valid, decoys refused). Run with `npm test`.

## Trial build

Three cathedrals, phase 1 only: Durham (Romanesque), Salisbury (Early English Gothic), Notre-Dame de
Paris (Gothic, a wall and flying buttress). Phase 1 is the whole prototype scope: tap to select, tap to
place, bounce on a wrong choice, support links on a correct one, hints counted as requested or offered
(never penalized), and a completion card with the counts.

## Before release

- **The history cards are unverified.** They were written from memory and carry `verified: false`
  (the card says so). Check every name, date and claim against a reliable source before anyone else sees it.
- The decoys' reaction lines are tone, not fact, but read them too.
- Order, similarity of decoys and the dashed boxes are the difficulty levers to tune after watching people play.
