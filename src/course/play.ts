import type { OverviewSection } from './types.ts'

// The Play Store edition (src/edition.ts) has no class mode, no shared-device switching, and no full-screen
// button, so its "Get started" page leaves out the lines about them, and says nothing about iPads or an
// instructor's screen. Lines are matched by their opening words, and play.test.ts checks that none of the
// words of a feature this edition lacks is left, so a reworded line there fails the test, not the learner.
const LEFT_OUT = ['Full screen:', 'Switch player', 'On an iPad', 'If your instructor', "Your instructor's class screen"]

export function forPlay(sections: OverviewSection[]): OverviewSection[] {
  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) =>
      block.kind === 'list'
        ? { ...block, items: block.items.filter((item) => !LEFT_OUT.some((start) => item.startsWith(start))).map((item) => item.replace(', even in a class', '')) }
        : block,
    ),
  }))
}
