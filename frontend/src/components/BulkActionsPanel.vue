<template>
  <div
    v-if="visible"
    ref="target"
    class="absolute z-20 h-[100dvh] bg-surface-white transition-all duration-300 ease-in-out"
    :style="{
      'box-shadow': '8px 0px 8px rgba(0, 0, 0, 0.1)',
      'max-width': '350px',
      'min-width': '350px',
      left: 'calc(100% + 1px)',
    }"
  >
    <div class="flex h-[100dvh] flex-col text-ink-gray-9">
      <div
        class="z-20 flex items-center justify-between border-b bg-surface-white px-5 py-2.5"
      >
        <div class="text-base font-medium">{{ __('Bulk Actions') }}</div>
        <Button
          :tooltip="__('Close')"
          icon="x"
          variant="ghost"
          @click="() => toggle()"
        />
      </div>
      <div
        v-if="jobs.length"
        class="divide-y divide-outline-gray-modals overflow-auto text-base"
      >
        <div
          v-for="j in jobs"
          :key="j.job"
          class="flex cursor-pointer items-start gap-2.5 px-4 py-2.5 hover:bg-surface-gray-2"
          @click="selectedJob = j"
        >
          <div class="mt-1.5">
            <Badge
              :theme="statusTheme(j.status)"
              variant="subtle"
              :label="j.status"
            />
          </div>
          <div>
            <div class="font-medium">{{ j.title }}</div>
            <div class="text-sm text-ink-gray-5">
              {{ __(timeAgo(j.creation)) }}
            </div>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        name="Bulk Actions"
        title="No Bulk Actions Yet"
        description="Bulk assign, edit, delete, or export jobs will show up here"
        :icon="BulkActionsIcon"
        width="lg"
      />
    </div>
  </div>
  <BulkActionDetailModal
    v-if="selectedJob"
    v-model="showDetail"
    :job="selectedJob"
  />
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Badge, Button } from 'frappe-ui'
import BulkActionsIcon from '~icons/lucide/list-checks'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import BulkActionDetailModal from '@/components/Modals/BulkActionDetailModal.vue'
import { visible, jobs, bulkActionsPanelStore } from '@/stores/bulkActionsPanel'
import { globalStore } from '@/stores/global'
import { timeAgo } from '@/utils'

const { $socket } = globalStore()
const { toggle, reload } = bulkActionsPanelStore()

const target = ref(null)
onClickOutside(
  target,
  () => {
    if (visible.value) toggle()
  },
  {
    ignore: ['#bulk-actions-btn'],
  },
)

const selectedJob = ref(null)
const showDetail = ref(false)
watch(selectedJob, (v) => {
  showDetail.value = !!v
})
watch(showDetail, (v) => {
  if (!v) selectedJob.value = null
})

const EVENTS = [
  'crm_bulk_ready',
  'crm_bulk_failed',
  'crm_export_ready',
  'crm_export_progress',
  'crm_export_failed',
]

onMounted(() => {
  EVENTS.forEach((e) => $socket.on(e, reload))
})
onBeforeUnmount(() => {
  EVENTS.forEach((e) => $socket.off(e, reload))
})

function statusTheme(status) {
  if (status === 'Completed') return 'green'
  if (status === 'Error') return 'red'
  if (status === 'Started') return 'blue'
  return 'gray'
}
</script>
