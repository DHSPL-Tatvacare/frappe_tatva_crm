// TATVA: PRESENTATION for workflow node types — what a node LOOKS like.
import { useNodeTypes } from '@/tatva/useNodeTypes'
import LucideZap from '~icons/lucide/zap'
import LucideSquarePen from '~icons/lucide/square-pen'
import LucideRows3 from '~icons/lucide/rows-3'
import LucideCloudCog from '~icons/lucide/cloud-cog'

// A CRM object looks the same wherever it appears. These are the app's OWN glyphs — the ones the Tasks tab, the Notes tab and the WhatsApp panel already draw — so a Send WhatsApp node reads as the same thing on the canvas as everywhere else in the product. Control flow (Wait, Route, Trigger, End) stays on Lucide: those are not CRM objects and the app ships nothing for them. Every one of these is authored with `stroke="currentColor"`/`fill="currentColor"`, so the glyph inherits the CATEGORY tint on its chip. Nothing is recoloured here and the chip is left alone.
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

// Declaration order IS palette order: what starts a flow, then how it is routed, then what it does. `bar` tints the header, `chip` fills the icon square, `text` the category word, `mini` the minimap fill, `border` the card. `chip` is ONE solid style for every category: filled with the category's own ink token (`bg-current`), icon in `ink-white`, so every theme flips it; only amber/blue/green have a solid surface token, which is why the fill is the ink.
export const CATEGORIES = {
  trigger: {
    label: 'Trigger',
    icon: LucideZap,
    bar: 'bg-surface-amber-2',
    chip: 'bg-current text-ink-amber-3 [&>*]:text-ink-white',
    text: 'text-ink-amber-3',
    mini: 'var(--ink-amber-3)',
    border: 'border-outline-amber-1',
  },
  routing: {
    label: 'Routing',
    icon: LucideGitBranch,
    bar: 'bg-surface-violet-1',
    chip: 'bg-current text-ink-violet-1 [&>*]:text-ink-white',
    text: 'text-ink-violet-1',
    mini: 'var(--ink-violet-1)',
    border: 'border-outline-gray-3',
  },
  people: {
    label: 'People',
    icon: LucideUserRoundPlus,
    bar: 'bg-surface-pink-1',
    chip: 'bg-current text-ink-pink-1 [&>*]:text-ink-white',
    text: 'text-ink-pink-1',
    mini: 'var(--ink-pink-1)',
    border: 'border-outline-gray-3',
  },
  records: {
    label: 'Records',
    icon: LucideBox,
    bar: 'bg-surface-blue-2',
    chip: 'bg-current text-ink-blue-3 [&>*]:text-ink-white',
    text: 'text-ink-blue-3',
    mini: 'var(--ink-blue-3)',
    border: 'border-outline-blue-1',
  },
  messaging: {
    label: 'Messaging',
    icon: EmailIcon,
    bar: 'bg-surface-green-2',
    chip: 'bg-current text-ink-green-3 [&>*]:text-ink-white',
    text: 'text-ink-green-3',
    mini: 'var(--ink-green-3)',
    border: 'border-outline-green-1',
  },
  data: {
    label: 'Data',
    icon: LucideUserRoundCheck,
    bar: 'bg-surface-cyan-1',
    chip: 'bg-current text-ink-cyan-1 [&>*]:text-ink-white',
    text: 'text-ink-cyan-1',
    mini: 'var(--ink-cyan-1)',
    border: 'border-outline-gray-3',
  },
  timing: {
    label: 'Timing',
    icon: LucideClock,
    bar: 'bg-surface-orange-1',
    chip: 'bg-current text-ink-amber-3 [&>*]:text-ink-white',
    text: 'text-ink-amber-3',
    mini: 'var(--ink-amber-3)',
    border: 'border-outline-orange-1',
  },
  end: {
    label: 'End',
    icon: LucideFlag,
    bar: 'bg-surface-gray-2',
    chip: 'bg-current text-ink-gray-6 [&>*]:text-ink-white',
    text: 'text-ink-gray-6',
    mini: 'var(--ink-gray-6)',
    border: 'border-outline-gray-3',
  },
}

// A per-type icon where it helps read the graph at a glance; the category's own icon otherwise.
export const NODE_ICONS = {
  // Sample and Route are both Routing, so the category tint is shared; the glyph is what tells the author which question the node asks — data, or chance.
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

// The registry declares each type's category (`node_types`); asked lazily so importing this file fetches nothing, and an unknown type draws as Records.
let nodeTypes = null
export function categoryFor(nodeType) {
  nodeTypes ||= useNodeTypes()
  return CATEGORIES[nodeTypes.declarationFor(nodeType)?.category] || CATEGORIES.records
}

export function iconFor(nodeType) {
  return NODE_ICONS[nodeType] || categoryFor(nodeType).icon
}

// The node types in palette order and group, each marked disabled when it is a singleton the workflow already holds; the palette and the drop-a-line picker both list from here.
export function groupNodeTypes(nodeTypes, present) {
  return Object.entries(CATEGORIES)
    .map(([key, category]) => ({
      key,
      category,
      types: nodeTypes
        .filter((t) => categoryFor(t.type) === category)
        .map((t) => ({ ...t, disabled: t.singleton && present.includes(t.type) })),
    }))
    .filter((group) => group.types.length)
}
