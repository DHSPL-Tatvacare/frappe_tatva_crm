<!-- TATVA: one bulk job or export, read live from the Bulk Actions store by name: the problem first (as the workflow run modal puts it), then the facts, then the failed records by reason. No call of its own. -->
<template>
  <ResponsiveDialog v-model="show" :options="{ size: '2xl' }">
    <template #body-title>
      <div v-if="job" class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <h3 class="min-w-0 truncate text-lg font-semibold text-ink-gray-9">{{ titleOf(job) }}</h3>
          <Badge variant="subtle" :theme="tone.badge" :label="tone.label" />
        </div>
        <p class="mt-1 truncate text-sm text-ink-gray-5">
          {{ __('Requested by you · {0}', [formatDate(job.creation)]) }}
        </p>
      </div>
    </template>

    <template #body-content>
      <div v-if="job" class="flex flex-col gap-5 text-base">
        <!-- What went wrong, first: one line per reason with how many it stopped. -->
        <div v-if="problems.length" class="flex flex-col gap-1 rounded-lg bg-surface-red-1 px-3 py-2.5">
          <p v-for="p in problems" :key="p.reason" class="break-words text-sm text-ink-red-4">
            <span v-if="p.count" class="font-medium">{{ __('{0} failed', [p.count]) }}: </span>{{ p.reason }}
          </p>
        </div>

        <dl class="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
          <template v-for="f in facts" :key="f.label">
            <dt class="text-ink-gray-5">{{ f.label }}</dt>
            <dd class="min-w-0 break-words text-ink-gray-8">
              <BulkJobLine v-if="f.line" :job="job" />
              <template v-else>{{ f.value }}</template>
            </dd>
          </template>
        </dl>

        <div v-if="groups.length" class="flex flex-col gap-2">
          <div class="text-sm font-medium text-ink-gray-8">
            {{ __('Failed records') }} · {{ job.failed_names.length }}
          </div>
          <div class="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-outline-gray-2">
            <div v-for="g in groups" :key="g.reason" class="shrink-0">
              <div class="sticky top-0 border-b border-outline-gray-1 bg-surface-gray-1 px-3 py-1.5 text-xs text-ink-gray-6">
                {{ g.reason }} · {{ g.names.length }}
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2">
                <component
                  :is="routeOf(name) ? 'RouterLink' : 'span'"
                  v-for="name in g.names"
                  :key="name"
                  :to="routeOf(name) || undefined"
                  class="shrink-0 font-mono text-xs text-ink-gray-7"
                  :class="routeOf(name) ? 'hover:text-ink-gray-9 hover:underline' : ''"
                  @click="routeOf(name) && (show = false)"
                >
                  {{ name }}
                </component>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="job?.file_url || job?.abortable" #actions>
      <div class="flex justify-end">
        <Button
          v-if="job.abortable"
          :label="__('Stop')"
          theme="red"
          variant="subtle"
          class="w-full sm:w-auto"
          @click="confirmStop(job)"
        />
        <a v-else :href="job.file_url" :download="job.file_name" class="w-full sm:w-auto">
          <Button :label="__('Download')" variant="solid" icon-left="download" class="w-full sm:w-auto" />
        </a>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, Button } from 'frappe-ui'
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import BulkJobLine from '@/tatva/BulkJobLine.vue'
import { jobByName, titleOf, isLive, confirmStop } from '@/stores/bulkActionsPanel'
import { usersStore } from '@/stores/users'
import { getMeta } from '@/stores/meta'
import { formatDate, formatDuration } from '@/utils'

const props = defineProps({ jobName: { type: String, required: true } })
const show = defineModel({ type: Boolean })

const job = computed(() => jobByName(props.jobName))
const { getUser } = usersStore()
// A Bulk Edit names its field by label; the meta is read once per open, and only for an edit.
const editFields = job.value?.action === 'Bulk Edit' ? getMeta(job.value.target_doctype).getFields : () => []

// The status in plain words and the workflow run modal's colours: blue in flight, green clean, amber partly, red stopped.
const tone = computed(() => {
  const j = job.value
  if (j.aborted) return { badge: 'gray', label: __('Stopped') }
  if (j.status === 'Error') return { badge: 'red', label: __('Failed') }
  if (j.status === 'Started') return { badge: 'blue', label: __('Running') }
  if (j.status === 'Queued') return { badge: 'gray', label: __('Waiting') }
  if (j.failed) return { badge: 'orange', label: __('Partly done') }
  return { badge: 'green', label: __('Done') }
})

// What the job was asked to do, from the settings it was queued with.
const asked = computed(() => {
  const j = job.value
  const p = j.params || {}
  if (j.kind === 'export') return __('Export · {0}', [j.reference || __('List')])
  const names = (list) => [].concat(list || []).map((u) => getUser(u)?.full_name || u).join(', ')
  if (j.action === 'Assign') return __('Assign to {0}', [names(p.assign_to)])
  if (j.action === 'Reassign') return __('Reassign to {0}', [names(p.assign_to)])
  if (j.action === 'Clear Assignment') return __('Remove every assignee')
  if (j.action === 'Bulk Delete') return p.delete_linked ? __('Delete with linked records') : __('Delete, unlinking linked records')
  if (j.action === 'Bulk Edit') {
    const field = editFields().find((f) => f.fieldname === p.field)
    return __('Set {0} to {1}', [field?.label || p.field, p.value ?? __('blank')])
  }
  return j.action
})

// The final write stamps `modified`; a job finished before that change has no finish time.
const finishedAt = computed(() => {
  const j = job.value
  return !isLive(j) && j.modified && j.modified > j.creation ? j.modified : null
})

const facts = computed(() => {
  const j = job.value
  const noun = String(j.target_doctype || '').replace(/^CRM /, '').toLowerCase()
  const out = [
    { label: __('Action'), value: asked.value },
    {
      label: __('Applied to'),
      value: j.kind === 'export' ? String(j.fmt || '').toUpperCase() : `${j.total} ${__(noun + 's')}`,
    },
    { label: __('Requested'), value: formatDate(j.creation) },
  ]
  if (isLive(j)) return [...out, { label: __('Progress'), line: true }]
  const seconds = finishedAt.value ? Math.round((new Date(finishedAt.value) - new Date(j.creation)) / 1000) : null
  return [
    ...out,
    { label: __('Finished'), value: finishedAt.value ? formatDate(finishedAt.value) : '—' },
    { label: __('Took'), value: seconds === null ? '—' : formatDuration(seconds) || __('under a second') },
    { label: __('Result'), line: true },
  ]
})

// Failed records grouped by the reason their run kept; a job from before reasons were kept has one unnamed group.
const groups = computed(() => {
  const byReason = new Map()
  for (const f of job.value?.failed_names || []) {
    const reason = f.reason || __('No reason was recorded')
    byReason.set(reason, [...(byReason.get(reason) || []), f.name])
  }
  return [...byReason.entries()].map(([reason, names]) => ({ reason, names }))
})

const problems = computed(() => {
  const j = job.value
  if (j?.aborted) return groups.value.map((g) => ({ reason: g.reason, count: g.names.length }))
  if (j?.status === 'Error') return [{ reason: j.error || __('The job could not run.'), count: 0 }]
  return groups.value.map((g) => ({ reason: g.reason, count: g.names.length }))
})

// A failed lead or deal opens its page; any other record is listed by name.
const ROUTES = { 'CRM Lead': ['Lead', 'leadId'], 'CRM Deal': ['Deal', 'dealId'] }

function routeOf(name) {
  const hit = ROUTES[job.value?.target_doctype]
  return hit ? { name: hit[0], params: { [hit[1]]: name } } : null
}
</script>
