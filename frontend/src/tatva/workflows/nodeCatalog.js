// TATVA: PRESENTATION for workflow node types — what a node LOOKS like.
import LucideZap from '~icons/lucide/zap'
import LucideSquarePen from '~icons/lucide/square-pen'
import LucideRows3 from '~icons/lucide/rows-3'
import LucideCloudCog from '~icons/lucide/cloud-cog'

// A CRM object looks the same wherever it appears. These are the app's OWN glyphs — the ones the Tasks
// tab, the Notes tab and the WhatsApp panel already draw — so a Send WhatsApp node reads as the same
// thing on the canvas as everywhere else in the product. Control flow (Wait, Route, Trigger, End) stays
// on Lucide: those are not CRM objects and the app ships nothing for them.
// Every one of these is authored with `stroke="currentColor"`/`fill="currentColor"`, so the glyph
// inherits the CATEGORY tint on its chip. Nothing is recoloured here and the chip is left alone.
import WhatsAppIcon from '@/components/Icons/WhatsAppIcon.vue'
import EmailIcon from '@/components/Icons/EmailIcon.vue'
import TaskIcon from '@/components/Icons/TaskIcon.vue'
import NoteIcon from '@/components/Icons/NoteIcon.vue'
import PhoneIcon from '@/components/Icons/PhoneIcon.vue'
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
  Route: 'routing',
  'Set Variables': 'data',
  Wait: 'timing',
  Terminal: 'end',
}

// A per-type icon where it helps read the graph at a glance; the category's own icon otherwise.
export const NODE_ICONS = {
  'Assign to User': LucideUserRoundPlus,
  'Create Task': TaskIcon,
  'Update Field': LucideSquarePen,
  'Append Child Row': LucideRows3,
  'Upsert Child Row': LucideRows3,
  'Call API': LucideCloudCog,
  'Create Note': NoteIcon,
  'Send WhatsApp': WhatsAppIcon,
  'Send Email': EmailIcon,
  'AI Voice Call': PhoneIcon,
}

export function categoryFor(nodeType) {
  return CATEGORIES[CONTROL_CATEGORY[nodeType] || 'action']
}

export function iconFor(nodeType) {
  return NODE_ICONS[nodeType] || categoryFor(nodeType).icon
}
