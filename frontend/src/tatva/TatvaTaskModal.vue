<!--
  TatvaTaskModal — the config-driven detail modal for an activity task.

  Renders the task type's captured fields PRE-FILLED, in schema order, honouring depends_on (only the
  branches that actually applied are shown). A clean native label/value grid — matches the CRM side-panel
  style, zero document machinery. A captured visit shows its OSM map + address.

  Phase 1: read view (opening a done task shows its data, never blank). Phase 2 turns this same config
  contract into the editable form + DONE lifecycle (capture → gate → save).
-->
<template>
  <Dialog v-model="show" :options="{ size: 'lg' }">
    <template #body-title>
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold text-ink-gray-9">{{ task?.title || task?.task_type }}</span>
        <span v-if="task" class="text-sm text-ink-gray-4">#{{ task.name }}</span>
      </div>
    </template>

    <template #body-content>
      <div class="flex flex-col gap-5">
        <div v-if="task?.task_type" class="flex items-center gap-2">
          <Badge variant="subtle" theme="gray" size="sm" :label="task.task_type" />
          <Badge
            v-if="task.status"
            variant="subtle"
            :theme="statusTheme(task.status)"
            size="sm"
            :label="task.status"
          />
        </div>

        <div v-if="rows.length" class="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
          <div v-for="r in rows" :key="r.label" class="min-w-0">
            <div class="mb-0.5 text-xs text-ink-gray-5">{{ __(r.label) }}</div>
            <div class="break-words text-sm text-ink-gray-8">{{ r.value }}</div>
          </div>
        </div>

        <div v-if="notes">
          <div class="mb-0.5 text-xs text-ink-gray-5">{{ __('Notes') }}</div>
          <div class="whitespace-pre-wrap break-words text-sm text-ink-gray-8">{{ notes }}</div>
        </div>

        <div v-if="!rows.length && !notes" class="text-sm text-ink-gray-5">
          {{ __('No details were captured for this task.') }}
        </div>

        <div v-if="task?.location">
          <div class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5">
            <span>📍</span><span>{{ task.location.address || __('Visit location') }}</span>
          </div>
          <TatvaMiniMap
            :lat="task.location.lat"
            :lng="task.location.lng"
            :zoom="16"
            class="h-44 w-full rounded-lg border border-outline-gray-1"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Dialog, Badge } from 'frappe-ui'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { evaluateDependsOnValue } from '@/utils'

const props = defineProps({
  task: { type: Object, default: null }, // { name, title, task_type, status, values, location }
  config: { type: Object, default: null }, // { fields[], is_logged_complete, captures_location }
})
const show = defineModel({ type: Boolean, default: false })

const values = computed(() => props.task?.values || {})

// Schema-ordered fields that applied (depends_on passes) AND hold a value — label + value to display.
const rows = computed(() => {
  const data = values.value
  return (props.config?.fields || [])
    .filter((f) => !f.depends_on || evaluateDependsOnValue(f.depends_on, data))
    .map((f) => ({ label: f.label, value: data[f.fieldname] }))
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== '')
})

const notes = computed(() => values.value.notes || '')

function statusTheme(status) {
  return (
    { Done: 'green', Canceled: 'red', 'In Progress': 'blue', Todo: 'orange', Backlog: 'gray' }[status] ||
    'gray'
  )
}
</script>
