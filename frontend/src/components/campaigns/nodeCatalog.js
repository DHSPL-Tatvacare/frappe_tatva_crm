// TATVA: shared node-type catalog for the Campaigns canvas — colours (frappe-ui tokens, theme-aware),
// icons, and the palette listing. One source so the canvas node and the palette can never disagree.
import LucideListChecks from '~icons/lucide/list-checks'
import LucideGitBranch from '~icons/lucide/git-branch'
import LucideUserRoundCheck from '~icons/lucide/user-round-check'
import LucideClock from '~icons/lucide/clock'
import LucideFlag from '~icons/lucide/flag'

// Relatable, at-a-glance icons: a Step runs an Action Group (a checklist of actions); Assign sets a
// value / assigns to a person; Branch forks; Wait pauses on time/event; Terminal ends the flow.
export const NODE_ICONS = {
  Step: LucideListChecks,
  Branch: LucideGitBranch,
  Assign: LucideUserRoundCheck,
  Wait: LucideClock,
  Terminal: LucideFlag,
}

// Full literal token classes (JIT-safe) — { accent bar, icon chip, type label } per node_type.
export const NODE_STYLES = {
  Step: { bar: 'bg-surface-blue-3', chip: 'bg-surface-blue-2 text-ink-blue-3', label: 'text-ink-blue-3' },
  Branch: { bar: 'bg-surface-amber-2', chip: 'bg-surface-amber-2 text-ink-amber-3', label: 'text-ink-amber-3' },
  Assign: { bar: 'bg-surface-green-2', chip: 'bg-surface-green-2 text-ink-green-3', label: 'text-ink-green-3' },
  Wait: { bar: 'bg-surface-red-2', chip: 'bg-surface-red-2 text-ink-red-2', label: 'text-ink-red-2' },
  Terminal: { bar: 'bg-surface-gray-4', chip: 'bg-surface-gray-3 text-ink-gray-6', label: 'text-ink-gray-6' },
}

// Palette order + one-line hint of what each node does.
export const NODE_TYPES = [
  { type: 'Step', label: 'Step', hint: 'Run an Action Group' },
  { type: 'Branch', label: 'Branch', hint: 'Route on a condition' },
  { type: 'Assign', label: 'Assign', hint: 'Set state values' },
  { type: 'Wait', label: 'Wait', hint: 'Pause for a timer or event' },
  { type: 'Terminal', label: 'Terminal', hint: 'End the flow' },
]

export function styleFor(nodeType) {
  return NODE_STYLES[nodeType] || NODE_STYLES.Terminal
}
export function iconFor(nodeType) {
  return NODE_ICONS[nodeType] || LucideFlag
}
