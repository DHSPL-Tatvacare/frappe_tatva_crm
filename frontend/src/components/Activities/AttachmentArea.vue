<!-- TATVA: attachments render through the shared ActivityCard (U9). Each File → the card shape via the
     shared `fileCard` adapter (one File shape, reused by the Activity rail); this area owns open/delete. -->
<template>
  <div v-if="attachments.length" class="flex flex-col gap-2">
    <ActivityCard
      v-for="file in attachments"
      :key="file.name"
      v-bind="fileCard(file, getUser)"
      @open="openFile(file)"
      @action="(k) => k === 'delete' && deleteAttachment(file.name)"
    />
  </div>
</template>
<script setup>
import ActivityCard from '@/tatva/ActivityCard.vue'
import { fileCard } from '@/tatva/activityCard.js'
import { usersStore } from '@/stores/users'
import { globalStore } from '@/stores/global'
import { call } from 'frappe-ui'

defineProps({
  attachments: { type: Array, default: () => [] },
})
const emit = defineEmits(['reload'])

const { getUser } = usersStore()
const { $dialog } = globalStore()

function openFile(file) {
  window.open(file.file_url, '_blank')
}

function deleteAttachment(name) {
  $dialog({
    title: __('Delete Attachment'),
    message: __('Are you sure you want to delete this attachment?'),
    actions: [
      {
        label: __('Delete'),
        variant: 'solid',
        theme: 'red',
        onClick: async (close) => {
          await call('frappe.client.delete', { doctype: 'File', name })
          emit('reload')
          close()
        },
      },
    ],
  })
}
</script>
