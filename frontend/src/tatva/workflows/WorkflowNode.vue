<!-- TATVA: one card for every node on the canvas. -->
<template>
  <div
    class="relative w-[260px] rounded-lg border-2 bg-surface-white shadow-sm transition-shadow hover:shadow-md"
    :style="cardStyle"
    :class="[
      hasProblems ? 'border-outline-red-3' : category.border,
      liveRing,
      { 'ring-2 ring-outline-gray-4': selected && !liveRing },
    ]"
  >
    <Handle type="target" :position="Position.Top" />

    <div class="flex items-center gap-2 overflow-hidden rounded-t-md px-3 py-1.5" :class="category.bar">
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
          :title="__('{0} runs are waiting here', [waiting])"
        >{{ waiting }}</span>
        <span
          v-if="failed"
          class="rounded-full bg-surface-red-2 px-1.5 text-[10px] font-semibold text-ink-red-3"
          :title="__('{0} runs failed here', [failed])"
        >{{ failed }}</span>
        <span
          v-if="hasProblems"
          class="flex h-4 w-4 items-center justify-center rounded-full bg-surface-red-4 text-[9px] font-semibold text-ink-white"
          :title="problems.map((p) => p.message).join('\n')"
        >{{ problems.length }}</span>
        <span v-else-if="live" class="flex items-center" :title="__(live)">
          <span class="h-1.5 w-1.5 rounded-full" :class="liveDot" />
        </span>
      </span>
    </div>

    <div class="px-3 py-2.5">
      <p class="truncate text-sm font-semibold leading-tight text-ink-gray-8" :title="title">
        {{ title }}
      </p>
      <p
        class="mt-0.5 min-h-[1lh] truncate text-xs leading-snug"
        :class="summary ? 'text-ink-gray-6' : 'italic text-ink-gray-4'"
        :title="detail"
      >
        {{ detail }}
      </p>
      <p class="mt-1.5 truncate font-mono text-[10px] text-ink-gray-4" :title="node.node_id">
        {{ node.node_id }}
      </p>
    </div>

    <Handle
      v-for="(h, i) in handles"
      :key="h.id"
      :id="h.id"
      type="source"
      :position="handlePosition(i, handles.length)"
      :style="outputLayout(i, handles.length).style"
    />
    <div
      v-for="(h, i) in handles"
      v-show="h.label"
      :key="`lbl-${h.id}`"
      :class="onRight
        ? 'pointer-events-none absolute right-3 max-w-[70%] truncate text-right text-[10px] font-medium text-ink-gray-6'
        : 'pointer-events-none absolute -bottom-4 text-[9px] font-medium text-ink-gray-5'"
      :style="outputLabelStyle(i, handles.length)"
    >
      {{ h.label }}
    </div>
  </div>
</template>
<script setup>
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'
import { handlesForNode, configOf, outputLayout, outputLabelStyle, nodeOutputHeight, outputsOnRight } from './graphMap'
import { categoryFor, iconFor } from './nodeCatalog'
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
  // Runs RESTING on this node — parked here, or dead here. Never a throughput figure.
  waiting: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
})

// Whole class strings per state: the JIT scanner cannot see an interpolated class (§0.2).
// These read the SAME value the history list does — it arrives on the `workflow_step` realtime event —
// so every word a verb declares must be here too, or the ring goes blank on the node that just failed.
const LIVE_RING = {
  ok: 'ring-2 ring-outline-green-2',
  parked: 'ring-2 ring-outline-amber-2',
  failed: 'ring-2 ring-outline-red-3',
  sent: 'ring-2 ring-outline-green-2',
  succeeded: 'ring-2 ring-outline-green-2',
  assigned: 'ring-2 ring-outline-green-2',
  nobody: 'ring-2 ring-outline-amber-2',
}
const LIVE_DOT = {
  ok: 'bg-surface-green-3',
  parked: 'bg-surface-amber-2',
  failed: 'bg-surface-red-4',
  sent: 'bg-surface-green-3',
  succeeded: 'bg-surface-green-3',
  assigned: 'bg-surface-green-3',
  nobody: 'bg-surface-amber-2',
}
const liveRing = computed(() => LIVE_RING[props.live] || '')
const hasProblems = computed(() => props.problems.length > 0)
const liveDot = computed(() => LIVE_DOT[props.live] || 'bg-surface-gray-4')

const { declarationFor, configFieldsFor, appliedFieldsFor } = useNodeTypes()

const node = computed(() => props.data.node || {})
const config = computed(() => configOf(node.value))
const handles = computed(() => handlesForNode(node.value, { [node.value.node_id]: props.outputs }))
const category = computed(() => categoryFor(node.value.node_type))
const icon = computed(() => iconFor(node.value.node_type))

// The node type's own label, from the registry — "Send WhatsApp", not "wa".
const title = computed(() =>
  __(declarationFor(node.value.node_type)?.label || node.value.node_type || 'Node'),
)

// How this node is configured, in one line, so the graph reads without opening the inspector. Only the
// fields IN PLAY: a Wait on a timer still stores the `source_node` it waited on before, and the card
// printed it while the inspector hid it — the card describing a setting the author cannot see.
const summary = computed(() =>
  appliedFieldsFor(node.value.node_type, config.value)
    .map((f) => describe(f, config.value[f.name]))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · '),
)

// One line, always present so every card is the same height; blank for a node that has nothing to configure.
const detail = computed(() => {
  if (summary.value) return summary.value
  return configFieldsFor(node.value.node_type).length ? __('Not configured yet') : ''
})

// A tree or a list cannot be shown on one line, so it is NAMED rather than printed — and which types
// those are is the declaration's answer, arriving as `f.summary`. Naming them here was the seventh copy
// of the type vocabulary, and it listed three of the five that need it.
function describe(field, value) {
  if (value === undefined || value === null || value === '') return ''
  const how = field.summary
  if (!how) return String(value)
  return how.phrase ? __(how.phrase) : `${value.length} ${__(how.count)}`
}

// WHERE the handles render is the count-keyed rule in graphMap — the card only draws the answer. A card
// whose outputs run down the right edge is taller, by a height deterministic from that count (F5).
const onRight = computed(() => outputsOnRight(handles.value.length))
const cardStyle = computed(() => {
  const h = nodeOutputHeight(handles.value.length)
  return h ? { minHeight: `${h}px` } : {}
})
function handlePosition(i, n) {
  return outputLayout(i, n).position === 'right' ? Position.Right : Position.Bottom
}
</script>
