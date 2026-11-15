# Cathedral Builder (working title)

A casual puzzle game: build real cathedrals from a tray of pieces, some of which are decoys.
Design summary: drafted 12 November 2026 (not stored in this repository).

## Play it

Open `index.html` in a browser (no build, no server needed), or serve the folder. It saves progress
in the browser. Useful URL options for testing:

- `?idle=3000` offers a hint after 3 seconds without a placement (the default is 35 seconds)
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

Difficulty ramps up across the six phases in play order (`previewMs`, `decoyCount`, `labels` on each phase):

- A faint silhouette of the finished structure is always there (`subtle`, on in every phase except the last).
- A bold dashed outline of it shows up front for `previewMs` (7 s in Durham 1, down to 2 s in
  Notre-Dame 2), then fades. The Outline button brings it back for 3.5 s, as often as asked. Peeks are counted
  and shown on the completion card, never penalized. Nothing marks where a piece goes, so it is not painting by numbers.
- Decoys rise from 3 (Durham 1) to 4, 5, 6, 7 and 7. They are listed easiest first, and a phase shows the first `decoyCount`.
- The last phase also drops the piece labels, so a piece is known by its shape alone.
- Arches are cut stone by stone, so order matters throughout. Hints stay unlimited and unpenalized.
  Each build-again reshuffles the tray.

Look: stone is drawn procedurally (grain and relief from SVG lighting filters, mortar courses, light and
shade, cast shadows) over a dusk sky. It is not photographic. A real photographic look needs photo or
generated stone textures; the `ashlar` pattern and `stoneTex` filter in `game.js` are where they would plug in.

## Before release

- **The history cards are unverified.** They were written from memory and carry `verified: false`
  (the card says so). Check every name, date and claim against a reliable source before anyone else sees it.
- The decoys' reaction lines are tone, not fact, but read them too.
- Order, similarity of decoys and the dashed boxes are the difficulty levers to tune after watching people play.
