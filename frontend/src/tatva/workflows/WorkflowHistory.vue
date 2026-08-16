<!-- TATVA: a lead's workflow history — one card per execution, opened as a modal.
     Backend: tatva_connect.workflow_engine.history. Every value is read or derived there; this component
     stores nothing and decides nothing. The card is the app's ONE card shape (ActivityCard), and its counts
     come from the list endpoint — so a page of runs is ONE request and a card costs none. The log itself
     belongs to the modal, which is the only thing that reads a step. -->
<template>
  <div class="flex flex-1 flex-col overflow-y-auto px-3 pb-3 sm:px-10 sm:pb-5">
    <!-- Same loading and empty treatment the sibling tabs use, so this tab does not read as a stranger. -->
    <div
      v-if="journeys.loading"
      class="flex flex-1 items-center justify-center gap-2 text-base text-ink-gray-5"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>
    <EmptyState
      v-else-if="!journeyList.length"
      name="Workflow"
      :title="__('No automation has run for this lead')"
      :description="__('When a workflow matches this lead, every step it takes is recorded here.')"
      :icon="LucideWorkflow"
    />
    <div v-else class="flex flex-col gap-2 pt-1">
      <ActivityCard
        v-for="card in cards"
        :key="card.journey.journey"
        :title="card.title"
        :tile="card.tile"
        :badge="card.badge"
        :corner="card.corner"
        :actor="card.actor"
        :at="card.at"
        :flavor="card.meta"
        @open="opened = card.journey"
      />

      <p v-if="journeys.data?.has_more" class="pt-1 text-sm text-ink-gray-5">
        {{ __('Showing the {0} most recent journeys.', [cards.length]) }}
      </p>
    </div>

    <!-- Keyed by the run: the modal owns that run's step fetch, so two runs never share one payload. -->
    <WorkflowRunModal
      v-if="opened"
      :key="opened.journey"
      :journey="opened"
      :modelValue="true"
      @update:modelValue="opened = null"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { createResource } from 'frappe-ui'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'
import ActivityCard from '@/tatva/ActivityCard.vue'
import WorkflowRunModal from './WorkflowRunModal.vue'
import LucideWorkflow from '~icons/lucide/workflow' // TATVA: same glyph as the Workflow tab (Lead.vue)
import LucideTriangleAlert from '~icons/lucide/triangle-alert'
import { statusTheme } from './journeyStatus'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
})

const opened = ref(null)

const journeys = createResource({
  url: 'tatva_connect.workflow_engine.history.journeys_for_subject',
  makeParams: () => ({
    subject_doctype: props.doctype,
    subject_name: props.docname,
  }),
  auto: true,
})

const journeyList = computed(() => journeys.data?.journeys || [])

// Every card built ONCE per answer, not per render: the props a card takes are objects, and rebuilding them
// in the template would hand each row a new identity on every paint. The tile takes the card's default grey
// like every other kind — status is the badge's job and saying it twice makes the rail read as two products;
// the corner is where a run says it needs a human without spending the badge on it.
const cards = computed(() =>
  journeyList.value.map((journey) => ({
    journey,
    title: journey.workflow,
    at: journey.started,
    tile: { kind: 'icon', icon: LucideWorkflow },
    badge: { label: __(journey.status), theme: statusTheme(journey.status) },
    corner: journey.stuck
      ? [
          {
            iconComp: LucideTriangleAlert,
            tooltip: __('Nothing will move this journey on its own.'),
          },
        ]
      : [],
    // A run has no human author — it is the engine.
    actor: { label: __('Automation'), iconComp: LucideWorkflow },
    // What the run DID, in words. `workflow_version` is a docname, so printing it puts a hash on the card.
    meta: [__('{0} steps', [journey.step_count || 0]), `${journey.total_ms || 0}ms`].join(
      ' · ',
    ),
  })),
)

// The ONE re-fetch trigger. `auto` covers the first load; this covers the record changing under a reused
// component. A second watcher here is a double-fetch, which is exactly what was added and removed again.
watch(
  () => [props.doctype, props.docname],
  () => {
    opened.value = null
    journeys.fetch()
  },
)
</script>
