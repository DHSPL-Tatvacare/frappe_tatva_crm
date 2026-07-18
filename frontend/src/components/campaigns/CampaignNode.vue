<!-- TATVA: one visual component for every campaign node. Mirrors the evals orchestration node card —
     an icon chip + tinted header + accent bar, coloured per node_type via frappe-ui design tokens
     (no hex; theme-aware). A target handle on top; source handles on the bottom, one per output edge. -->
<template>
  <div
    class="relative min-w-[210px] max-w-[264px] overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white shadow-sm transition-shadow"
    :class="{ 'ring-2 ring-outline-gray-3': selected }"
  >
    <div class="h-1 w-full" :class="style.bar" />
    <Handle type="target" :position="Position.Top" />

    <div class="flex items-center gap-2 px-3 pb-1 pt-2.5">
      <span
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        :class="style.chip"
      >
        <component :is="icon" class="h-3.5 w-3.5" />
      </span>
      <span
        class="text-[10px] font-semibold uppercase tracking-wide"
        :class="style.label"
      >
        {{ node.node_type || 'Node' }}
      </span>
    </div>

    <div class="truncate px-3 text-sm font-semibold text-ink-gray-8" :title="node.node_id">
      {{ node.node_id }}
    </div>
    <div
      class="truncate px-3 pb-3 pt-0.5 text-xs text-ink-gray-5"
      :class="{ 'opacity-0': !summary }"
      :title="summary"
    >
      {{ summary || '·' }}
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
import { handlesForNode } from './graphMap'
import { styleFor, iconFor } from './nodeCatalog'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const node = computed(() => props.data.node || {})
const handles = computed(() => handlesForNode(node.value))
const style = computed(() => styleFor(node.value.node_type))
const icon = computed(() => iconFor(node.value.node_type))

// A one-line hint of the node's key config, so the graph reads without opening the inspector.
const summary = computed(() => {
  const n = node.value
  switch (n.node_type) {
    case 'Step':
      return n.action_group ? `▸ ${n.action_group}` : ''
    case 'Branch':
      return n.condition || ''
    case 'Assign':
      return n.assign_json || ''
    case 'Wait':
      return [n.wait_mode, n.wait_expression, n.signal_name].filter(Boolean).join(' · ')
    default:
      return ''
  }
})

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
