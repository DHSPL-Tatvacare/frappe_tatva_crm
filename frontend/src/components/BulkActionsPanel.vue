<!-- TATVA: the notification tray's twin (Notifications.vue): the same header, tabs, day groups, unread dot and Load more, over bulk jobs and exports. -->
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
        <div class="flex items-center gap-2">
          <div class="text-base font-medium">{{ __('Bulk Actions') }}</div>
          <Badge
            v-if="unseenCount"
            :label="String(unseenCount)"
            theme="blue"
            variant="subtle"
          />
        </div>
        <div class="flex gap-1">
          <Button
            v-if="unseenCount"
            :tooltip="unreadOnly ? __('Clear all') : __('Mark all as read')"
            :icon="MarkAsDoneIcon"
            variant="ghost"
            @click="markSeen()"
          />
          <Button
            :tooltip="__('Close')"
            icon="x"
            variant="ghost"
            @click="() => toggle()"
          />
        </div>
      </div>
      <BulkJobFilters />
      <div
        v-if="groupedJobs.length"
        class="divide-y divide-outline-gray-modals overflow-auto text-base"
      >
        <div v-for="group in groupedJobs" :key="group.key">
          <div
            class="sticky top-0 z-10 bg-surface-gray-1 px-5 py-1 text-sm text-ink-gray-5"
          >
            {{ group.label }}
          </div>
          <BulkJobRow
            v-for="j in group.items"
            :key="j.job"
            :job="j"
            class="px-4 py-2.5"
            @open="openJob"
          />
        </div>
        <div v-if="hasMore" class="p-3">
          <Button
            class="w-full"
            :label="__('Load more')"
            :loading="feed.loading"
            @click="loadMore"
          />
        </div>
      </div>
      <EmptyState
        v-else
        name="Bulk Actions"
        :title="emptyState.title"
        :description="emptyState.description"
        :icon="BulkActionsIcon"
        width="lg"
      />
    </div>
  </div>
  <BulkActionDetailModal
    v-if="selectedJob"
    v-model="detailOpen"
    :jobName="selectedJob"
  />
</template>
<script setup>
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Badge, Button } from 'frappe-ui'
import BulkActionsIcon from '~icons/lucide/list-checks'
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import BulkActionDetailModal from '@/components/Modals/BulkActionDetailModal.vue'
import BulkJobFilters from '@/tatva/BulkJobFilters.vue'
import BulkJobRow from '@/tatva/BulkJobRow.vue'
import {
  visible,
  feed,
  unreadOnly,
  groupedJobs,
  unseenCount,
  hasMore,
  loadMore,
  markSeen,
  emptyState,
  selectedJob,
  detailOpen,
  openJob,
  bulkActionsPanelStore,
} from '@/stores/bulkActionsPanel'

const { toggle } = bulkActionsPanelStore()

const target = ref(null)
onClickOutside(
  target,
  () => {
    // While a job's detail is open, a click anywhere belongs to that modal, so the panel stays.
    if (visible.value && !detailOpen.value) toggle()
  },
  {
    // The action menu and a confirm (Stop) are portalled out of this panel, so their wrappers are named or a click on them closes the panel.
    ignore: [
      '#bulk-actions-btn',
      '[data-reka-popper-content-wrapper]',
      '.dialog-overlay',
    ],
  },
)
</script>
