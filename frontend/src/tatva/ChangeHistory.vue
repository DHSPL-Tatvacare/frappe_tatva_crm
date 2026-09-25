<!-- TATVA: a configuration record's Activity tab (Task Forms, Workflows) — drawn by the Lead Activity rail's own row and change lines. -->
<template>
  <!-- The Lead Activity tab's own title row: same margins, so the rail below sits exactly as it does on a lead. -->
  <div class="mx-4 my-3 flex items-center gap-3 text-lg font-medium text-ink-gray-9 sm:mx-10 sm:mb-4 sm:mt-8">
    {{ __('Activity') }}
  </div>
  <div v-if="history.loading && !history.data" class="flex flex-1 items-center justify-center">
    <LoadingIndicator class="h-6 w-6 text-ink-gray-5" />
  </div>
  <EmptyState
    v-else-if="history.data && !history.data.length"
    class="flex-1"
    name="Changes"
    :title="__('No Activities Found')"
    :description="__('Every save is recorded from now on: who changed what, and when.')"
    icon="clock"
  />
  <div v-else-if="history.data" class="flex flex-col pb-5 pt-2">
    <ActivityTimelineItem
      v-for="(row, i) in history.data"
      :key="row.name"
      :icon="iconOf(row)"
      :actor="actorOf(row.owner)"
      :verb="verbOf(row)"
      :at="row.creation"
      :last="i === history.data.length - 1"
    >
      <ActivityChanges v-if="row.changes?.length" :changes="row.changes" />
    </ActivityTimelineItem>
  </div>
</template>
<script setup>
import ActivityTimelineItem from '@/tatva/ActivityTimelineItem.vue'
import ActivityChanges from '@/tatva/ActivityChanges.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import DotIcon from '@/components/Icons/DotIcon.vue'
import LucideWorkflow from '~icons/lucide/workflow'
import { saveVerb } from '@/tatva/activityCard.js'
import { usersStore } from '@/stores/users'
import { LoadingIndicator, createResource } from 'frappe-ui'
import { markRaw } from 'vue'

const props = defineProps({
  doctype: { type: String, required: true },
  name: { type: String, required: true },
  // The record's own icon, as a lead's rail ends on LeadsIcon.
  icon: { type: [Object, Function], required: true },
})

const dot = markRaw(DotIcon)
const own = markRaw(props.icon)
const workflow = markRaw(LucideWorkflow)
const iconOf = (row) => ({ creation: own, published: workflow })[row.activity_type] || dot
const verbOf = (row) =>
  row.activity_type === 'creation'
    ? row.data
    : row.activity_type === 'published'
      ? __('published version {0}', [row.version_no])
      : saveVerb(row.changes)
const { getUser } = usersStore()
// Who saved it, as the rail names a person.
const actorOf = (owner) => {
  const who = getUser(owner)
  return { label: who?.full_name || owner, image: who?.user_image || '' }
}

// Asked when this view mounts and never cached: a history must include the save just made.
const history = createResource({
  url: 'tatva_connect.api.change_history.change_history',
  params: { doctype: props.doctype, name: props.name },
  auto: true,
})
</script>
