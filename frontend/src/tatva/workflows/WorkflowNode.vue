<!-- TATVA: one card for every node on the canvas. -->
<template>
  <div
    class="relative w-[260px] rounded-lg border-2 bg-surface-white shadow-sm transition-shadow hover:shadow-md"
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
      <span
        v-if="hasProblems"
        class="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-surface-red-4 text-[9px] font-semibold text-ink-white"
        :title="problems.map((p) => p.message).join('\n')"
      >
        {{ problems.length }}
      </span>
      <span v-else-if="live" class="ml-auto flex items-center" :title="__(live)">
        <span class="h-1.5 w-1.5 rounded-full" :class="liveDot" />
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
      :position="Position.Bottom"
      :style="handleStyle(i, handles.length)"
    />
    <div
      v-for="(h, i) in handles"
      v-show="h.label"
      :key="`lbl-${h.id}`"
      class="pointer-events-none absolute -bottom-4 text-[9px] font-medium text-ink-gray-5"
      :style="labelStyle(i, handles.length)"
    >
      {{ h.label }}
    </div>
  </div>
</template>
<script setup>
import { Handle, Position } from '@vue-flow/core'
import { computed } from 'vue'
import { handlesForNode, configOf } from './graphMap'
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
})

// Whole class strings per state: the JIT scanner cannot see an interpolated class (§0.2).
const LIVE_RING = {
  ok: 'ring-2 ring-outline-green-2',
  parked: 'ring-2 ring-outline-amber-2',
  failed: 'ring-2 ring-outline-red-3',
}
const LIVE_DOT = {
  ok: 'bg-surface-green-3',
  parked: 'bg-surface-amber-2',
  failed: 'bg-surface-red-4',
}
const liveRing = computed(() => LIVE_RING[props.live] || '')
const hasProblems = computed(() => props.problems.length > 0)
const liveDot = computed(() => LIVE_DOT[props.live] || 'bg-surface-gray-4')

const { declarationFor, configFieldsFor, outputsFor } = useNodeTypes()

const node = computed(() => props.data.node || {})
const config = computed(() => configOf(node.value))
const handles = computed(() => handlesForNode(node.value, outputsFor))
const category = computed(() => categoryFor(node.value.node_type))
const icon = computed(() => iconFor(node.value.node_type))

// The node type's own label, from the registry — "Send WhatsApp", not "wa".
const title = computed(() =>
  __(declarationFor(node.value.node_type)?.label || node.value.node_type || 'Node'),
)

// How this node is configured, in one line, so the graph reads without opening the inspector.
const summary = computed(() =>
  configFieldsFor(node.value.node_type)
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

// A tree or a list cannot be shown on one line, so it is named rather than printed.
function describe(field, value) {
  if (value === undefined || value === null || value === '') return ''
  if (field.type === 'Predicate') return __('has a condition')
  if (field.type === 'Requirements') return `${value.length} ${__('required')}`
  if (field.type === 'Mapping') return `${value.length} ${__('captured')}`
  return String(value)
}

// Spread multiple bottom handles evenly across the node width.
function pct(i, n) {
  return n <= 1 ? 50 : Math.round(((i + 1) / (n + 1)) * 100)
}
function handleStyle(i, n) {
  return { left: `${pct(i, n)}%` }
}
function labelStyle(i, n) {
  return { left: `${pct(i, n)}%`, transform: 'translateX(-50%)' }
}
</script>
