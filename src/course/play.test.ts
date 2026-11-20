import { describe, expect, it } from 'vitest'
import { gettingStarted } from './learner.ts'
import { labGettingStarted } from './lab.ts'
import { forPlay } from './play.ts'

const words = (sections: typeof gettingStarted) =>
  sections.flatMap((section) => section.blocks.flatMap((block) => (block.kind === 'p' ? [block.text] : block.kind === 'list' ? block.items : [])))

describe('the Play edition course guide', () => {
  const shown = words(forPlay([...gettingStarted, ...labGettingStarted]))

  it('is not empty, and keeps most of the page', () => {
    expect(shown.length).toBeGreaterThan(words([...gettingStarted, ...labGettingStarted]).length - 7)
  })

  it('never mentions what this edition does not have', () => {
    for (const text of shown) expect(text).not.toMatch(/class\b|instructor|trainer|switch player|full screen|ipad|print|my factory/i)
  })
})
