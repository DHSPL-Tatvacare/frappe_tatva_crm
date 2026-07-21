<!-- TATVA: a lead's workflow history — which runs exist, and what each one did.
     Backend: tatva_connect.workflow_engine.history. Every row here is read or derived there; this
     component stores nothing and decides nothing. -->
<template>
  <div class="flex flex-1 flex-col overflow-y-auto px-3 pb-3 sm:px-10 sm:pb-5">
    <!-- Same loading and empty treatment the sibling tabs use, so this tab does not read as a stranger. -->
    <div
      v-if="runs.loading"
      class="flex flex-1 items-center justify-center gap-2 text-base text-ink-gray-5"
    >
      <LoadingIndicator class="h-6 w-6" />
      <span>{{ __('Loading...') }}</span>
    </div>
    <EmptyState
      v-else-if="!runList.length"
      name="Workflow"
      :title="__('No automation has run for this lead')"
      :description="__('When a workflow matches this lead, every step it takes is recorded here.')"
      icon="git-branch"
    />
    <div v-else class="flex flex-col divide-y divide-outline-gray-1">
      <div v-for="run in runList" :key="run.run">
        <!-- h-10 matches the step row's h-8 plus its padding: both are fixed, so every row of a
             kind is the same height by construction and no list can ever go ragged. -->
        <button
          class="flex h-10 w-full items-center gap-2 text-left"
          @click="toggle(run.run)"
        >
          <FeatherIcon
            :name="expanded === run.run ? 'chevron-down' : 'chevron-right'"
            class="h-4 w-4 shrink-0 text-ink-gray-5"
          />
          <Badge
            variant="subtle"
            :theme="STATUS_THEME[run.status] || 'gray'"
            :label="__(run.status)"
          />
          <span
            class="truncate text-base text-ink-gray-8"
            :title="run.workflow"
            >{{ run.workflow }}</span
          >
          <span
            v-if="run.stuck"
            class="shrink-0 text-sm font-medium text-ink-red-3"
            :title="__('Nothing will move this run on its own.')"
            >{{ __('needs attention') }}</span
          >
          <span
            class="ml-auto shrink-0 text-sm text-ink-gray-5"
            :title="run.started"
            >{{ timeAgo(run.started) }}</span
          >
        </button>

        <div v-if="expanded === run.run" class="pb-3 pl-6">
          <div
            class="mb-2 truncate text-sm text-ink-gray-6"
            :title="explain(run)"
          >
            {{ explain(run) }}
          </div>
          <div v-if="steps.loading" class="text-sm text-ink-gray-5">
            {{ __('Loading...') }}
          </div>
          <div v-else class="flex flex-col">
            <div
              v-for="step in steps.data?.steps || []"
              :key="step.name"
              class="flex h-8 items-center gap-2"
            >
              <span
                class="w-2 shrink-0 rounded-full"
                :class="OUTCOME_DOT[step.outcome] || 'bg-surface-gray-4'"
                style="height: 0.5rem"
              />
              <span
                class="w-32 shrink-0 truncate text-sm text-ink-gray-7"
                :title="step.node_id"
                >{{ step.node_id }}</span
              >
              <span
                class="w-20 shrink-0 truncate text-sm text-ink-gray-5"
                :title="step.outcome"
                >{{ step.outcome }}</span
              >
              <span
                class="truncate text-sm text-ink-gray-6"
                :title="step.detail"
                >{{ step.detail }}</span
              >
              <span
                class="ml-auto shrink-0 text-sm text-ink-gray-5"
                :title="step.creation"
                >{{ step.duration_ms }}ms</span
              >
            </div>
            <div
              v-if="steps.data?.has_more"
              class="pt-1 text-sm text-ink-gray-5"
            >
              {{ __('Showing the first {0} steps.', [steps.data.steps.length]) }}
            </div>
          </div>
        </div>
      </div>
      <div v-if="runs.data?.has_more" class="pt-2 text-sm text-ink-gray-5">
        {{ __('Showing the {0} most recent runs.', [runList.length]) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, FeatherIcon, createResource } from 'frappe-ui'
import { timeAgo } from '@/utils'
import LoadingIndicator from '@/components/Icons/LoadingIndicator.vue'
import EmptyState from '@/components/ListViews/EmptyState.vue'

const props = defineProps({
  doctype: { type: String, required: true },
  docname: { type: String, required: true },
})

// The run's own status values, and a step's own outcome values. Neither switches on NODE TYPE:
// a new node type must render here with no frontend change at all.
const STATUS_THEME = {
  Running: 'blue',
  Parked: 'orange',
  Done: 'green',
  Failed: 'red',
}
const OUTCOME_DOT = {
  ok: 'bg-surface-green-3',
  done: 'bg-surface-green-3',
  parked: 'bg-surface-amber-3',
  resumed: 'bg-surface-blue-3',
  failed: 'bg-surface-red-3',
}

const expanded = ref(null)

const runs = createResource({
  url: 'tatva_connect.workflow_engine.history.runs_for_subject',
  makeParams: () => ({
    subject_doctype: props.doctype,
    subject_name: props.docname,
  }),
  auto: true,
})

const steps = createResource({
  url: 'tatva_connect.workflow_engine.history.run_steps',
  makeParams: () => ({ run: expanded.value }),
})

const runList = computed(() => runs.data?.runs || [])

function toggle(run) {
  expanded.value = expanded.value === run ? null : run
}

// The resource owns the fetch and the cache; expanding is the only trigger, so there is no second
// place that knows when steps are stale.
watch(expanded, (run) => {
  if (run) steps.fetch()
})

// The ONE re-fetch trigger. `auto` covers the first load; this covers the record changing under a reused
// component. A second watcher here is a double-fetch, which is exactly what was added and removed again.
watch(
  () => [props.doctype, props.docname],
  () => {
    expanded.value = null
    runs.fetch()
  },
)

// One sentence saying why this run is where it is, built from what the backend already derived.
function explain(run) {
  // The reason comes off the last failed step, derived server-side, so it cannot disagree with the log.
  if (run.status === 'Failed') {
    const at = run.failure?.node_id || run.current_node || __('an unknown step')
    return run.failure?.detail
      ? __('Failed at {0} — {1}', [at, run.failure.detail])
      : __('Failed at {0}.', [at])
  }
  if (run.status === 'Done') {
    return __('Completed.')
  }
  if (run.status === 'Parked') {
    const waiting = run.waiting_on || {}
    if (waiting.resume_at && waiting.signal) {
      return __('Waiting for {0}, or until {1}.', [
        waiting.signal,
        waiting.resume_at,
      ])
    }
    if (waiting.resume_at) return __('Waiting until {0}.', [waiting.resume_at])
    if (waiting.signal) {
      return waiting.signal_pending
        ? __('Waiting for {0} — a signal has arrived and will be picked up.', [
            waiting.signal,
          ])
        : __('Waiting for {0} — nothing has arrived yet.', [waiting.signal])
    }
    return __('Parked with nothing to wake it.')
  }
  return __('Currently at {0}.', [run.current_node || __('an unknown step')])
}
</script>
