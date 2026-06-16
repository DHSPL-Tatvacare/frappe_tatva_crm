<!--
  TatvaTasks — the native, config-driven Tasks/Activities board for a CRM Lead.

  Replaces the stock TaskArea for leads (Activities.vue, gated to doctype === 'CRM Lead'). Renders
  entirely from ONE server payload (tatva_connect.activity.api.lead_task_board): each task as an
  adaptive card — name + unique ID + the activity type's filled fields + an OSM mini-map when a
  location was captured. All config (fields, location flag) is grain-driven from tatva_connect; this
  component is skin + lifecycle only.

  Phase 1 = read + render. Card click opens the native task modal (exact ID — we hold task.name).
  Phase 2 replaces that with the config-driven modal + DONE lifecycle.

  Lives in frontend/src/tatva/ (additive — never conflicts on upstream cherry-pick).
-->
<template>
  <div>
    <div v-if="board.loading && !board.data" class="py-8 text-center text-base text-ink-gray-5">
      Loading…
    </div>

    <div v-else-if="!tasks.length" class="py-8 text-center text-base text-ink-gray-5">
      No tasks yet.
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="task in tasks"
        :key="task.name"
        class="tc-task-card cursor-pointer rounded-lg border border-outline-gray-2 bg-surface-white p-3 transition hover:bg-surface-gray-1"
        @click="open(task)"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <TaskStatusIcon :status="task.status" />
              <span class="truncate font-medium text-ink-gray-9">{{ task.title }}</span>
              <span class="shrink-0 text-xs text-ink-gray-4">#{{ task.name }}</span>
            </div>

            <div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-gray-6">
              <span>{{ task.rep_name }}</span>
              <DotIcon class="h-2.5 w-2.5 text-ink-gray-4" :radius="2" />
              <span>{{ task.datetime }}</span>
              <template v-if="task.priority">
                <DotIcon class="h-2.5 w-2.5 text-ink-gray-4" :radius="2" />
                <span>{{ task.priority }}</span>
              </template>
              <span
                v-if="task.task_type"
                class="ml-1 rounded bg-surface-gray-2 px-1.5 py-0.5 text-ink-gray-7"
              >
                {{ task.task_type }}
              </span>
            </div>

            <div v-if="filledFields(task).length" class="mt-2 flex flex-col gap-0.5">
              <div v-for="f in filledFields(task)" :key="f.label" class="text-xs leading-snug">
                <span class="text-ink-gray-5">{{ f.label }}:</span>
                <span class="text-ink-gray-8"> {{ f.value }}</span>
              </div>
            </div>

            <div
              v-if="task.location"
              class="mt-2 flex items-start gap-1 text-xs text-ink-gray-5"
            >
              <span>📍</span><span class="truncate">{{ task.location.address || 'Location captured' }}</span>
            </div>
          </div>

          <img
            v-if="task.location"
            :src="osmMap(task.location)"
            alt="map"
            class="h-16 w-28 shrink-0 rounded-md object-cover"
            @error="onMapError"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { createResource } from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'

const props = defineProps({
  lead: { type: String, default: '' },
  modalRef: { type: Object, default: () => ({}) },
})

const board = createResource({
  url: 'tatva_connect.activity.api.lead_task_board',
  makeParams: () => ({ lead: props.lead }),
  auto: true,
})

watch(
  () => props.lead,
  () => props.lead && board.reload(),
)

const tasks = computed(() => board.data?.tasks || [])

// The activity type's filled fields (label + value), in schema order, only those with a value.
function filledFields(task) {
  const cfg = board.data?.types?.[task.task_type]
  if (!cfg) return []
  return cfg.fields
    .filter((f) => {
      const v = task.values?.[f.fieldname]
      return v !== null && v !== undefined && v !== ''
    })
    .map((f) => ({ label: f.label, value: task.values[f.fieldname] }))
}

// Cheap OSM static thumbnail (no key, no Google cost). Google stays server-side for geo math only.
function osmMap(loc) {
  return (
    'https://staticmap.openstreetmap.de/staticmap.php?center=' +
    loc.lat +
    ',' +
    loc.lng +
    '&zoom=16&size=220x96&markers=' +
    loc.lat +
    ',' +
    loc.lng +
    ',lightblue1'
  )
}

function onMapError(e) {
  e.target.style.display = 'none'
}

// Phase 1: open the native task modal with the EXACT id (we hold task.name — no DOM/title guessing).
function open(task) {
  if (props.modalRef?.showTask) props.modalRef.showTask({ name: task.name })
}

defineExpose({ reload: () => board.reload() })
</script>
