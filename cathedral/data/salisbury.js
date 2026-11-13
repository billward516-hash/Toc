// Salisbury Cathedral: an Early English Gothic nave bay (pointed arches, lancets, dark marble shafts).
// Facts in `intro` are from memory and NOT yet checked against sources (verified: false).
const lancets = [149, 183, 217].map((c) => `M${c - 11} 62V46Q${c - 11} 34 ${c} 24Q${c + 11} 34 ${c + 11} 46V62Z`).join('')
const roundHeads = [149, 183, 217].map((c) => `M${c - 11} 62V50A11 11 0 0 1 ${c + 11} 50V62Z`).join('')
const openings = [118, 183, 248].map((c) => `M${c - 16} 105V92Q${c - 16} 82 ${c} 72Q${c + 16} 82 ${c + 16} 92V105Z`).join('')
const leaves = [200, 206].map((y) => `M262 ${y}Q268 ${y - 5} 276 ${y}Q284 ${y - 5} 290 ${y}`).join('')
const ribs = Array.from({ length: 13 }, (_, i) => `M${72 + i * 18} 12L${78 + i * 18} 20`).join('')

;(globalThis.CATHEDRALS = globalThis.CATHEDRALS || []).push({
  id: 'salisbury',
  name: 'Salisbury Cathedral',
  place: 'Salisbury, England',
  period: 'Early English Gothic',
  blurb: 'Pointed arches and lancet windows',
  intro: {
    verified: false,
    title: 'Salisbury Cathedral',
    kicker: 'Early English Gothic · begun 1220',
    lines: [
      'Building began in 1220 on a new site, and the main body was finished in about forty years, which is quick for a medieval cathedral.',
      'Because it was built in one go, it is unusually consistent in style, with tall pointed lancet windows.',
      'Slender shafts of dark Purbeck marble contrast with the pale limestone.',
      'Its spire, added in the 14th century, is the tallest of any medieval church in Britain.',
      'The chapter house keeps one of the four surviving originals of Magna Carta.',
    ],
  },
  phases: [
    {
      id: 'bay',
      name: 'A nave bay',
      viewBox: [44, 0, 278, 312],
      ground: 300,
      glow: [66, 20, 234, 85],
      silhouette: true,
      slotStyle: 'box',
      idleOfferMs: 35000,
      pieces: [
        { id: 'baseL', name: 'Moulded base', tone: '#9a9384', box: [62, 288, 56, 12], needs: [],
          d: 'M62 288H118V300H62Z' },
        { id: 'baseR', name: 'Pier base', tone: '#9a9384', box: [248, 286, 56, 14], needs: [],
          d: 'M248 300V294H254V288H298V294H304V300Z' },
        { id: 'pierL', name: 'Wall shaft', tone: '#b3ab98', box: [72, 208, 36, 80], needs: ['baseL'],
          d: 'M72 208H108V288H72Z', marks: '<path class="mark" d="M80 208V288M90 208V288M100 208V288"/>' },
        { id: 'columnR', name: 'Marble-shafted pier', tone: '#bdb39d', box: [258, 208, 36, 80], needs: ['baseR'],
          d: 'M258 208H294V288H258Z', marks: '<path class="mark dark" d="M266 208V288M276 208V288M286 208V288"/>' },
        { id: 'capL', name: 'Moulded capital', tone: '#cbbfa5', box: [66, 192, 48, 16], needs: ['pierL'],
          d: 'M72 208L66 192H114L108 208Z' },
        { id: 'capR', name: 'Stiff-leaf capital', tone: '#cbbfa5', box: [252, 192, 48, 16], needs: ['columnR'],
          d: 'M258 208Q252 200 252 192H300Q300 200 294 208Z', marks: `<path class="mark" d="${leaves}"/>` },
        { id: 'arch', name: 'Pointed arch', tone: '#d3c6a7', box: [96, 106, 174, 86], needs: ['capL', 'capR'],
          d: 'M96 192Q98 130 183 106Q268 130 270 192L252 192Q250 140 183 124Q116 140 114 192Z' },
        { id: 'spandrel', name: 'Wall above the arch', tone: '#a39b8b', box: [66, 105, 234, 87], needs: ['arch'],
          d: 'M66 192L66 105L300 105L300 192L270 192Q268 130 183 106Q98 130 96 192Z' },
        { id: 'gallery', name: 'Triforium', tone: '#b6ad99', box: [66, 62, 234, 43], needs: ['spandrel'],
          d: `M66 62H300V105H66Z${openings}` },
        { id: 'clerestory', name: 'Clerestory wall', tone: '#aaa190', box: [66, 20, 234, 42], needs: ['gallery'],
          d: `M66 62V20H300V62Z${lancets}` },
        { id: 'window', name: 'Triple lancets', tone: '#6f8fb0', box: [138, 24, 90, 38], needs: ['clerestory'],
          d: lancets },
        { id: 'cornice', name: 'Parapet', tone: '#9a9384', box: [60, 12, 246, 8], needs: ['clerestory'],
          d: 'M60 20V12H306V20Z', marks: `<path class="mark" d="${ribs}"/>` },
      ],
      decoys: [
        { id: 'xRound', name: 'Round arch', tone: '#d3c6a7', box: [96, 105, 174, 87],
          d: 'M96 192A87 87 0 0 1 270 192L252 192A69 69 0 0 0 114 192Z',
          reaction: 'A round arch is Romanesque. This bay is pointed.' },
        { id: 'xChevron', name: 'Zigzag column', tone: '#bdb39d', box: [258, 208, 36, 80],
          d: 'M258 208H294V288H258Z', marks: '<path class="mark" d="M258 216l9 10 l9 -10 l9 10 l9 -10M258 240l9 10 l9 -10 l9 10 l9 -10M258 264l9 10 l9 -10 l9 10 l9 -10"/>',
          reaction: 'Handsome, but zigzag columns belong to an older style.' },
        { id: 'xRoundWin', name: 'Round-headed windows', tone: '#6f8fb0', box: [138, 29, 90, 33],
          d: roundHeads,
          reaction: 'Round-headed windows. Here they are slender and pointed.' },
      ],
    },
  ],
})
