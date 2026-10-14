<!-- TATVA: the Bulk Actions panel as a full page on mobile: the same store, filters, rows and detail as the desktop panel. -->
<template>
  <LayoutHeader>
    <template #left-header>
      <Breadcrumbs
        :items="[{ label: __('Bulk Actions'), route: { name: 'BulkActions' } }]"
      />
    </template>
    <template #right-header>
      <Button
        v-if="unseenCount"
        :label="__('Mark all as read')"
        :iconLeft="MarkAsDoneIcon"
        @click="markSeen()"
      />
    </template>
  </LayoutHeader>
  <div class="flex flex-1 flex-col overflow-hidden text-ink-gray-9">
    <BulkJobFilters />
    <div
      v-if="groupedJobs.length"
      class="divide-y divide-outline-gray-1 overflow-y-auto text-base"
    >
      <div v-for="group in groupedJobs" :key="group.key">
        <div
          class="sticky top-0 z-10 bg-surface-gray-1 px-3 py-1 text-sm text-ink-gray-5"
        >
          {{ group.label }}
        </div>
        <BulkJobRow
          v-for="j in group.items"
          :key="j.job"
          :job="j"
          class="px-3 py-3"
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
    <div v-else class="flex flex-1 flex-col">
      <EmptyState
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
import { onMounted, onBeforeUnmount } from 'vue'
import { Breadcrumbs, Button } from 'frappe-ui'
import BulkActionsIcon from '~icons/lucide/list-checks'
import LayoutHeader from '@/components/LayoutHeader.vue'
import MarkAsDoneIcon from '@/components/Icons/MarkAsDoneIcon.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import BulkActionDetailModal from '@/components/Modals/BulkActionDetailModal.vue'
import BulkJobFilters from '@/tatva/BulkJobFilters.vue'
import BulkJobRow from '@/tatva/BulkJobRow.vue'
import {
  visible,
  feed,
  groupedJobs,
  unseenCount,
  hasMore,
  loadMore,
  markSeen,
  emptyState,
  selectedJob,
  detailOpen,
  openJob,
} from '@/stores/bulkActionsPanel'

// This page IS the panel, so being mounted is being on screen.
onMounted(() => {
  visible.value = true
  feed.reload()
})
onBeforeUnmount(() => (visible.value = false))
</script>
