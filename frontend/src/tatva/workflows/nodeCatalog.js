// TATVA: PRESENTATION for workflow node types — what a node LOOKS like.
import LucideZap from '~icons/lucide/zap'
import LucideSquarePen from '~icons/lucide/square-pen'
import LucideCircleCheckBig from '~icons/lucide/circle-check-big'
import LucideRows3 from '~icons/lucide/rows-3'
import LucideCloudCog from '~icons/lucide/cloud-cog'
import LucideStickyNote from '~icons/lucide/sticky-note'
import LucideMessageCircle from '~icons/lucide/message-circle'
import LucideMail from '~icons/lucide/mail'
import LucideGitBranch from '~icons/lucide/git-branch'
import LucideUserRoundCheck from '~icons/lucide/user-round-check'
import LucideClock from '~icons/lucide/clock'
import LucideFlag from '~icons/lucide/flag'
import LucideBox from '~icons/lucide/box'
import LucideUserRoundPlus from '~icons/lucide/user-round-plus'

// Declaration order IS palette order: what starts a flow, then how it is routed, then what it does.
// `bar` tints the header, `chip` fills the icon square, `text` the category word, `border` the card.
export const CATEGORIES = {
  trigger: {
    label: 'Trigger',
    icon: LucideZap,
    bar: 'bg-surface-violet-1',
    chip: 'bg-surface-violet-1 text-ink-violet-1',
    text: 'text-ink-violet-1',
    border: 'border-outline-gray-3',
  },
  routing: {
    label: 'Routing',
    icon: LucideGitBranch,
    bar: 'bg-surface-amber-1',
    chip: 'bg-surface-amber-2 text-ink-amber-3',
    text: 'text-ink-amber-3',
    border: 'border-outline-amber-2',
  },
  data: {
    label: 'Data',
    icon: LucideUserRoundCheck,
    bar: 'bg-surface-green-1',
    chip: 'bg-surface-green-2 text-ink-green-3',
    text: 'text-ink-green-3',
    border: 'border-outline-green-2',
  },
  timing: {
    label: 'Timing',
    icon: LucideClock,
    bar: 'bg-surface-orange-1',
    chip: 'bg-surface-orange-1 text-ink-amber-3',
    text: 'text-ink-amber-3',
    border: 'border-outline-orange-1',
  },
  end: {
    label: 'End',
    icon: LucideFlag,
    bar: 'bg-surface-gray-2',
    chip: 'bg-surface-gray-4 text-ink-gray-7',
    text: 'text-ink-gray-6',
    border: 'border-outline-gray-3',
  },
  action: {
    label: 'Action',
    icon: LucideBox,
    bar: 'bg-surface-blue-1',
    chip: 'bg-surface-blue-2 text-ink-blue-3',
    text: 'text-ink-blue-3',
    border: 'border-outline-blue-1',
  },
}

// Control types are named here; everything else is a verb, and a verb is an Action.
const CONTROL_CATEGORY = {
  Trigger: 'trigger',
  Branch: 'routing',
  'Set Variables': 'data',
  Wait: 'timing',
  Terminal: 'end',
}

// A per-type icon where it helps read the graph at a glance; the category's own icon otherwise.
export const NODE_ICONS = {
  'Assign to User': LucideUserRoundPlus,
  'Create Task': LucideCircleCheckBig,
  'Update Field': LucideSquarePen,
  'Append Child Row': LucideRows3,
  'Upsert Child Row': LucideRows3,
  'Call API': LucideCloudCog,
  'Create Note': LucideStickyNote,
  'Send WhatsApp': LucideMessageCircle,
  'Send Email': LucideMail,
}

export function categoryFor(nodeType) {
  return CATEGORIES[CONTROL_CATEGORY[nodeType] || 'action']
}

export function iconFor(nodeType) {
  return NODE_ICONS[nodeType] || categoryFor(nodeType).icon
}
