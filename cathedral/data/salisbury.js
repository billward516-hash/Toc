// Salisbury Cathedral: Early English Gothic. Phase 1 a nave bay; phase 2 the tower and spire.
// Facts in `intro` are from memory and NOT yet checked against sources (verified: false).
{
const { chain, archStones } = globalThis.CBShapes
const outer = chain([[[96, 192], [98, 130], [183, 106]], [[183, 106], [268, 130], [270, 192]]])
const inner = chain([[[114, 192], [116, 140], [183, 124]], [[183, 124], [250, 140], [252, 192]]])
const stones = archStones(outer, inner)
const steep = archStones(
  chain([[[96, 192], [96, 120], [183, 100]], [[183, 100], [270, 120], [270, 192]]]),
  chain([[[114, 192], [114, 130], [183, 118]], [[183, 118], [252, 130], [252, 192]]]),
)
const wide = archStones(
  chain([[[96, 192], [100, 134], [183, 110]], [[183, 110], [266, 134], [270, 192]]]),
  chain([[[114, 192], [120, 150], [183, 134]], [[183, 134], [246, 150], [252, 192]]]),
)
const lancets = [149, 183, 217].map((c) => `M${c - 11} 62V46Q${c - 11} 34 ${c} 24Q${c + 11} 34 ${c + 11} 46V62Z`).join('')
const roundHeads = [149, 183, 217].map((c) => `M${c - 11} 62V50A11 11 0 0 1 ${c + 11} 50V62Z`).join('')
const openings = [118, 183, 248].map((c) => `M${c - 16} 105V92Q${c - 16} 82 ${c} 72Q${c + 16} 82 ${c + 16} 92V105Z`).join('')
const leaves = [200, 206].map((y) => `M262 ${y}Q268 ${y - 5} 276 ${y}Q284 ${y - 5} 290 ${y}`).join('')
const ribs = Array.from({ length: 13 }, (_, i) => `M${72 + i * 18} 12L${78 + i * 18} 20`).join('')
const blind = [125, 154, 183, 212, 241].map((c) => `M${c - 10} 12V-18Q${c - 10} -30 ${c} -36Q${c + 10} -30 ${c + 10} -18V12`).join('')
const belfry = [140, 167, 199, 226].map((c) => `M${c - 7} -56V-80Q${c - 7} -92 ${c} -100Q${c + 7} -92 ${c + 7} -80V-56Z`).join('')
const roundBelfry = [140, 167, 199, 226].map((c) => `M${c - 7} -56V-84A7 7 0 0 1 ${c + 7} -84V-56Z`).join('')
const flowers = Array.from({ length: 14 }, (_, i) => `M${112 + i * 10.5} -53h2`).join('')

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
      blurb: 'Build one bay of the nave, from the ground up.',
      viewBox: [44, 0, 278, 330],
      ground: 300,
      glow: [[66, 20, 234, 85]],
      silhouette: true,
      slotStyle: 'none',
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
        { id: 'a1', name: 'Left springer', tone: '#d3c6a7', ...stones[0], needs: ['capL'] },
        { id: 'a5', name: 'Right springer', tone: '#d3c6a7', ...stones[4], needs: ['capR'] },
        { id: 'a2', name: 'Left arch stone', tone: '#d3c6a7', ...stones[1], needs: ['a1'] },
        { id: 'a4', name: 'Right arch stone', tone: '#d3c6a7', ...stones[3], needs: ['a5'] },
        { id: 'key', name: 'Keystone', tone: '#ddd0b0', ...stones[2], needs: ['a2', 'a4'] },
        { id: 'spandrel', name: 'Wall above the arch', tone: '#a39b8b', box: [66, 105, 234, 87], needs: ['key'],
          d: 'M66 192L66 105L300 105L300 192L270 192Q268 130 183 106Q98 130 96 192Z' },
        { id: 'gallery', name: 'Triforium', tone: '#b6ad99', box: [66, 62, 234, 43], needs: ['spandrel'],
          d: `M66 62H300V105H66Z${openings}` },
        { id: 'clerestory', name: 'Clerestory wall', tone: '#aaa190', box: [66, 20, 234, 42], needs: ['gallery'],
          d: `M66 62V20H300V62Z${lancets}` },
        { id: 'window', name: 'Triple lancets', tone: '#6f8fb0', box: [138, 24, 90, 38], needs: ['clerestory'],
          d: lancets, marks: '<path class="mark" d="M149 24V62M183 24V62M217 24V62"/>' },
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
          d: roundHeads, reaction: 'Round-headed windows. Here they are slender and pointed.' },
        { id: 'xRose', name: 'Rose window', tone: '#6f8fb0', box: [150, 24, 34, 34],
          d: 'M167 24A17 17 0 1 1 167 58A17 17 0 1 1 167 24Z', marks: '<path class="mark" d="M167 24V58M150 41H184M155 29L179 53M179 29L155 53"/>',
          reaction: 'A rose window is grand, but not for a wall of lancets.' },
        { id: 'xBlockCap', name: 'Block capital', tone: '#cbbfa5', box: [252, 192, 48, 16],
          d: 'M258 208L252 192H300L294 208Z', reaction: 'Too plain: this pier takes carved leaves.' },
        { id: 'xSteep', name: 'Steep springer', tone: '#d3c6a7', ...steep[0],
          reaction: 'Close, but cut for a steeper arch.' },
        { id: 'xWide', name: 'Broad keystone', tone: '#ddd0b0', ...wide[2],
          reaction: 'Close, but too broad for this arch.' },
        { id: 'xPlainPier', name: 'Plain pier', tone: '#bdb39d', box: [258, 208, 36, 80],
          d: 'M258 208H294V288H258Z', reaction: 'This pier is ringed with slender dark shafts.' },
      ],
    },
    {
      id: 'spire',
      name: 'The tower and spire',
      blurb: 'Raise the tower, then the spire.',
      viewBox: [44, -285, 278, 615],
      ground: 300,
      glow: [[133, -100, 100, 44]],
      silhouette: false,
      labels: false,
      slotStyle: 'none',
      idleOfferMs: 35000,
      pieces: [
        { id: 'tower1', name: 'Tower, lower stage', tone: '#aaa190', box: [110, -50, 146, 62], needs: ['cornice'],
          d: 'M110 12V-50H256V12Z', marks: `<path class="mark" d="${blind}"/>` },
        { id: 'band', name: 'Ballflower band', tone: '#8d857a', box: [106, -56, 154, 6], needs: ['tower1'],
          d: 'M106 -50V-56H260V-50Z', marks: `<path class="mark" d="${flowers}"/>` },
        { id: 'tower2', name: 'Tower, belfry stage', tone: '#b0a794', box: [110, -104, 146, 48], needs: ['band'],
          d: `M110 -56V-104H256V-56Z${belfry}` },
        { id: 'belfryGlass', name: 'Belfry lancets', tone: '#6f8fb0', box: [133, -100, 100, 44], needs: ['tower2'],
          d: belfry, marks: '<path class="mark" d="M140 -100V-56M167 -100V-56M199 -100V-56M226 -100V-56"/>' },
        { id: 'pinnacles', name: 'Angle pinnacles', tone: '#c3b89f', box: [110, -142, 146, 38], needs: ['tower2'],
          d: 'M110 -104V-120L118 -142L126 -120V-104ZM240 -104V-120L248 -142L256 -120V-104Z' },
        { id: 'broach', name: 'Spire base', tone: '#a39b8b', box: [130, -150, 106, 46], needs: ['tower2'],
          d: 'M130 -104H236L210 -150H156Z' },
        { id: 'lights', name: 'Spire lights', tone: '#6f8fb0', box: [168, -136, 30, 18], needs: ['broach'],
          d: 'M168 -118V-128L174 -136L180 -128V-118ZM186 -118V-128L192 -136L198 -128V-118Z' },
        { id: 'spire1', name: 'Spire, lower', tone: '#b6ad99', box: [156, -200, 54, 50], needs: ['broach'],
          d: 'M156 -150H210L198 -200H168Z' },
        { id: 'spire2', name: 'Spire, upper', tone: '#c3b89f', box: [168, -246, 30, 46], needs: ['spire1'],
          d: 'M168 -200H198L190 -246H176Z' },
        { id: 'finial', name: 'Cross finial', tone: '#8a7a55', box: [177, -274, 12, 28], needs: ['spire2'],
          d: 'M178 -246H188L183 -258ZM182 -258V-274H184V-258ZM177 -268H189V-266H177Z' },
      ],
      decoys: [
        { id: 'xOnion', name: 'Onion dome', tone: '#6d6a72', box: [160, -290, 46, 40],
          d: 'M162 -246Q150 -266 183 -290Q216 -266 204 -246Z', reaction: 'Not this far north.' },
        { id: 'xCone', name: 'Low cone', tone: '#a39b8b', box: [150, -190, 66, 40],
          d: 'M150 -150H216L183 -190Z', reaction: 'Too stubby. This spire is slender.' },
        { id: 'xRoundBelf', name: 'Round-headed belfry', tone: '#6f8fb0', box: [133, -92, 100, 36],
          d: roundBelfry, reaction: 'Round heads, but this tower is pointed.' },
        { id: 'xOnePin', name: 'Single pinnacle', tone: '#c3b89f', box: [110, -142, 16, 38],
          d: 'M110 -104V-120L118 -142L126 -120V-104Z', reaction: 'A pinnacle for each corner, please.' },
        { id: 'xPlainBand', name: 'Plain string course', tone: '#8d857a', box: [106, -56, 154, 6],
          d: 'M106 -50V-56H260V-50Z', reaction: 'This band is decorated with little flowers.' },
        { id: 'xStout', name: 'Stout spire', tone: '#b6ad99', box: [150, -215, 66, 65],
          d: 'M150 -150H216L200 -215H166Z', reaction: 'Close, but cut for a different spire.' },
        { id: 'xBall', name: 'Ball finial', tone: '#8a7a55', box: [176, -262, 14, 16],
          d: 'M183 -262A7 7 0 1 1 183 -248A7 7 0 1 1 183 -262Z', reaction: 'A ball is a fine ornament, but this spire wears a cross.' },
      ],
    },
  ],
})
}
