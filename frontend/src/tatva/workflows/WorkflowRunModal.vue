<!-- TATVA: ONE execution, read end to end — the step log as a vertical flow, one row per node it ran.
     Backend: tatva_connect.workflow_engine.history.journey_steps. Mounted keyed by journey, so the
     resource is this run's and its `cache` key makes reopening the same run free. -->
<template>
  <ResponsiveDialog
    v-model="open"
    :options="{ size: '2xl' }"
    :title="journey.workflow"
  >
    <!-- Status belongs to the run, so it sits with the run's NAME — not as a block above the log. -->
    <template #body-title>
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <h3 class="min-w-0 truncate text-lg font-semibold text-ink-gray-9">
            {{ journey.workflow }}
          </h3>
          <Badge
            variant="subtle"
            :theme="statusTheme(journey.status)"
            :label="__(journey.status)"
          />
        </div>
        <p class="mt-1 truncate text-sm text-ink-gray-5">{{ subtitle }}</p>
        <p class="mt-0.5 text-sm" :class="verdictInk">
          {{ explainJourney(journey) }}
        </p>
      </div>
    </template>

    <template #body-content>
      <div
        v-if="steps.loading"
        class="flex items-center gap-2 py-8 text-base text-ink-gray-5"
      >
        <LoadingIndicator class="h-5 w-5" />
        <span>{{ __('Loading...') }}</span>
      </div>

      <div v-else class="flex flex-col">
        <div
          v-for="(step, i) in stepList"
          :key="step.name"
          class="flex gap-3"
          :data-tc-step="step.node_id"
        >
          <!-- Rail: the node's own glyph, and the thread down to the next one. The glyph and the title row
               are both h-6 and both center their content, which is what puts them on one line; the thread is
               drawn by every row but the last, so the column closes itself without a second element. -->
          <div class="flex w-6 shrink-0 flex-col items-center">
            <div
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-gray-2"
              :class="outcomeInk(step.outcome)"
            >
              <component :is="iconFor(step.node_type)" class="size-3.5" />
            </div>
            <div
              v-if="i < stepList.length - 1"
              class="mt-1 w-px flex-1 bg-outline-gray-2"
            />
          </div>

          <div class="min-w-0 flex-1 pb-4">
            <div class="flex min-h-6 items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
                {{ step.node_id }}
              </span>
              <Badge
                variant="subtle"
                theme="gray"
                size="sm"
                :label="step.outcome"
              />
              <Tooltip :text="step.creation">
                <span class="shrink-0 text-xs text-ink-gray-5"
                  >{{ step.duration_ms }}ms</span
                >
              </Tooltip>
            </div>
            <p
              v-if="detailOf(step)"
              class="mt-0.5 break-words text-sm text-ink-gray-6"
            >
              {{ detailOf(step) }}
            </p>
          </div>
        </div>

        <p v-if="steps.data?.has_more" class="text-sm text-ink-gray-5">
          {{ __('Showing the first {0} steps.', [stepList.length]) }}
        </p>
        <p v-else-if="!stepList.length" class="py-6 text-sm text-ink-gray-5">
          {{ __('This run recorded no steps.') }}
        </p>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, Tooltip, createResource } from 'frappe-ui'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { iconFor } from './nodeCatalog'
import { statusTheme, explainJourney, outcomeInk } from './journeyStatus'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The journey SUMMARY the list already holds — this modal adds the log, never re-reads the header.
  journey: { type: Object, required: true },
})
const emit = defineEmits(['update:modelValue'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// Keyed by the run, so closing and reopening it is free and two runs never share one payload.
const steps = createResource({
  url: 'tatva_connect.workflow_engine.history.journey_steps',
  cache: ['workflowJourneySteps', props.journey.journey],
  params: { journey: props.journey.journey },
  auto: true,
})

const stepList = computed(() => steps.data?.steps || [])

// Who this step reached, READ FROM THE LOG — a lead's number changes, and the log holds the one used.
const detailOf = (step) =>
  [step.channel, step.contact, step.detail].filter(Boolean).join(' · ')

const subtitle = computed(() =>
  [
    props.journey.subject_label,
    __('{0} steps', [props.journey.step_count || stepList.value.length]),
    `${props.journey.total_ms || 0}ms`,
  ]
    .filter(Boolean)
    .join(' · '),
)

// The verdict sentence reads in the status's own ink where that status is the point, muted otherwise.
const VERDICT_INK = { Failed: 'text-ink-red-4', Parked: 'text-ink-amber-3' }
const verdictInk = computed(
  () => VERDICT_INK[props.journey.status] || 'text-ink-gray-6',
)
</script>
