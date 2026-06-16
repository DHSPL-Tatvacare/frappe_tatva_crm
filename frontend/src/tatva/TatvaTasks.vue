<!--
  TatvaTasks — the native, config-driven Tasks/Activities board for a CRM Lead.

  Replaces the stock TaskArea for leads (Activities.vue, gated to doctype === 'CRM Lead'). Renders
  entirely from ONE server payload (tatva_connect.activity.api.lead_task_board): each task as a
  UNIFORM card — status + title + unique ID, common info, a type Badge, and a reliable OSM map
  thumbnail (or a neutral slot). The per-type field detail lives in the modal, not the card, so every
  card is the same size. All config is grain-driven from tatva_connect; this is skin + lifecycle only.

  Card click opens OUR config-driven modal (TatvaTaskModal) pre-filled with the saved values — never
  the stock generic task modal. We hold task.name, so identity is exact (no DOM/title guessing).

  Phase 1 = read + render + view. Phase 2 adds the DONE lifecycle (capture → gate → save) + editing.
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
        class="tc-task-card flex h-[92px] cursor-pointer items-stretch gap-3 rounded-lg border border-outline-gray-2 bg-surface-white p-3 transition hover:bg-surface-gray-1"
        @click="open(task)"
      >
        <div class="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div class="flex items-center gap-2">
            <TaskStatusIcon :status="task.status" />
            <span class="truncate font-medium text-ink-gray-9">{{ task.title }}</span>
            <span class="shrink-0 text-xs text-ink-gray-4">#{{ task.name }}</span>
          </div>

          <div class="flex items-center gap-1.5 text-xs text-ink-gray-6">
            <span class="truncate">{{ task.rep_name }}</span>
            <DotIcon class="h-2.5 w-2.5 shrink-0 text-ink-gray-4" :radius="2" />
            <span class="shrink-0">{{ task.datetime }}</span>
            <template v-if="task.priority">
              <DotIcon class="h-2.5 w-2.5 shrink-0 text-ink-gray-4" :radius="2" />
              <span class="shrink-0">{{ task.priority }}</span>
            </template>
          </div>

          <div class="flex items-center gap-1.5">
            <Badge v-if="task.task_type" variant="subtle" theme="gray" size="sm" :label="task.task_type" />
            <Badge
              v-if="task.location"
              variant="subtle"
              theme="green"
              size="sm"
              :label="__('Located')"
            />
          </div>
        </div>

        <div class="h-full w-[116px] shrink-0">
          <TatvaMiniMap v-if="task.location" :lat="task.location.lat" :lng="task.location.lng" />
          <div
            v-else
            class="flex h-full w-full items-center justify-center rounded-md bg-surface-gray-2 text-xs text-ink-gray-4"
          >
            {{ __('No location') }}
          </div>
        </div>
      </div>
    </div>

    <TatvaTaskModal v-model="modalOpen" :task="selected" :config="selectedConfig" />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createResource, Badge } from 'frappe-ui'
import TaskStatusIcon from '@/components/Icons/TaskStatusIcon.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'
import TatvaMiniMap from '@/tatva/TatvaMiniMap.vue'
import TatvaTaskModal from '@/tatva/TatvaTaskModal.vue'

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

const selected = ref(null)
const modalOpen = ref(false)
const selectedConfig = computed(() =>
  selected.value ? board.data?.types?.[selected.value.task_type] || null : null,
)

function open(task) {
  selected.value = task
  modalOpen.value = true
}

// Bridge: the ad-hoc "Log Activity" punch (tatva_connect form script) calls this to refresh the board.
onMounted(() => {
  window.__tcReloadTasks = () => board.reload()
})
onBeforeUnmount(() => {
  if (window.__tcReloadTasks) delete window.__tcReloadTasks
})

defineExpose({ reload: () => board.reload() })
</script>
