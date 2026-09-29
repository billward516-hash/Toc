import { duration, fillCourse, formatMinutes } from './summary.ts'
import { branches, formats, overview } from './overview.ts'
import { clockAt, resolvedSession, type ResolvedPlay, type ResolvedSession } from './resolve.ts'
import { sessions } from './sessions/index.ts'
import type { Step, StepKind } from './types.ts'

const LABEL: Record<StepKind, string> = { say: 'Say', ask: 'Ask', do: 'Do', look: 'Look for', tip: 'Tip' }

const step = (s: Step): string => {
  const text = s.kind === 'say' ? `"${s.text}"` : s.text
  return `- **${LABEL[s.kind]}:** ${text}${s.note ? `\n  *${s.note}*` : ''}`
}

function play(segment: ResolvedPlay): string[] {
  return [
    `#### ${segment.number} ${segment.title} (${segment.minutes} minutes)`,
    '',
    `*Principles: ${segment.principles.join('; ')}.*`,
    '',
    `**Key idea:** ${segment.idea}`,
    '',
    '**Set up**',
    ...segment.setup.map(step),
    '',
    `**While they play** (about ${segment.play} minutes)`,
    ...segment.during.map(step),
    ...segment.watch.map((w) => `- ${w}`),
    '',
    '**Debrief**',
    ...segment.debrief.map(step),
    '',
    '**Common wrong turns**',
    ...segment.mistakes.map((m) => `- ${m}`),
    '',
    '**Answer**',
    ...segment.answer.map((line) => `- ${line}`),
    '',
  ]
}

function session(resolved: ResolvedSession): string[] {
  const { core, optional } = resolved.minutes
  const lines = [
    `## Session ${resolved.tier}: ${resolved.name}`,
    '',
    `*About ${duration(core)}${optional ? `, plus ${optional} minutes if you run the optional part` : ''}.*`,
    '',
    resolved.summary,
    '',
    '**By the end, learners can:**',
    ...resolved.objectives.map((o) => `- ${o}`),
    '',
    '**Before the session**',
    ...resolved.before.map((b) => `- ${b}`),
    '',
    '**Run of show**',
    '',
    '| Time | Segment | Minutes |',
    '| --- | --- | --- |',
    ...resolved.segments.map((segment, i) => {
      const start = resolved.starts[i]
      const name = segment.kind === 'play' ? `${segment.number} ${segment.title}` : `${segment.title}${segment.optional ? ' (optional)' : ''}`
      return `| ${start === null ? 'any time' : clockAt(start)} | ${name} | ${segment.minutes} |`
    }),
    '',
  ]
  for (const segment of resolved.segments) {
    if (segment.kind === 'play') lines.push(...play(segment))
    else lines.push(`#### ${segment.title}${segment.optional ? ' (optional)' : ''} (${segment.minutes} minutes)`, '', ...segment.steps.map(step), '')
  }
  lines.push('**If you are short of time**', ...resolved.short.map((s) => `- ${s}`), '', '**If you have time to spare**', ...resolved.extend.map((s) => `- ${s}`), '')
  return lines
}

// The whole trainer's script as one Markdown document, to print, save, or paste elsewhere.
export function scriptMarkdown(): string {
  const lines = ['# TOC Factory: trainer guide and script', '']
  for (const section of overview) {
    lines.push(`## ${section.title}`, '')
    for (const block of section.blocks) {
      if (block.kind === 'p') lines.push(fillCourse(block.text), '')
      else if (block.kind === 'list') lines.push(...block.items.map((item) => `- ${fillCourse(item)}`), '')
      else lines.push(...block.steps.map(step), '')
    }
    if (section.id === 'about') {
      lines.push('**Ways to run it**', '')
      for (const format of formats) lines.push(`- **${format.name}** (${duration(formatMinutes(format))}): ${format.who}`)
      lines.push('', '**Which branch after Tier 3**', '')
      for (const branch of branches) lines.push(`- ${branch.audience}: ${branch.tiers}`)
      lines.push('')
    }
  }
  for (const s of sessions) lines.push(...session(resolvedSession(s)))
  return lines.join('\n')
}
