import type { Choices, Lever } from '../levels/types.ts'
import type { Badge } from './FactoryView.tsx'
import type { IconName } from './icons.tsx'

// How each kind of lever looks: its icon, and the badge it puts on the stations it changes.

const stationBadge: Partial<Record<Lever['kind'], Badge>> = {
  upgrade: 'upgraded',
  coverBreak: 'covered',
  steady: 'steadied',
  maintain: 'maintained',
  quickChange: 'quick',
}

export function leverIcon(lever: Lever): IconName {
  switch (lever.kind) {
    case 'upgrade':
      return 'bolt'
    case 'steady':
      return 'even'
    case 'coverBreak':
    case 'releasePace':
      return 'clock'
    case 'maintain':
      return 'wrench'
    case 'ropeTo':
    case 'ropeLength':
      return 'rope'
    case 'machineRule':
      return 'rule'
    case 'buy':
      return 'money'
    case 'lotSize':
      return 'stack'
    case 'quickChange':
      return 'swap'
    case 'transferSize':
      return 'cart'
    case 'priority':
      return 'sort'
    case 'menu':
      return 'tag'
    case 'option':
      return lever.icon ?? 'rule'
  }
}

export function badgesFor(levers: Lever[], plan: Choices): Record<string, Badge[]> {
  const badges: Record<string, Badge[]> = {}
  for (const lever of levers) {
    const badge = stationBadge[lever.kind]
    if (!badge) continue
    const station = plan[lever.id]
    badges[station] = [...(badges[station] ?? []), badge]
  }
  return badges
}
