import { cases as caseList, rows, type Case } from './cases.ts'
import { periodName, type Factory } from './model.ts'

// The cases as a PowerPoint file: a title, one table, and the plain meaning of each way of looking. The
// library loads only when someone asks for the file.
export async function deck(f: Factory, list: Case[] = caseList(f)): Promise<Blob> {
  const { default: Pptx } = await import('pptxgenjs')
  const pptx = new Pptx()
  pptx.layout = 'LAYOUT_WIDE'
  const ink = '1F2544'
  const title = pptx.addSlide()
  title.addText('My factory: too low, midpoint, too high', { x: 0.6, y: 1.8, w: 12, h: 1, fontSize: 36, bold: true, color: ink })
  title.addText(
    `${f.steps.length} workgroups. Cycle time wanted: ${f.target} h. Units counted per ${periodName(f)}. Made from numbers typed into the game; nothing was sent anywhere.`,
    { x: 0.6, y: 3, w: 12, h: 1.2, fontSize: 18, color: '62688A' },
  )
  const table = pptx.addSlide()
  table.addText('Three ways of looking at demand, and at batch size', { x: 0.5, y: 0.3, w: 12.3, h: 0.7, fontSize: 26, bold: true, color: ink })
  const [head, ...body] = rows(f, list)
  const cell = (text: string, bold = false, fill?: string) => ({ text, options: { bold, color: bold ? 'FFFFFF' : ink, fill: { color: fill ?? 'FFFFFF' }, fontSize: 13 } })
  table.addTable(
    [head.map((text) => cell(text, true, ink)), ...body.map((row) => row.map((text, i) => cell(text, false, i === 8 ? (text === 'yes' ? 'D5F3E3' : 'FBD9DA') : undefined)))],
    { x: 0.5, y: 1.2, w: 12.3, border: { type: 'solid', pt: 1, color: 'C9C2B3' }, align: 'center', valign: 'middle', rowH: 0.5 },
  )
  table.addText(
    'Demand: the midpoint is just inside the most the factory can take and still meet the cycle time wanted, too low is half of that, and too high is nearly all the factory can make. Batch size: smallest, middle, and largest, at the demand asked for.',
    { x: 0.5, y: 5.6, w: 12.3, h: 1.2, fontSize: 14, color: '62688A' },
  )
  return (await pptx.write({ outputType: 'blob' })) as Blob
}
