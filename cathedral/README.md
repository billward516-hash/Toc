# Cathedral Builder (working title)

A casual puzzle game: build real cathedrals from a tray of pieces, some of which are decoys.
Design summary: drafted 12 November 2026 (not stored in this repository).

## Play it

Open `index.html` in a browser (no build, no server needed), or serve the folder. It saves progress
in the browser. Useful URL options for testing:

- `?idle=3000` offers a hint after 3 seconds without a placement (the default is 35 seconds)
- `?silhouette=0` hides the faint silhouette of the finished section (the "mystery" layer)
- `?slots=box` shows dashed boxes marking the open places (an easier mode; the default is none)

## How it is built

- `rules.js`: the dependency rule, hint order, save cleaning, hint wording. No DOM, no randomness.
- `data/shapes.js`: helpers that cut arches and flying arches into stones
- `data/*.js`: one file per cathedral (pieces, shapes, order, decoys, history card). Add a file and a
  `<script>` tag in `index.html` to add a cathedral. A piece is `{ id, name, tone, box, needs, d, marks }`;
  `needs` lists what it rests on, and the order of `pieces` is the build order the hint follows.
- `game.js`: screens, tap-to-place with generous snapping, hint button and idle offer, sound
  (synthesized, no files), vibration where supported, the finishing flourish.
- `test/cathedral.test.js`: checks every phase (12 pieces, 3 decoys, order valid, decoys refused). Run with `npm test`.

## Trial build

Three cathedrals, two phases each, and phase 2 builds on phase 1 (it starts with phase 1 standing):

- Durham (Romanesque): a nave bay, then the central tower
- Salisbury (Early English Gothic): a nave bay, then the tower and spire
- Notre-Dame de Paris (Gothic): a wall and flying buttress, then the roof and spire

Difficulty is deliberately up: 16-piece first phases, with arches cut stone by stone and a flying arch in
three stones; decoys are about half the tray, many of them near-copies cut slightly wrong; no dashed boxes
mark the open places; and phase 2 also drops the faint silhouette and the piece labels, so a piece is
known by its shape alone. Hints stay unlimited and unpenalized. Each build-again reshuffles the tray.

Look: stone is drawn procedurally (grain and relief from SVG lighting filters, mortar courses, light and
shade, cast shadows) over a dusk sky. It is not photographic. A real photographic look needs photo or
generated stone textures; the `ashlar` pattern and `stoneTex` filter in `game.js` are where they would plug in.

## Before release

- **The history cards are unverified.** They were written from memory and carry `verified: false`
  (the card says so). Check every name, date and claim against a reliable source before anyone else sees it.
- The decoys' reaction lines are tone, not fact, but read them too.
- Order, similarity of decoys and the dashed boxes are the difficulty levers to tune after watching people play.
