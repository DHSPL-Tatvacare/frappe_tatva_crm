<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[{ label: __('Bulk Actions'), route: { name: 'BulkActions' } }]"
      />
    </template>
  </LayoutHeader>
  <div class="flex flex-col overflow-hidden text-ink-gray-9">
    <div
      v-if="jobs.length"
      class="divide-y divide-outline-gray-1 overflow-y-auto text-base"
    >
      <div
        v-for="j in jobs"
        :key="j.job"
        class="flex cursor-pointer items-start gap-2.5 px-2.5 py-3 hover:bg-surface-gray-2"
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
    <div v-else class="flex flex-1 flex-col items-center justify-center gap-2">
      <BulkActionsIcon class="h-20 w-20 text-ink-gray-2" />
      <div class="text-lg font-medium text-ink-gray-4">
        {{ __('No Bulk Actions Yet') }}
      </div>
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
import { Badge, Breadcrumbs } from 'frappe-ui'
import BulkActionsIcon from '~icons/lucide/list-checks'
import LayoutHeader from '@/components/LayoutHeader.vue'
import BulkActionDetailModal from '@/components/Modals/BulkActionDetailModal.vue'
import { jobs, bulkActionsPanelStore } from '@/stores/bulkActionsPanel'
import { globalStore } from '@/stores/global'
import { timeAgo } from '@/utils'

const { $socket } = globalStore()
const { reload } = bulkActionsPanelStore()

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
