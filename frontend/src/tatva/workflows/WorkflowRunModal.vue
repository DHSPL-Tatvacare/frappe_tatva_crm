<!-- TATVA: one run read end to end (history.journey_steps), one row per node with the canvas's own chip; ResponsiveDialog makes it the bottom sheet on a phone, on the Runs page and the lead's Workflow tab alike. -->
<template>
  <ResponsiveDialog
    v-model="open"
    :options="{ size: '2xl' }"
  >
    <!-- Status sits with the run's name; a failed run's error is on its failed step, so the verdict line shows only for other states. -->
    <template #body-title>
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <h3 class="min-w-0 truncate text-lg font-semibold text-ink-gray-9">
            {{ journey.workflow_title }}
          </h3>
          <Badge
            variant="subtle"
            :theme="statusTheme(journey.status)"
            :label="__(journey.status)"
          />
        </div>
        <p class="mt-1 truncate text-sm text-ink-gray-5">{{ subtitle }}</p>
        <p v-if="journey.status !== 'Failed'" class="mt-0.5 line-clamp-2 break-words text-sm" :class="verdictInk">
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
          <!-- The node's chip exactly as the canvas draws it, and a thread down to the next step. -->
          <div class="flex w-6 shrink-0 flex-col items-center">
            <NodeChip :type="step.node_type" />
            <div
              v-if="i < stepList.length - 1"
              class="mt-1 w-px flex-1 bg-surface-gray-3"
            />
          </div>

          <div class="min-w-0 flex-1 pb-4">
            <div class="flex min-h-6 items-center gap-2">
              <span class="min-w-0 flex-1 truncate text-base text-ink-gray-8">
                <template v-if="step.node_type">{{ titleFor(step.node_type) }}</template>
                <span class="ml-1 font-mono text-xs text-ink-gray-5">{{ step.node_id }}</span>
              </span>
              <Badge
                variant="subtle"
                :theme="outcomeTone(step.outcome).badge"
                size="sm"
                :label="step.outcome"
              />
              <Tooltip :text="step.creation">
                <span class="shrink-0 text-xs text-ink-gray-5"
                  >{{ step.duration_ms }}ms</span
                >
              </Tooltip>
            </div>
            <!-- Two lines at most; hovering shows the whole text. -->
            <p
              v-if="detailOf(step)"
              class="mt-0.5 line-clamp-2 break-words text-sm"
              :title="detailOf(step)"
              :class="step.outcome === 'failed' ? outcomeTone('failed').ink : 'text-ink-gray-6'"
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
import NodeChip from './NodeChip.vue'
import { statusTheme, statusInk, explainJourney, outcomeTone } from './journeyStatus'
import { useNodeTypes } from '@/tatva/useNodeTypes'

const props = defineProps({
  // The journey SUMMARY the list already holds — this modal adds the log, never re-reads the header.
  journey: { type: Object, required: true },
})

const { titleFor } = useNodeTypes()

const open = defineModel({ type: Boolean, default: false })

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

const verdictInk = computed(() => statusInk(props.journey.status))
</script>
