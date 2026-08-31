<template>
  <ResponsiveDialog v-model="show" :options="{ title: job.title }">
    <template #body-content>
      <div class="flex flex-col gap-3 text-base">
        <div class="flex items-center gap-2">
          <Badge :theme="statusTheme(job.status)" variant="subtle" :label="job.status" />
          <span class="text-ink-gray-5">{{ __(timeAgo(job.creation)) }}</span>
        </div>

        <template v-if="job.kind === 'bulk'">
          <div>{{ __('{0} of {1} succeeded', [job.succeeded ?? 0, job.total]) }}</div>
          <div v-if="job.failed_names?.length" class="flex flex-col gap-1">
            <div class="font-medium">{{ __('Failed records') }}</div>
            <div class="max-h-40 overflow-auto text-ink-gray-6">
              <div v-for="name in job.failed_names" :key="name">{{ name }}</div>
            </div>
          </div>
        </template>

        <template v-else>
          <div>
            {{ __('{0} rows', [job.rows ?? 0]) }}<span v-if="job.truncated"> · {{ __('truncated') }}</span>
          </div>
          <a v-if="job.file_url" :href="job.file_url" :download="job.file_name">
            <Button :label="__('Download')" variant="solid" />
          </a>
        </template>

        <div v-if="job.error" class="text-ink-red-4">{{ job.error }}</div>
      </div>
    </template>
  </ResponsiveDialog>
</template>

<script setup>
import ResponsiveDialog from '@/tatva/ResponsiveDialog.vue'
import { Badge, Button } from 'frappe-ui'
import { timeAgo } from '@/utils'

defineProps({ job: { type: Object, required: true } })
const show = defineModel({ type: Boolean })

function statusTheme(status) {
  if (status === 'Completed') return 'green'
  if (status === 'Error') return 'red'
  if (status === 'Started') return 'blue'
  return 'gray'
}
</script>
