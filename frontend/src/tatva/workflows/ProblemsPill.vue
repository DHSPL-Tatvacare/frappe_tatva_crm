<!-- TATVA: the workflow's one verdict in the header — a count in its worst severity opening every problem in frappe-ui's own ListView, blocking first; a click takes the canvas to the node. -->
<template>
  <Popover v-if="problems.length" placement="bottom-end">
    <template #target="{ togglePopover }">
      <button type="button" class="flex" :aria-label="label" @click="togglePopover()">
        <Badge :theme="worstTone(problems).badge" :label="label" />
      </button>
    </template>
    <template #body-main="{ close }">
      <div class="max-h-96 w-[36rem] overflow-y-auto">
        <ListView
          :columns="COLUMNS"
          :rows="rows"
          row-key="name"
          :options="{ selectable: false, showTooltip: false, onRowClick: (row) => focus(row, close) }"
        />
      </div>
    </template>
  </Popover>
</template>

<script setup>
import { computed, h } from 'vue'
import { Badge, ListView, Popover } from 'frappe-ui'
import { severityTone, worstTone } from './journeyStatus'

const props = defineProps({
  // The backend's problems, `{node_id, field, message, severity, fix}`, as Save or Publish answered them.
  problems: { type: Array, default: () => [] },
})
const emit = defineEmits(['focus'])

// ListView's own column API; the severity dot is the shared tone's `dot` as the problem's prefix.
const COLUMNS = [
  { label: __('Node'), key: 'node', width: '11rem' },
  {
    label: __('Problem'),
    key: 'message',
    width: 1,
    prefix: ({ row }) => h('span', { class: ['h-1.5 w-1.5 shrink-0 rounded-full', severityTone(row.severity).dot] }),
  },
]

const blocking = computed(() => props.problems.filter((p) => p.severity === 'blocks'))
const warnings = computed(() => props.problems.filter((p) => p.severity !== 'blocks'))
const label = computed(() =>
  blocking.value.length
    ? __('{0} to fix', [blocking.value.length])
    : warnings.value.length === 1
      ? __('1 warning')
      : __('{0} warnings', [warnings.value.length]),
)
// Blocking first, then warnings; `node` reads "—" for a problem about the whole graph.
const rows = computed(() =>
  [...blocking.value, ...warnings.value].map((p, i) => ({ ...p, name: String(i), node: p.node_id || '—' })),
)

// A row naming a node takes the canvas there; a graph-level one has nowhere to go and just closes the list.
function focus(problem, close) {
  close()
  if (problem.node_id) emit('focus', problem.node_id)
}
</script>
