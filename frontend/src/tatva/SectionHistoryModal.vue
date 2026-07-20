<!--
  TATVA: SectionHistoryModal — everything a lead's field has held, newest first.

  The Data tab shows the current value; a lab report per date, a drug cycle per date, or a question
  answered again on a later campaign all keep the earlier ones, and this is where they are read. Generic
  on (lead, field_key) and the server answers both shapes in ONE entry shape, so the wording here is
  neutral: nothing is Facebook-, screening- or section-specific.

  Lifecycle per the UI constitution: mounted behind `v-if`, so a fresh open is a fresh instance with
  fresh state and nothing fetches while closed (U3/U4). `auto` + `cache` keyed on the two props, which
  are fixed for the instance's life — the shape `getCacheKey` requires, since it snapshots the key once
  at createResource time. No store, no manual reset, no watcher: the framework owns the lifecycle.
-->
<template>
  <ResponsiveDialog v-model="show" :options="{ size: 'lg' }">
    <template #body-title>
      <h3 class="text-2xl font-semibold leading-6 text-ink-gray-9">
        {{ __('History') }}
      </h3>
      <p class="mt-1 text-p-sm text-ink-gray-6">{{ __(history.data?.label || '') }}</p>
    </template>

    <template #body-content>
      <div v-if="history.loading" class="flex justify-center py-8">
        <LoadingIndicator class="h-5 w-5 text-ink-gray-5" />
      </div>

      <ErrorMessage v-else-if="history.error" :message="history.error.messages?.[0]" />

      <EmptyState
        v-else-if="!entries.length"
        :title="__('Nothing recorded')"
        :description="__('This field has no earlier entries.')"
      />

      <FadedScrollableDiv v-else class="flex max-h-96 flex-col gap-3 overflow-y-auto">
        <div
          v-for="(entry, index) in entries"
          :key="index"
          class="flex items-start justify-between gap-4 border-b border-outline-gray-1 pb-3 last:border-0"
        >
          <div class="flex flex-col gap-1">
            <span class="text-base text-ink-gray-8" :class="{ 'text-ink-gray-4': entry.empty }">
              <!-- display is the server's clean label for a Link/composite value; value is the raw one. -->
            {{ entry.empty ? __('No value') : entry.display || entry.value }}
            </span>
            <span v-if="entry.source" class="text-p-xs text-ink-gray-5">{{ entry.source }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <Badge v-if="index === 0" variant="subtle" theme="green" :label="__('Current')" />
            <Tooltip :text="entry.on">
              <span class="text-p-xs text-ink-gray-5">{{ timeAgo(entry.on) }}</span>
            </Tooltip>
          </div>
        </div>
      </FadedScrollableDiv>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import EmptyState from '@/components/ListViews/EmptyState.vue'
import FadedScrollableDiv from '@/components/FadedScrollableDiv.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { timeAgo } from '@/utils'
import { Badge, ErrorMessage, LoadingIndicator, Tooltip, createResource } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
  lead: { type: String, required: true },
  fieldKey: { type: String, required: true },
})

const show = defineModel({ type: Boolean })

// auto: the modal only exists while open, so this is lazy by construction rather than by a watcher.
// cache: both props are fixed for this instance, which is what makes the snapshotted key safe.
const history = createResource({
  url: 'tatva_connect.lead.detail.section_history',
  cache: ['tatva-section-history', props.lead, props.fieldKey],
  makeParams: () => ({ lead: props.lead, field_key: props.fieldKey }),
  auto: true,
})

const entries = computed(() => history.data?.entries || [])
</script>
