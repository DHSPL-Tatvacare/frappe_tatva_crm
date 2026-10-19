<!-- TATVA: one Bulk Actions row, the notification row's shape: unread dot, what was done, where it stands, when. -->
<template>
  <div
    class="flex cursor-pointer items-start gap-2.5 hover:bg-surface-gray-2"
    @click="emit('open', job)"
  >
    <div class="mt-1.5 shrink-0">
      <div
        class="size-[5px] rounded-full"
        :class="job.seen ? 'bg-transparent' : 'bg-surface-gray-7'"
      />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="truncate font-medium">{{ titleOf(job) }}</div>
      <BulkJobLine :job="job" />
      <div class="text-sm text-ink-gray-5">{{ __(timeAgo(job.creation)) }}</div>
    </div>
    <Button
      v-if="job.abortable"
      class="shrink-0"
      :tooltip="__('Stop')"
      icon="square"
      variant="solid"
      theme="red"
      @click.stop="confirmStop(job)"
    />
    <a
      v-else-if="job.file_url"
      class="shrink-0"
      :href="job.file_url"
      :download="job.file_name"
      @click.stop
    >
      <Button :tooltip="__('Download')" icon="download" variant="ghost" />
    </a>
  </div>
</template>

<script setup>
import { Button } from 'frappe-ui'
import BulkJobLine from '@/tatva/BulkJobLine.vue'
import { titleOf, confirmStop } from '@/stores/bulkActionsPanel'
import { timeAgo } from '@/utils'

defineProps({ job: { type: Object, required: true } })
const emit = defineEmits(['open'])
</script>
