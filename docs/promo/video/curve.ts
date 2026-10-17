// Writes the lab's first-round cycle-time curve (the average of 20 days) to a JSON file, for the video's
// chart. Run from the repository root: npx vite-node docs/promo/video/curve.ts <out.json>
import { writeFileSync } from 'node:fs'
import { loadCurve } from '../../../src/loading/curve.ts'
import { noUpgrades, workTime } from '../../../src/loading/lines.ts'
import { ROUND_ONE } from '../../../src/loading/rounds.ts'

const rates = [8, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24]
const points = loadCurve(ROUND_ONE.minutes, noUpgrades(ROUND_ONE.minutes), rates, 20)
writeFileSync(process.argv[2], JSON.stringify({ work: workTime(ROUND_ONE.minutes), points: points.map((p) => ({ rate: p.rate, load: p.load, cycle: p.cycle, waiting: p.waiting, shipped: p.shipped })) }, null, 1))
