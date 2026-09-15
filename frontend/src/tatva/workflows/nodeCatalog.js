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
import LucideShuffle from '~icons/lucide/shuffle'
import LucideFerrisWheel from '~icons/lucide/ferris-wheel'

// Declaration order IS palette order: what starts a flow, then how it is routed, then what it does.
// `bar` tints the header, `chip` fills the icon square, `text` the category word, `border` the card.
// Semantic tokens only: blue, green and amber carry a solid `-3` surface in both themes; violet, pink and cyan carry a tint.
export const CATEGORIES = {
  trigger: {
    label: 'Trigger',
    icon: LucideZap,
    bar: 'bg-surface-amber-2',
    chip: 'bg-surface-amber-3 text-ink-amber-1',
    text: 'text-ink-amber-3',
    border: 'border-outline-amber-1',
  },
  routing: {
    label: 'Routing',
    icon: LucideGitBranch,
    bar: 'bg-surface-violet-1',
    chip: 'bg-surface-white text-ink-violet-1',
    text: 'text-ink-violet-1',
    border: 'border-outline-gray-3',
  },
  people: {
    label: 'People',
    icon: LucideUserRoundPlus,
    bar: 'bg-surface-pink-1',
    chip: 'bg-surface-white text-ink-pink-1',
    text: 'text-ink-pink-1',
    border: 'border-outline-gray-3',
  },
  records: {
    label: 'Records',
    icon: LucideBox,
    bar: 'bg-surface-blue-2',
    chip: 'bg-surface-blue-3 text-ink-blue-1',
    text: 'text-ink-blue-3',
    border: 'border-outline-blue-1',
  },
  messaging: {
    label: 'Messaging',
    icon: EmailIcon,
    bar: 'bg-surface-green-2',
    chip: 'bg-surface-green-3 text-ink-green-1',
    text: 'text-ink-green-3',
    border: 'border-outline-green-1',
  },
  data: {
    label: 'Data',
    icon: LucideUserRoundCheck,
    bar: 'bg-surface-cyan-1',
    chip: 'bg-surface-white text-ink-cyan-1',
    text: 'text-ink-cyan-1',
    border: 'border-outline-gray-3',
  },
  timing: {
    label: 'Timing',
    icon: LucideClock,
    bar: 'bg-surface-orange-1',
    chip: 'bg-surface-white text-ink-amber-3',
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
}

// Every node type the registry declares, by the group it is drawn in; a type missing here is drawn as Records.
const CATEGORY_OF = {
  Trigger: 'trigger',
  Route: 'routing',
  Sample: 'routing',
  'Assign to User': 'people',
  Distribute: 'people',
  'Create Task': 'records',
  'Update Field': 'records',
  'Append Child Row': 'records',
  'Upsert Child Row': 'records',
  'Create Note': 'records',
  'Generate Document': 'records',
  'Send WhatsApp': 'messaging',
  'Send Email': 'messaging',
  'AI Voice Call': 'messaging',
  'Set Variables': 'data',
  'Call API': 'data',
  Wait: 'timing',
  Terminal: 'end',
}

// A per-type icon where it helps read the graph at a glance; the category's own icon otherwise.
export const NODE_ICONS = {
  // Sample and Route are both Routing, so the category tint is shared; the glyph is what tells the
  // author which question the node asks — data, or chance.
  Sample: LucideShuffle,
  'Assign to User': LucideUserRoundPlus,
  // Each seat comes round in turn — a pool's rota, weighted or not.
  Distribute: LucideFerrisWheel,
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
  return CATEGORIES[CATEGORY_OF[nodeType] || 'records']
}

export function iconFor(nodeType) {
  return NODE_ICONS[nodeType] || categoryFor(nodeType).icon
}
