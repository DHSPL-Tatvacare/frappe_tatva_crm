<template>
  <!-- TatvaDoctorActivityList — the latest few of ONE kind for one lead. Its inputs never change, so it fetches once at setup and a late reply can only land in its own tab. -->
  <div class="pt-3">
    <!-- Loading and empty share one fixed box, so a tab switch never moves the panel and EmptyState can centre in it. -->
    <div
      v-if="page.loading || page.error || !rows.length"
      class="flex h-60 flex-col"
    >
      <div v-if="page.loading" class="flex flex-1 items-center justify-center">
        <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      </div>
      <EmptyState
        v-else
        class="flex-1"
        width="lg"
        top="20%"
        :name="kind.label"
        :icon="kind.icon"
        :title="page.error ? __('Could not load') : kind.empty"
        :description="emptyDescription"
      />
    </div>
    <div v-else class="flex flex-col gap-2">
      <template v-for="row in rows" :key="row.name">
        <!-- A call opens its own detail (recording, notes) — the lead page's CallArea, read-only. -->
        <CallArea
          v-if="kind.value === 'call'"
          :activity="row"
          :showMenu="false"
        />
        <ActivityCard v-else v-bind="card(row)" @open="open(row)" />
      </template>
      <button
        v-if="total > rows.length"
        type="button"
        class="self-start py-1 text-sm text-ink-gray-6 hover:text-ink-gray-8"
        @click="emit('open')"
      >
        {{ __('See all {0} on the lead', [total]) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { createResource } from 'frappe-ui'
import { computed } from 'vue'
import ActivityCard from '@/tatva/ActivityCard.vue'
import CallArea from '@/components/Activities/CallArea.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import { fileCard, noteCard, sender, taskCard } from '@/tatva/activityCard.js'
import { usersStore } from '@/stores/users'

const props = defineProps({
  lead: { type: String, required: true },
  kind: { type: Object, required: true }, // one of TatvaDoctorActivity's KINDS
})

const emit = defineEmits(['open'])

const LATEST = 5
const { getUser } = usersStore()

const page = createResource({
  url: 'tatva_connect.api.activities.lead_activity',
  params: { lead: props.lead, kind: props.kind.value, page_length: LATEST },
  auto: true,
})

const rows = computed(() => page.data?.data || [])
const total = computed(() => page.data?.total_count || 0)

// Near Me is read-only, so the next step is the lead itself — never the lead page's "add one here".
const emptyDescription = computed(() =>
  page.error?.exc_type === 'PermissionError'
    ? __('This lead is not yours to read.')
    : page.error
      ? __('Try again in a moment.')
      : __('Open the lead to add one.'),
)

// The lead page's own adapters, read-only here: no card carries its delete menu.
function card(row) {
  const shape =
    props.kind.value === 'task'
      ? taskCard(row)
      : props.kind.value === 'note'
        ? noteCard(row, sender(row, getUser))
        : fileCard(row, getUser)
  return { ...shape, menu: [] }
}

// A file opens itself, as the Files tab does; a task or note opens the lead it belongs to.
function open(row) {
  if (props.kind.value === 'attachment' && row.file_url)
    window.open(row.file_url, '_blank')
  else emit('open')
}
</script>
