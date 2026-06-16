<!--
  TatvaTaskModal — the config-driven detail modal for an activity task.

  Renders the task type's fields PRE-FILLED with the saved values, using the CRM's own native field
  renderer (FieldLayout/Field.vue) in standalone mode — so controls are pixel-identical to the rest of
  the CRM and we reinvent nothing. depends_on is honoured (only relevant fields show). A captured visit
  shows its OSM map + address.

  Phase 1: read-only view (opening a done task shows its data, never blank). Phase 2 adds edit + the DONE
  lifecycle (capture → gate → save) on top of this same renderer.
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
      <div class="flex flex-col gap-4">
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

        <div v-if="!visibleFields.length" class="text-sm text-ink-gray-5">
          No details were captured for this task.
        </div>
        <div v-else class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Field v-for="f in visibleFields" :key="f.fieldname" :field="f" />
        </div>

        <div v-if="task?.location" class="mt-1">
          <div class="mb-1.5 flex items-start gap-1 text-xs text-ink-gray-5">
            <span>📍</span><span>{{ task.location.address || 'Visit location' }}</span>
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
import { computed, reactive, provide, watch } from 'vue'
import { Dialog, Badge } from 'frappe-ui'
import Field from '@/components/FieldLayout/Field.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import { evaluateDependsOnValue } from '@/utils'

const props = defineProps({
  task: { type: Object, default: null }, // { name, title, task_type, status, values, location }
  config: { type: Object, default: null }, // { fields[], is_logged_complete, captures_location }
})
const show = defineModel({ type: Boolean, default: false })

// Field.vue reads its model + context via inject — standalone (empty doctype) avoids any getMeta fetch.
const data = reactive({})
provide('data', data)
provide('doctype', '')
provide('preview', false)
provide('isGridRow', false)

watch(
  () => props.task,
  (t) => {
    Object.keys(data).forEach((k) => delete data[k])
    if (t?.values) Object.assign(data, t.values)
  },
  { immediate: true },
)

// Map our clean config field -> the native renderer's field shape (read-only view for Phase 1).
function toField(f) {
  return {
    fieldname: f.fieldname,
    label: f.label,
    fieldtype: f.fieldtype,
    options: f.fieldtype === 'Select' ? String(f.options || '').split('\n').filter(Boolean) : f.options,
    reqd: !!f.reqd,
    read_only: true,
    visible: true,
    _depends_on: f.depends_on || '',
  }
}

const fields = computed(() => (props.config?.fields || []).map(toField))

// Only fields whose depends_on passes against the saved values, AND that actually hold a value.
const visibleFields = computed(() =>
  fields.value.filter((f) => {
    if (f._depends_on && !evaluateDependsOnValue(f._depends_on, data)) return false
    const v = data[f.fieldname]
    return v !== null && v !== undefined && v !== ''
  }),
)

function statusTheme(status) {
  return (
    { Done: 'green', Canceled: 'red', 'In Progress': 'blue', Todo: 'orange', Backlog: 'gray' }[status] ||
    'gray'
  )
}
</script>
