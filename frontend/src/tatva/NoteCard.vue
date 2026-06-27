<!--
  NoteCard — a single FCRM Note rendered in the unified activity-card shape (same as Call/Comment:
  "who added a note · when" header + a bordered content block with the note's title & content).
  Replaces the tall grid card so Notes share one design language with Calls/Comments/Tasks.
  Lives in tatva/ (additive — never conflicts on upstream cherry-pick).
-->
<template>
  <div :id="note.name">
    <!-- header: who added the note + when + delete -->
    <div class="mb-1 flex items-center justify-stretch gap-2 py-1 text-base">
      <div class="inline-flex items-center flex-wrap gap-1 text-ink-gray-5">
        <UserAvatar class="mr-1" :user="note.owner" size="md" />
        <span class="font-medium text-ink-gray-8">{{ getUser(note.owner).full_name }}</span>
        <span>{{ __('added a') }}</span>
        <span class="font-medium text-ink-gray-8">{{ __('note') }}</span>
      </div>
      <div class="ml-auto flex items-center gap-1 whitespace-nowrap">
        <Tooltip :text="formatDate(note.modified)">
          <div class="text-sm text-ink-gray-5">{{ __(timeAgo(note.modified)) }}</div>
        </Tooltip>
        <Dropdown
          :options="[
            {
              label: __('Delete'),
              icon: 'trash-2',
              onClick: () => deleteNote(note.name),
            },
          ]"
          @click.stop
        >
          <Button icon="more-horizontal" variant="ghost" class="!h-6 !w-6" @click.stop.prevent />
        </Dropdown>
      </div>
    </div>

    <!-- content block (mirrors the Call/Comment card) -->
    <div
      class="cursor-pointer rounded-md border border-outline-gray-modals bg-surface-cards px-3 py-2.5 text-ink-gray-9"
    >
      <div v-if="note.title" class="truncate font-medium text-ink-gray-8">
        {{ note.title }}
      </div>
      <TextEditor
        v-if="note.content"
        :content="note.content"
        :editable="false"
        editor-class="prose-sm max-w-none text-ink-gray-5 focus:outline-none"
        :class="note.title ? 'mt-1' : ''"
      />
      <div v-if="note.attachments" class="mt-2 flex">
        <Badge theme="gray" :label="String(note.attachments)">
          <template #prefix><FeatherIcon name="paperclip" class="size-3" /></template>
        </Badge>
      </div>
    </div>
  </div>
</template>
<script setup>
import UserAvatar from '@/components/UserAvatar.vue'
import { timeAgo, formatDate } from '@/utils'
import { Tooltip, Dropdown, Button, Badge, FeatherIcon, TextEditor, call, toast } from 'frappe-ui'
import { usersStore } from '@/stores/users'

defineProps({
  note: { type: Object, default: () => ({}) },
})

const notes = defineModel({ type: Object })

const { getUser } = usersStore()

async function deleteNote(name) {
  await toast.promise(
    call('frappe.client.delete', {
      doctype: 'FCRM Note',
      name,
    }),
    {
      loading: __('Deleting note...'),
      success: __('Note deleted'),
      error: __('Failed to delete note'),
    },
  )
  notes.value?.reload()
}
</script>
