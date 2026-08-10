<!-- TATVA: one card for every node on the canvas. -->
<template>
  <div
    class="relative w-[260px] rounded-lg border-2 bg-surface-white shadow-sm transition-shadow hover:shadow-md"
    :style="cardStyle"
    :class="[hasProblems ? 'border-outline-red-3' : category.border, ringClass]"
  >
    <Handle type="target" :position="Position.Top" />

    <div
      class="flex items-center gap-2 overflow-hidden rounded-t-md px-3 py-1.5"
      :class="category.bar"
    >
      <span
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        :class="category.chip"
      >
        <component :is="icon" class="h-3 w-3" />
      </span>
      <span
        class="text-[10px] font-semibold uppercase tracking-wider"
        :class="category.text"
      >
        {{ __(category.label) }}
      </span>
      <!-- One right-hand group, so nothing competes for ml-auto and the strip cannot go ragged. Counts
           live here rather than on a line of their own: the card is fixed-height by construction, and a
           badge that adds a row makes every card of this kind a different size. -->
      <span class="ml-auto flex shrink-0 items-center gap-1">
        <span
          v-if="waiting"
          class="rounded-full bg-surface-amber-2 px-1.5 text-[10px] font-semibold text-ink-amber-3"
          :title="__('{0} journeys are waiting here', [waiting])"
          >{{ waiting }}</span
        >
        <span
          v-if="failed"
          class="rounded-full bg-surface-red-2 px-1.5 text-[10px] font-semibold text-ink-red-3"
          :title="__('{0} journeys failed here', [failed])"
          >{{ failed }}</span
        >
        <span
          v-if="hasProblems"
          class="flex h-4 w-4 items-center justify-center rounded-full bg-surface-red-4 text-[9px] font-semibold text-ink-white"
          :title="problems.map((p) => p.message).join('\n')"
          >{{ problems.length }}</span
        >
        <span v-else-if="live" class="flex items-center" :title="__(live)">
          <span class="h-1.5 w-1.5 rounded-full" :class="liveDot" />
        </span>
      </span>
    </div>

    <div class="px-3 py-2.5">
      <p
        class="truncate text-sm font-semibold leading-tight text-ink-gray-8"
        :title="title"
      >
        {{ title }}
      </p>
      <p
        class="mt-0.5 min-h-[1lh] truncate text-xs leading-snug"
        :class="summary ? 'text-ink-gray-6' : 'italic text-ink-gray-4'"
        :title="detail"
      >
        {{ detail }}
      </p>
      <p
        class="mt-1.5 truncate font-mono text-[10px] text-ink-gray-4"
        :title="node.node_id"
      >
        {{ node.node_id }}
      </p>
    </div>

    <Handle
      v-for="(h, i) in handles"
      :id="h.id"
      :key="h.id"
      type="source"
      :position="handlePosition(i, handles.length)"
      :style="outputLayout(i, handles.length).style"
    />
    <div
      v-for="(h, i) in handles"
      v-show="h.label"
      :key="`lbl-${h.id}`"
      :class="
        onRight
          ? 'pointer-events-none absolute right-3 max-w-[70%] truncate text-right text-[10px] font-medium text-ink-gray-6'
          : 'pointer-events-none absolute -bottom-4 text-[9px] font-medium text-ink-gray-5'
      "
      :style="outputLabelStyle(i, handles.length)"
    >
      {{ h.label }}
    </div>
  </div>
</template>
<script setup>
import { Handle, Position } from '@vue-flow/core'
import { computed, watch, inject } from 'vue'
import {
  handlesForNode,
  configOf,
  outputLayout,
  outputLabelStyle,
  nodeOutputHeight,
  outputsOnRight,
} from './graphMap'
import { categoryFor, iconFor } from './nodeCatalog'
import { formatDelay } from './delay'
import { plural } from '@/utils'
import { knownLinkTitle, ensureLinkTitle } from '@/tatva/linkTitle'
import { useNodeTypes } from '@/tatva/useNodeTypes'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  // The outcome the engine just reported for this node, or '' when it is not currently running.
  live: { type: String, default: '' },
  // Publish faults belonging to THIS node. Marked on the card so the author can see where to look.
  problems: { type: Array, default: () => [] },
  // What can leave this node, resolved by the backend for the graph it sits in. Never computed here.
  outputs: { type: Array, default: () => [] },
  // Journeys RESTING on this node — parked here, or dead here. Never a throughput figure.
  waiting: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  // True while the author hovers a value THIS node produced, in the inspector of a node below it.
  spotlit: { type: Boolean, default: false },
})

// Whole class strings per state: the JIT scanner cannot see an interpolated class (§0.2).
// These read the SAME value the history list does — it arrives on the `workflow_step` realtime event —
// so every word a verb declares must be here too, or the ring goes blank on the node that just failed.
// `placed` reads like `sent`: the provider accepted the call for dialling. Whether it was ANSWERED is a
// later outcome the channel declares, and it arrives as its own step.
const LIVE_RING = {
  ok: 'ring-2 ring-outline-green-2',
  parked: 'ring-2 ring-outline-amber-2',
  failed: 'ring-2 ring-outline-red-3',
  sent: 'ring-2 ring-outline-green-2',
  placed: 'ring-2 ring-outline-green-2',
  succeeded: 'ring-2 ring-outline-green-2',
  queued: 'ring-2 ring-outline-green-2',
  assigned: 'ring-2 ring-outline-green-2',
  nobody: 'ring-2 ring-outline-amber-2',
}
const LIVE_DOT = {
  ok: 'bg-surface-green-3',
  parked: 'bg-surface-amber-2',
  failed: 'bg-surface-red-4',
  sent: 'bg-surface-green-3',
  placed: 'bg-surface-green-3',
  succeeded: 'bg-surface-green-3',
  queued: 'bg-surface-green-3',
  assigned: 'bg-surface-green-3',
  nobody: 'bg-surface-amber-2',
}
const liveRing = computed(() => LIVE_RING[props.live] || '')
const hasProblems = computed(() => props.problems.length > 0)
const liveDot = computed(() => LIVE_DOT[props.live] || 'bg-surface-gray-4')

// ONE ring, decided once. Three states wanted this outline and they used to be stacked as three class
// bindings with a `selected && !liveRing` guard between two of them — which only worked because those two
// happened to be exclusive, and would have silently let the third paint over a live journey. Order is
// deliberate: the spotlight is a transient answer to "where does this value come from" and outranks a
// standing state while the pointer is on it. `outline-blue-1` is in neither other map, so the three never
// read as each other; every string is whole, so the v4 JIT scanner can see it.
const ringClass = computed(() => {
  if (props.spotlit) return 'ring-2 ring-outline-blue-1'
  if (liveRing.value) return liveRing.value
  return props.selected ? 'ring-2 ring-outline-gray-4' : ''
})

const { declarationFor, configFieldsFor, appliedFieldsFor } = useNodeTypes()

// Provided by the canvas from `get_workflow`'s own payload; absent when a card is mounted outside one.
const linkTitles = inject('linkTitles', null)

const node = computed(() => props.data.node || {})
const config = computed(() => configOf(node.value))
const handles = computed(() =>
  handlesForNode(node.value, { [node.value.node_id]: props.outputs }),
)
const category = computed(() => categoryFor(node.value.node_type))
const icon = computed(() => iconFor(node.value.node_type))

// The node type's own label, from the registry — "Send WhatsApp", not "wa".
const title = computed(() =>
  __(
    declarationFor(node.value.node_type)?.label ||
      node.value.node_type ||
      'Node',
  ),
)

// How this node is configured, in one line, so the graph reads without opening the inspector. Only the
// fields IN PLAY: a Wait on a timer still stores the `source_node` it waited on before, and the card
// printed it while the inspector hid it — the card describing a setting the author cannot see.
// A SELECTOR is a field whose only job is to choose which of its siblings applies — `subject_mode` picks
// between `subject_text` and `subject_expression`. The card has two lines and was spending one of them on
// the word "Literal" while the subject itself never appeared. Which fields those are is not a list kept
// here: a selector is exactly a field that another field's `depends_on_value` names, so the declaration
// answers it and a node type added later needs no change.
const selectorNames = computed(() => {
  const named = new Set()
  for (const f of appliedFieldsFor(node.value.node_type, config.value)) {
    for (const on of Object.keys(f.depends_on_value || {})) named.add(on)
  }
  return named
})

// How this node is configured, in one line, so the graph reads without opening the inspector.
const summary = computed(() =>
  appliedFieldsFor(node.value.node_type, config.value)
    .filter((f) => !selectorNames.value.has(f.name))
    .map((f) => describe(f, config.value[f.name]))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · '),
)

// One line, always present so every card is the same height; blank for a node that has nothing to configure.
const detail = computed(() => {
  if (summary.value) return summary.value
  return configFieldsFor(node.value.node_type).length
    ? __('Not configured yet')
    : ''
})

// The readings a value can have on a card, keyed by the word its TYPE declares (`FIELD_TYPES[…].summary.as`, vocabulary `registry.CARD_READINGS`). This card holds no list of field types and no `field.type ===` anywhere: a type added later renders because its row answers, a row that answers nothing is refused by `test_a_scalar_type_declares_how_it_reads`, and a row naming a reading absent from here is refused by `test_every_reading_a_row_names_is_one_the_card_can_render`.
const READINGS = {
  // The value IS the human words — the author typed it, or it is the option's own word.
  raw: (field, value) => String(value),
  // A tick means its own label, and means nothing at all when it is off.
  label: (field, value) => (value ? __(field.label) : ''),
  // A primary key, composite for a grain-scoped master. Read through the one title resolver every other surface reads; falls back to the key so a cell can never blank.
  // Two sources, one answer — the map the canvas loaded WITH the graph, then the per-value fallback for a node just dropped. Identical order to `Controls/Link.vue`, which resolves the same PKs the same way.
  title: (field, value) =>
    linkTitles?.value?.[`${field.link}::${value}`] ||
    knownLinkTitle(field.link, value) ||
    String(value),
  // `add_to_date` kwargs, so the stored value is JSON. Same parser the control that writes it uses.
  delay: (field, value) => formatDelay(value, field.units || []),
}

// A tree or a list cannot be shown on one line, so it is NAMED rather than printed — and which types those are is the declaration's answer, arriving as `f.summary`.
function describe(field, value) {
  if (value === undefined || value === null || value === '') return ''
  const how = field.summary || {}
  if (how.phrase) return __(how.phrase)
  if (how.count) return `${value.length} ${__(plural(value.length, how.count))}`
  return (READINGS[how.as] || (() => ''))(field, value)
}

// The Link values on this card, as a COMPUTED so it recomputes only when the declaration or the config
// actually changes — an inline getter rebuilding the array would never compare equal and the watcher
// below would fire on every unrelated re-evaluation.
const linkValues = computed(() =>
  appliedFieldsFor(node.value.node_type, config.value)
    .filter((f) => f.summary?.as === 'title' && f.link && config.value[f.name])
    .filter((f) => !linkTitles?.value?.[`${f.link}::${config.value[f.name]}`])
    .map((f) => ({ doctype: f.link, value: config.value[f.name] })),
)

// A title is FETCHED and a render path must never fetch (§12), so the asking happens here and `describe`
// only reads what is already known. Same shape as `Controls/Link.vue`, which resolves the same PKs the
// same way; `ensureLinkTitle` is memoised per (doctype, value) module-side, so N cards holding one task
// type ask once between them.
watch(
  linkValues,
  (refs) => refs.forEach((r) => ensureLinkTitle(r.doctype, r.value)),
  { immediate: true },
)

// WHERE the handles render is the count-keyed rule in graphMap — the card only draws the answer. A card
// whose outputs run down the right edge is taller, by a height deterministic from that count (F5).
const onRight = computed(() => outputsOnRight(handles.value.length))
const cardStyle = computed(() => {
  const h = nodeOutputHeight(handles.value.length)
  return h ? { minHeight: `${h}px` } : {}
})
function handlePosition(i, n) {
  return outputLayout(i, n).position === 'right'
    ? Position.Right
    : Position.Bottom
}
</script>
