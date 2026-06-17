<!--
  ActivityAuditEntry — one clean per-lead audit row for our synthetic timeline entries.

  Renders the entries our server assembler injects (tatva_connect.api.activities.get_activities):
  a logged activity with its status + location + documents folded in, a legible stage move, or a
  plain task created/closed. Pure presentation — every field is decided server-side (the fork holds
  no logic). Native rows (calls, emails, WhatsApp, comments, generic field changes) keep their own
  renderers; Activities.vue routes only these activity_types here.
-->
<template>
  <div class="flex flex-col gap-1.5 py-1.5">
    <!-- headline: actor · verb · subject (+ from→to for a stage move) -->
    <div class="flex items-center gap-2 text-base">
      <div class="inline-flex flex-wrap items-center gap-1 text-ink-gray-5">
        <span class="font-medium text-ink-gray-8">{{ activity.owner_name }}</span>
        <Badge
          v-if="activity.is_automation"
          variant="subtle"
          theme="blue"
          size="sm"
          :label="__('Automation')"
        />
        <span v-if="verb">{{ verb }}</span>
        <span class="font-medium text-ink-gray-8">{{ subject }}</span>
        <template v-if="activity.activity_type === 'stage_moved'">
          <span v-if="activity.from_stage">{{ activity.from_stage }}</span>
          <FeatherIcon v-if="activity.from_stage" name="arrow-right" class="size-3" />
          <span class="font-medium text-ink-gray-8">{{ activity.to_stage }}</span>
        </template>
      </div>
      <div class="ml-auto whitespace-nowrap">
        <Tooltip :text="formatDate(activity.creation)">
          <div class="text-sm text-ink-gray-5">{{ __(timeAgo(activity.creation)) }}</div>
        </Tooltip>
      </div>
    </div>

    <!-- nested detail: status · location · documents (logged activities only) -->
    <div
      v-if="activity.activity_type === 'activity_logged' && hasDetail"
      class="ml-0.5 flex flex-col gap-1 text-sm text-ink-gray-6"
    >
      <div v-if="activity.status" class="inline-flex items-center gap-1.5">
        <FeatherIcon name="check-circle" class="size-3.5 text-ink-gray-5" />
        <span>{{ activity.status }}</span>
      </div>
      <a
        v-if="activity.location"
        :href="activity.location.map_url"
        target="_blank"
        class="inline-flex items-center gap-1.5 hover:text-ink-gray-8"
      >
        <FeatherIcon name="map-pin" class="size-3.5" />
        <span>{{ activity.location.address || __('View on map') }}</span>
      </a>
      <a
        v-for="doc in activity.documents"
        :key="doc.file_url"
        :href="doc.file_url"
        target="_blank"
        class="inline-flex items-center gap-1.5 hover:text-ink-gray-8"
      >
        <FeatherIcon name="paperclip" class="size-3.5" />
        <span>{{ doc.file_name }}</span>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, Tooltip, FeatherIcon } from 'frappe-ui'
import { formatDate, timeAgo } from '@/utils'

const props = defineProps({ activity: { type: Object, required: true } })

const VERBS = {
  activity_logged: () => props.activity.verb || 'logged',
  stage_moved: () => 'moved stage',
  task_created: () => 'created task',
  task_closed: () => 'completed task',
  lifecycle: () => '',
}
const verb = computed(() => {
  const v = VERBS[props.activity.activity_type]?.() || ''
  return v ? __(v) : ''
})
const subject = computed(() => props.activity.subject || '')
const hasDetail = computed(
  () =>
    props.activity.status ||
    props.activity.location ||
    props.activity.documents?.length,
)
</script>
