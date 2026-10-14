<!-- TATVA: where one bulk job or export stands, in one line; the panel, the mobile page and the detail all draw it from here. -->
<template>
  <div class="flex min-w-0 flex-col gap-1 text-sm text-ink-gray-5">
    <template v-if="job.status === 'Queued'">{{ __('Waiting to start') }}</template>
    <template v-else-if="job.status === 'Started' && job.kind === 'bulk'">
      <Progress :value="percent" size="sm" />
      <span>{{ __('{0} of {1}', [done, job.total]) }}</span>
    </template>
    <template v-else-if="job.status === 'Started'">
      {{ __('{0} rows so far', [job.rows || 0]) }}
    </template>
    <template v-else-if="job.aborted">
      {{ __('Stopped · {0} done', [job.kind === 'export' ? job.rows || 0 : job.succeeded || 0]) }}
    </template>
    <template v-else-if="job.status === 'Error'">
      <span class="text-ink-red-4">{{ __('Could not run') }}</span>
    </template>
    <span v-else-if="job.kind === 'export'">
      {{ __('{0} rows', [job.rows || 0]) }}<template v-if="job.truncated"> · {{ __('cut at the row limit') }}</template>
    </span>
    <span v-else>
      {{ __('{0} done', [job.succeeded || 0]) }}<span v-if="job.failed" class="text-ink-red-4">, {{ __('{0} failed', [job.failed]) }}</span>
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Progress } from 'frappe-ui'

const props = defineProps({ job: { type: Object, required: true } })

const done = computed(() => (props.job.succeeded || 0) + (props.job.failed || 0))
const percent = computed(() => (props.job.total ? Math.round((done.value * 100) / props.job.total) : 0))
</script>
